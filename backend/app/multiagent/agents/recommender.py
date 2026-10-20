import json
import logging
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage, AIMessage
from langchain_core.tools import tool

from app.core.config import settings
from app.multiagent.state import AgentState
from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.multiagent.prompts.recommender_prompt import RECOMMENDER_REACT_SYSTEM_PROMPT
from app.multiagent.llm_utils import parse_llm_json, get_chat_llm, extract_text, MODE_FALLBACK
from app.schemas.recommendation import RecommendationItem, CitationModel

logger = logging.getLogger(__name__)

MODE_LLM_REACT = "LLM_REACT"
MAX_REACT_STEPS = 3


def clinical_recommender_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 2: Rekomendasi Klinis (Autonomous ReAct Agent + RAG)
    
    1. Mengoperasikan siklus ReAct (Reasoning + Acting) otonom:
       - Tool 1: `search_guidelines` untuk kueri semantik ke ChromaDB (Buku KIA / PNPK Stunting).
       - Tool 2: `get_deterministic_detail` untuk inspeksi angka baku kalkulasi Stage 1.
    2. Mendukung Human-in-the-loop: memperhitungkan catatan penolakan/revisi kader jika ada.
    3. Validasi skema keluaran terstruktur dengan Pydantic (RecommendationItem).
    4. Fallback deterministik berbasis aturan jika kuota LLM habis atau koneksi terputus.
    """
    risk_flags = state.get("risk_flags", [])
    risk_narrative = state.get("risk_narrative", "")
    phase = state.get("phase", "BADUTA")
    deterministic_results = state.get("deterministic_results", {})
    kader_feedback = state.get("kader_feedback")
    
    if not risk_flags:
        return {
            "recommendations": [],
            "retrieved_chunks": [],
            "recommender_mode": "NO_RISK",
            "thought_process": ["Tidak ada flag risiko aktif, rekomendasi diabaikan."]
        }

    seen_chunks: Dict[str, Dict[str, Any]] = {}
    thought_process: List[str] = []

    # ------------------------------------------------------------------------
    # Definisi Tools untuk ReAct Agent
    # ------------------------------------------------------------------------
    @tool
    def search_guidelines(query: str, n_results: int = 2) -> str:
        """Mencari pedoman klinis resmi KIA, tatalaksana gizi, stunting, atau KEK dari ChromaDB."""
        chunks = retrieve_clinical_guidelines(query, n_results=n_results)
        if not chunks:
            return "Tidak ditemukan dokumen pedoman yang relevan untuk kueri tersebut."
        
        snippets = []
        for c in chunks:
            chunk_id = c.get("id")
            if chunk_id and chunk_id not in seen_chunks:
                seen_chunks[chunk_id] = c
            snippets.append(
                f"[ID: {chunk_id}] Sumber: {c.get('source')} | Bagian: {c.get('section')} | Hal: {c.get('page')}\n"
                f"Kutipan: {c.get('content')}"
            )
        return "\n\n".join(snippets)

    @tool
    def get_deterministic_detail(indicator_or_topic: str) -> str:
        """Mengambil rincian kalkulasi baku Stage 1 (Z-score WHO, LMS, KSPR, LiLA, Hb, BBLR, tren 2T)."""
        topic = indicator_or_topic.lower()
        if "who" in topic or "zscore" in topic or "stunting" in topic or "z" in topic:
            who_data = deterministic_results.get("who_zscore")
            return json.dumps(who_data or "Tidak ada data kalkulasi WHO Z-score.", ensure_ascii=False)
        elif "faltering" in topic or "2t" in topic or "berat" in topic or "trend" in topic:
            trend_data = deterministic_results.get("weight_trend")
            return json.dumps(trend_data or "Tidak ada data pemantauan berat badan 2T.", ensure_ascii=False)
        elif "kspr" in topic or "kehamilan" in topic or "resiko" in topic:
            kspr_data = deterministic_results.get("kspr")
            return json.dumps(kspr_data or "Tidak ada data KSPR ibu hamil.", ensure_ascii=False)
        elif "maternal" in topic or "ibu" in topic:
            mat_data = state.get("maternal_history")
            return json.dumps(mat_data or "Tidak ada riwayat maternal.", ensure_ascii=False)
        else:
            return json.dumps(deterministic_results, ensure_ascii=False)

    tools = [search_guidelines, get_deterministic_detail]
    tool_map = {t.name: t for t in tools}

    # ------------------------------------------------------------------------
    # Eksekusi Siklus ReAct dengan Gemini LLM
    # ------------------------------------------------------------------------
    llm = get_chat_llm(temperature=0.2)
    recommendations: List[Dict[str, Any]] = []
    recommender_mode = MODE_FALLBACK

    if llm is not None:
        try:
            llm_with_tools = llm.bind_tools(tools)

            feedback_note = ""
            if kader_feedback:
                feedback_note = (
                    f"\n[CATATAN REVISI KADER]: Kader Posyandu menolak rekomendasi sebelumnya dengan alasan:\n"
                    f"'{kader_feedback}'\n"
                    f"Anda WAJIB mengakomodasi catatan ini (misalnya mencari menu/intervensi alternatif).\n"
                )

            initial_user_prompt = f"""Konteks Pasien:
