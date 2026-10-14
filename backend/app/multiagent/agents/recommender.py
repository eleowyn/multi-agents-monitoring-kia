import json
from typing import Dict, Any, List
from app.core.config import settings
from app.multiagent.state import AgentState
from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.multiagent.prompts.recommender_prompt import RECOMMENDER_SYSTEM_PROMPT
from app.multiagent.llm_utils import parse_llm_json


def clinical_recommender_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 2: Rekomendasi Klinis (RAG + Synthesis)
    
    1. Mengubah flag risiko dan narasi klinis menjadi kueri pencarian semantik.
    2. Melakukan retrieval ke ChromaDB untuk mengambil referensi Buku KIA / PNPK Stunting.
    3. Memanggil Gemini 2.5 Flash untuk mensintesis rekomendasi klinis terverifikasi.
    """
    risk_flags = state.get("risk_flags", [])
    risk_narrative = state.get("risk_narrative", "")
    phase = state.get("phase", "BADUTA")
    
    if not risk_flags:
        return {
            "recommendations": [],
            "retrieved_chunks": []
        }

    # 1. Retrieval RAG
    all_chunks = []
    seen_ids = set()
    
    for flag_obj in risk_flags:
        flag_name = flag_obj.get("flag", "")
        detail = flag_obj.get("detail", "")
        query = f"Tata laksana dan rekomendasi kader untuk {flag_name} {detail} fase {phase}"
        
        chunks = retrieve_clinical_guidelines(query, n_results=2)
        for chunk in chunks:
            if chunk["id"] not in seen_ids:
                seen_ids.add(chunk["id"])
                all_chunks.append(chunk)

    # 2. Sintesis Rekomendasi via Gemini LLM
    recommendations = []
    
    if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10 and not settings.GEMINI_API_KEY.startswith("YOUR_"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import SystemMessage, HumanMessage

            llm = ChatGoogleGenerativeAI(
                model=settings.GEMINI_MODEL,
                google_api_key=settings.GEMINI_API_KEY,
                temperature=0.2
            )

            context_str = "\n\n".join([
                f"[DOKUMEN RUJUKAN {i+1}]:\nSumber: {c['source']}\nBagian: {c['section']}\nHalaman: {c['page']}\nIsi: {c['content']}"
                for i, c in enumerate(all_chunks)
            ])

            user_prompt = f"""
Fase Pasien: {phase}
Temuan Narasi Klinis: {risk_narrative}
Daftar Flag Risiko: {json.dumps(risk_flags, ensure_ascii=False)}

Konteks Dokumen Rujukan:
{context_str}

Berdasarkan dokumen rujukan di atas, susunlah rekomendasi klinis terverifikasi dalam format JSON array of objects:
[
  {{
    "title": "Judul Tindakan",
    "category": "GIZI / MEDIS / EDUKASI",
    "recommendation_text": "Uraian rekomendasi tindakan untuk kader",
    "action_steps": ["Langkah 1", "Langkah 2"],
    "citation": {{
      "source": "Nama Dokumen",
      "section": "Nama Bagian / Bab",
      "page": 18
    }}
  }}
]
Keluarkan HANYA format JSON valid tanpa teks pengantar tambahan.
"""
            response = llm.invoke([
                SystemMessage(content=RECOMMENDER_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt)
            ])
            
            recommendations = parse_llm_json(response.content)

        except Exception as e:
            print(f"[RECOMMENDER LLM WARNING] Fallback ke template terstruktur: {e}")
            recommendations = _generate_rule_based_recommendations(risk_flags, all_chunks)
    else:
        # Fallback deterministik jika API key belum diisi
        recommendations = _generate_rule_based_recommendations(risk_flags, all_chunks)

    return {
        "recommendations": recommendations,
        "retrieved_chunks": all_chunks
    }


def _generate_rule_based_recommendations(
    risk_flags: List[Dict[str, Any]],
    chunks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Generator rekomendasi deterministik fallback jika LLM offline."""
    recs = []
    for flag in risk_flags:
        f_name = flag.get("flag", "")
        matching_chunk = next((c for c in chunks if f_name.split("_")[-1] in c["category"]), None)
        if not matching_chunk and chunks:
            matching_chunk = chunks[0]
            
        citation = {
            "source": matching_chunk["source"] if matching_chunk else "Buku KIA RI (2020)",
            "section": matching_chunk["section"] if matching_chunk else "Panduan Pelayanan Posyandu",
            "page": matching_chunk["page"] if matching_chunk else 1
        }
        
        if "STUNTING" in f_name or "GIZI" in f_name:
            recs.append({
                "title": "Intervensi Gizi Spesifik dan Rujukan Puskesmas",
                "category": "GIZI",
                "recommendation_text": "Lakukan rujukan ke Puskesmas untuk konfirmasi tata laksana stunting dan berikan PMT Pemulihan tinggi protein hewani.",
                "action_steps": [
                    "Rujuk anak ke dokter Puskesmas Airmadidi",
                    "Edukasi konsumsi protein hewani 1 butir telur/hari",
                    "Pantau kenaikan berat badan tiap 2 minggu"
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
                    "Anjurkan makan porsi kecil tapi sering",
                    "Jadwalkan pemeriksaan ANC lanjutan"
                ],
                "citation": citation
            })
        elif "ANEMIA" in f_name:
            recs.append({
                "title": "Kepatuhan Konsumsi Tablet Tambah Darah (TTD)",
                "category": "MEDIS",
                "recommendation_text": "Pastikan kepatuhan minum Tablet Tambah Darah (TTD) minimal 90 butir selama masa kehamilan.",
                "action_steps": [
                    "Minum TTD malam hari dengan air putih / sari jeruk",
                    "Hindari konsumsi teh / kopi bersamaan dengan TTD",
                    "Konsumsi sayur hijau dan hati ayam"
                ],
                "citation": citation
            })
        elif "BBLR" in f_name:
            recs.append({
                "title": "Perawatan Metode Kanguru (PMK) dan Pemantauan Suhu",
                "category": "NEONATAL",
                "recommendation_text": "Edukasi keluarga untuk menerapkan Perawatan Metode Kanguru guna mencegah hipotermia pada bayi BBLR.",
                "action_steps": [
                    "Kontak kulit ke kulit (skin-to-skin) secara rutin",
                    "Berikan ASI eksklusif setiap 2 jam",
                    "Tunda memandikan hingga berat badan stabil"
                ],
                "citation": citation
            })
        else:
            recs.append({
                "title": "Edukasi dan Pemantauan Rutin Posyandu",
                "category": "EDUKASI",
                "recommendation_text": "Tingkatkan pemantauan tumbuh kembang dan kehadiran di Posyandu setiap bulan.",
                "action_steps": ["Kunjungan rutin Posyandu", "Konseling gizi keluarga"],
                "citation": citation
            })
            
    return recs