- Fase: {phase}
- Temuan Narasi Klinis: {risk_narrative}
- Daftar Flag Risiko Aktif: {json.dumps(risk_flags, ensure_ascii=False)}
{feedback_note}
Tugas Anda:
1. Analisis kebutuhan intervensi klinis.
2. Gunakan `search_guidelines` untuk mengambil rujukan tata laksana resmi dari Buku KIA / PNPK Stunting.
3. Gunakan `get_deterministic_detail` jika Anda butuh mengonfirmasi angka eksak hasil kalkulasi.
4. Susun rekomendasi akhir yang grounded dalam format JSON valid sesuai instruksi sistem.
"""
            messages = [
                SystemMessage(content=RECOMMENDER_REACT_SYSTEM_PROMPT),
                HumanMessage(content=initial_user_prompt)
            ]

            step_count = 0
            final_content = ""

            while step_count < MAX_REACT_STEPS:
                step_count += 1
                ai_msg = llm_with_tools.invoke(messages)
                messages.append(ai_msg)

                tool_calls = getattr(ai_msg, "tool_calls", None) or []
                if not tool_calls:
                    # Model memutuskan tidak memanggil tool lagi dan memberikan jawaban akhir
                    final_content = extract_text(ai_msg.content)
                    thought_process.append(f"Langkah {step_count}: Model selesai merumuskan rekomendasi.")
                    break

                for tc in tool_calls:
                    fn_name = tc.get("name")
                    fn_args = tc.get("args", {})
                    call_id = tc.get("id") or f"call_{step_count}"
                    
                    thought_process.append(f"Langkah {step_count}: Action `{fn_name}` dengan argumen {fn_args}")
                    
                    target_tool = tool_map.get(fn_name)
                    if target_tool:
                        try:
                            obs = target_tool.invoke(fn_args)
                        except Exception as tool_err:
                            obs = f"Error saat menjalankan tool {fn_name}: {tool_err}"
                    else:
                        obs = f"Tool {fn_name} tidak ditemukan."
                    
                    messages.append(ToolMessage(content=str(obs), tool_call_id=call_id))

            # Jika setelah loop selesai belum ada output final (karena mencapai MAX_REACT_STEPS)
            if not final_content:
                followup_prompt = (
                    "Informasi dokumen rujukan dan kalkulasi telah dikumpulkan. "
                    "Sekarang, keluarkan HANYA array JSON rekomendasi klinis final sesuai skema yang ditentukan."
                )
                messages.append(HumanMessage(content=followup_prompt))
                final_ai = llm.invoke(messages)
                final_content = extract_text(final_ai.content)

            # Validasi Pydantic
            parsed_data = parse_llm_json(final_content)
            if isinstance(parsed_data, dict) and "recommendations" in parsed_data:
                raw_items = parsed_data["recommendations"]
            elif isinstance(parsed_data, list):
                raw_items = parsed_data
            else:
                raw_items = [parsed_data]

            validated_items = []
            for item in raw_items:
                try:
                    # Validasi item rekomendasi
                    validated = RecommendationItem(**item)
                    validated_items.append(validated.model_dump())
                except Exception as pydantic_err:
                    logger.warning(f"[RECOMMENDER SCHEMA WARNING] Item diabaikan karena skema tidak valid: {pydantic_err}")

            if validated_items:
                recommendations = validated_items
                recommender_mode = MODE_LLM_REACT
                thought_process.append(f"Validasi Pydantic sukses: {len(validated_items)} butir rekomendasi disahkan.")

        except Exception as e:
            logger.warning(f"[RECOMMENDER REACT WARNING] Fallback ke aturan deterministik: {e}")
            thought_process.append(f"Gagal mengeksekusi ReAct LLM ({e}), beralih ke fallback deterministik.")
            recommendations = []

    # ------------------------------------------------------------------------
    # Fallback Deterministik jika LLM offline, kehabisan kuota, atau skema gagal
    # ------------------------------------------------------------------------
    if not recommendations:
        recommender_mode = MODE_FALLBACK
        # Pastikan ada chunks minimal jika retrieval via tools belum sempat jalan
        if not seen_chunks:
            for flag_obj in risk_flags:
                f_name = flag_obj.get("flag", "")
                detail = flag_obj.get("detail", "")
                q = f"Tata laksana dan rekomendasi kader untuk {f_name} {detail} fase {phase}"
                for c in retrieve_clinical_guidelines(q, n_results=2):
                    if c["id"] not in seen_chunks:
                        seen_chunks[c["id"]] = c

        recommendations = _generate_rule_based_recommendations(
            risk_flags=risk_flags,
            chunks=list(seen_chunks.values()),
            kader_feedback=kader_feedback
        )
        thought_process.append("Rekomendasi disintesis menggunakan aturan deterministik fallback standar PNPK/Buku KIA.")

    return {
        "recommendations": recommendations,
        "retrieved_chunks": list(seen_chunks.values()),
        "recommender_mode": recommender_mode,
        "thought_process": thought_process
    }


def _generate_rule_based_recommendations(
    risk_flags: List[Dict[str, Any]],
    chunks: List[Dict[str, Any]],
    kader_feedback: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Generator rekomendasi deterministik fallback berbasis aturan standar Kemenkes/PNPK.
    Mendukung penyesuaian khusus jika terdapat catatan penolakan dari kader.
    """
    recs = []
    has_egg_allergy = kader_feedback and ("telur" in kader_feedback.lower() or "alergi" in kader_feedback.lower())

    for flag in risk_flags:
        f_name = flag.get("flag", "")
        matching_chunk = next((c for c in chunks if f_name.split("_")[-1] in c.get("category", "")), None)
        if not matching_chunk and chunks:
            matching_chunk = chunks[0]
            
        citation = {
            "source": matching_chunk["source"] if matching_chunk else "Buku KIA RI (2020)",
            "section": matching_chunk["section"] if matching_chunk else "Panduan Pelayanan Posyandu",
            "page": matching_chunk["page"] if matching_chunk else 1,
            "chunk_id": matching_chunk["id"] if matching_chunk else None
        }
        
        if "STUNTING" in f_name or "GIZI" in f_name or "UNDERWEIGHT" in f_name or "WEIGHT" in f_name:
            protein_step = (
                "Edukasi alternatif protein hewani non-alergen: ikan kembung, daging ayam, atau tahu/tempe"
                if has_egg_allergy
                else "Edukasi konsumsi protein hewani 1 butir telur dan/atau ikan per hari"
            )
            recs.append({
                "title": "Intervensi Gizi Spesifik dan Rujukan Puskesmas",
                "category": "GIZI",
                "recommendation_text": (
                    "Lakukan rujukan ke Puskesmas untuk konfirmasi tata laksana stunting dan berikan PMT Pemulihan tinggi protein hewani."
                    + (f" (Catatan Kader: {kader_feedback})" if kader_feedback else "")
                ),
                "action_steps": [
                    "Rujuk anak ke dokter Puskesmas Airmadidi untuk konfirmasi klinis",
                    protein_step,
                    "Pantau kenaikan berat badan tiap 2 minggu di Posyandu"
                ],
                "citation": citation
            })
        elif "KEK" in f_name:
            recs.append({
                "title": "Pemberian Makanan Tambahan (PMT) Ibu Hamil KEK",
                "category": "GIZI_MATERNAL",
                "recommendation_text": "Ibu hamil KEK wajib mendapat PMT selama 90 hari dan pendampingan gizi intensif.",
                "action_steps": [
                    "Distribusi paket PMT Ibu Hamil",
                    "Anjurkan makan porsi kecil tapi sering dengan gizi seimbang",
                    "Jadwalkan pemeriksaan ANC lanjutan di Puskesmas"
                ],
                "citation": citation
            })
        elif "ANEMIA" in f_name:
            recs.append({
                "title": "Kepatuhan Konsumsi Tablet Tambah Darah (TTD)",
                "category": "MEDIS",
                "recommendation_text": "Pastikan kepatuhan minum Tablet Tambah Darah (TTD) minimal 90 butir selama masa kehamilan.",
                "action_steps": [
                    "Minum TTD malam hari sebelum tidur dengan air putih / sari jeruk",
                    "Hindari konsumsi teh / kopi bersamaan dengan TTD",
                    "Tingkatkan konsumsi sayur hijau dan hati ayam"
                ],
                "citation": citation
            })
        elif "BBLR" in f_name or "PRETERM" in f_name:
            recs.append({
                "title": "Perawatan Metode Kanguru (PMK) dan Pemantauan Suhu",
                "category": "NEONATAL",
                "recommendation_text": "Edukasi keluarga untuk menerapkan Perawatan Metode Kanguru guna mencegah hipotermia pada bayi BBLR.",
                "action_steps": [
                    "Terapkan kontak kulit ke kulit (skin-to-skin) secara rutin",
                    "Berikan ASI eksklusif sesering mungkin setiap 2 jam",
                    "Tunda memandikan bayi hingga berat badan stabil di atas 2.500 gram"
                ],
                "citation": citation
            })
        else:
            recs.append({
                "title": "Edukasi dan Pemantauan Rutin Posyandu",
                "category": "EDUKASI",
                "recommendation_text": "Tingkatkan pemantauan tumbuh kembang dan kehadiran di Posyandu setiap bulan.",
                "action_steps": [
                    "Kunjungan rutin Posyandu setiap bulan",
                    "Konseling gizi seimbang dan stimulasi perkembangan anak"
                ],
                "citation": citation
            })
            
    return recs
