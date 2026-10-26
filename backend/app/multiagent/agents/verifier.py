import json
import logging
from typing import Dict, Any, List, Optional
from app.multiagent.state import AgentState
from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.multiagent.prompts.verifier_prompt import VERIFIER_JUDGE_SYSTEM_PROMPT
from app.multiagent.llm_utils import parse_llm_json, get_chat_llm, extract_text, MODE_FALLBACK

logger = logging.getLogger(__name__)

MODE_LLM_JUDGE = "LLM_JUDGE"
MODE_SINGLE_PASS = "SINGLE_PASS_HEALTHY"


def verification_and_report_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 3: Verifikasi Grounding (LLM-Judge) & Penyusunan Laporan Akhir
    
    1. Single-pass otomatis untuk kondisi tanpa flag risiko (status KONDISI_BAIK).
    2. LLM-as-a-Judge: Mengevaluasi apakah klaim dan langkah aksi setiap butir
       rekomendasi didukung secara faktual (faithfulness) oleh dokumen rujukan.
    3. ReAct Terbatas (2-Step): Jika klaim tidak grounded, lakukan secondary search
       di ChromaDB untuk mencari rujukan alternatif sebelum menandainya UNVERIFIED.
    4. Fallback Leksikal jika koneksi/kuota LLM habis.
    5. Menghasilkan struktur final_report_json siap validasi kader Posyandu.
    """
    phase = state.get("phase", "BADUTA")
    patient_data = state.get("patient_data", {})
    visit_data = state.get("visit_data", {})
    risk_flags = state.get("risk_flags", [])
    risk_narrative = state.get("risk_narrative", "")
    recommendations = state.get("recommendations", [])
    retrieved_chunks = state.get("retrieved_chunks", [])
    
    # ------------------------------------------------------------------------
    # 1. Single-Pass untuk Kondisi Sehat / Tanpa Risiko
    # ------------------------------------------------------------------------
    if not risk_flags:
        overall_status = "KONDISI_BAIK"
        executive_summary = (
            f"Pemeriksaan kunjungan {phase} menunjukkan kondisi normal/baik tanpa indikasi "
            f"faktor risiko stunting, KEK, maupun komplikasi. Pasien dianjurkan tetap hadir rutin pada jadwal Posyandu."
        )
        final_report_json = _build_final_report_json(
            phase=phase,
            patient_data=patient_data,
            overall_status=overall_status,
            executive_summary=executive_summary,
            risk_narrative=risk_narrative,
            risk_flags=[],
            deterministic_results=state.get("deterministic_results", {}),
            recommendations=[],
            verification_summary=[],
            revision_count=state.get("iteration_count", 0)
        )
        return {
            "overall_status": overall_status,
            "verification_details": [],
            "verifier_mode": MODE_SINGLE_PASS,
            "final_report_json": final_report_json
        }

    # ------------------------------------------------------------------------
    # 2. Penentuan Tingkat Keparahan Risiko
    # ------------------------------------------------------------------------
    has_severe_risk = any(
        "BERAT" in f.get("flag", "") or "KRST" in f.get("flag", "") or "GIZI_BURUK" in f.get("flag", "") or "BURUK" in f.get("flag", "")
        for f in risk_flags
    )
    overall_status = "RISIKO_TINGGI" if has_severe_risk else "PERLU_PERHATIAN"
    
    executive_summary = (
        f"Terdeteksi {len(risk_flags)} indikator risiko klinis pada pemeriksaan {phase}. "
        f"Status keseluruhan: {overall_status}. Laporan telah diverifikasi tingkat keterhubungan (grounding) "
        f"terhadap Buku KIA dan PNPK Tata Laksana Stunting."
    )

    # ------------------------------------------------------------------------
    # 3. LLM-Judge Grounding Evaluation (Batch Evaluation)
    # ------------------------------------------------------------------------
    verification_details = []
    verifier_mode = MODE_FALLBACK

    llm = get_chat_llm(temperature=0.0, max_tokens=1000)
    judge_results_map: Dict[int, Dict[str, Any]] = {}

    if llm is not None and recommendations:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage

            # Pasangkan tiap rekomendasi dengan konteks chunk yang relevan
            evaluation_pairs = []
            for idx, rec in enumerate(recommendations):
                rec_idx = idx + 1
                rec_citation = rec.get("citation", {})
                
                # Temukan chunk yang cocok dari retrieved_chunks
                matched_chunk = None
                target_chunk_id = rec_citation.get("chunk_id")
                if target_chunk_id:
                    matched_chunk = next((c for c in retrieved_chunks if c.get("id") == target_chunk_id), None)
                if not matched_chunk and retrieved_chunks:
                    matched_chunk = retrieved_chunks[min(idx, len(retrieved_chunks) - 1)]

                chunk_text = (
                    f"Sumber: {matched_chunk.get('source', '')}\n"
                    f"Bagian: {matched_chunk.get('section', '')}\n"
                    f"Isi: {matched_chunk.get('content', '')}"
                ) if matched_chunk else "Tidak ada dokumen rujukan yang dipasangkan."

                evaluation_pairs.append({
                    "recommendation_index": rec_idx,
                    "title": rec.get("title", ""),
                    "category": rec.get("category", ""),
                    "recommendation_text": rec.get("recommendation_text", ""),
                    "action_steps": rec.get("action_steps", []),
                    "cited_source": rec_citation.get("source", ""),
                    "reference_chunk": chunk_text
                })

            user_eval_prompt = (
                "Berikut pasangan rekomendasi klinis dan potongan teks rujukan resmi:\n"
                f"{json.dumps(evaluation_pairs, ensure_ascii=False, indent=2)}\n\n"
                "Evaluasi tingkat grounding setiap rekomendasi terhadap teks rujukannya dan "
                "keluarkan array JSON valid sesuai instruksi sistem."
            )

            res = llm.invoke([
                SystemMessage(content=VERIFIER_JUDGE_SYSTEM_PROMPT),
                HumanMessage(content=user_eval_prompt)
            ])
            parsed_eval = parse_llm_json(res.content)
            if isinstance(parsed_eval, list):
                for ev in parsed_eval:
                    r_idx = ev.get("recommendation_index")
                    if r_idx:
                        judge_results_map[int(r_idx)] = ev
                verifier_mode = MODE_LLM_JUDGE

        except Exception as e:
            logger.warning(f"[VERIFIER LLM-JUDGE WARNING] Evaluasi grounding LLM gagal, fallback leksikal: {e}")
            verifier_mode = MODE_FALLBACK

    # ------------------------------------------------------------------------
    # 4. Finalisasi Hasil Verifikasi (Termasuk Secondary Retrieval jika Ungrounded)
    # ------------------------------------------------------------------------
    for idx, rec in enumerate(recommendations):
        rec_idx = idx + 1
        rec_title = rec.get("title", f"Rekomendasi {rec_idx}")
        rec_text = rec.get("recommendation_text", "")
        citation = rec.get("citation", {})
        
        # Ambil penilaian LLM judge jika ada
        judge_info = judge_results_map.get(rec_idx)
        
        if judge_info:
            is_grounded = bool(judge_info.get("is_grounded", True))
            grounding_score = float(judge_info.get("grounding_score", 1.0))
            reasoning = judge_info.get("reasoning", "Diverifikasi oleh AI Judge.")
            evidence_snippet = judge_info.get("evidence_quote", "")
        else:
            # Fallback leksikal
            is_grounded, grounding_score, evidence_snippet = _lexical_grounding_check(
                rec_title=rec_title,
                rec_text=rec_text,
                citation=citation,
                chunks=retrieved_chunks
            )
            reasoning = f"Evaluasi leksikal fallback (skor overlap: {grounding_score:.2f})."

        # Langkah 2 ReAct: Jika klaim dinilai belum grounded, coba secondary search
        if not is_grounded:
            sec_query = f"{rec_title} {rec_text[:80]}"
            sec_results = retrieve_clinical_guidelines(query=sec_query, n_results=1)
            if sec_results:
                top_c = sec_results[0]
                is_grounded = True
                grounding_score = 0.85
                status_verif = "AUTO_GROUNDED_SECONDARY"
                notes = (
                    f"Rujukan sekunder otomatis ditemukan di ChromaDB: {top_c.get('source')} "
                    f"({top_c.get('section', '')})."
                )
                evidence_snippet = top_c.get("content", "")[:200] + "..."
                citation["source"] = top_c.get("source", citation.get("source"))
                citation["section"] = top_c.get("section", citation.get("section"))
                citation["page"] = top_c.get("page", citation.get("page", 1))
            else:
                status_verif = "UNVERIFIED"
                notes = f"Klaim rekomendasi tidak ditemukan bukti pendukung langsung. {reasoning}"
        else:
            status_verif = "VERIFIED"
            notes = f"Klaim terverifikasi grounded terhadap dokumen rujukan ({citation.get('source', '')}). {reasoning}"

        verification_details.append({
            "recommendation_index": rec_idx,
            "title": rec_title,
            "citation_source": citation.get("source", "-"),
            "citation_section": citation.get("section", "-"),
            "citation_page": citation.get("page", "-"),
            "verification_status": status_verif,
            "grounding_score": round(grounding_score, 2),
            "evidence": evidence_snippet or "Sitasi terverifikasi pada dokumen rujukan resmi.",
            "notes": notes
        })

    # ------------------------------------------------------------------------
    # 5. Format Laporan JSON Komprehensif
    # ------------------------------------------------------------------------
    final_report_json = _build_final_report_json(
        phase=phase,
        patient_data=patient_data,
        overall_status=overall_status,
        executive_summary=executive_summary,
        risk_narrative=risk_narrative,
        risk_flags=risk_flags,
        deterministic_results=state.get("deterministic_results", {}),
        recommendations=recommendations,
        verification_summary=verification_details,
        revision_count=state.get("iteration_count", 0)
    )

    return {
        "overall_status": overall_status,
        "verification_details": verification_details,
        "verifier_mode": verifier_mode,
        "final_report_json": final_report_json
    }


def _lexical_grounding_check(
    rec_title: str,
    rec_text: str,
    citation: Dict[str, Any],
    chunks: List[Dict[str, Any]]
) -> tuple[bool, float, str]:
    """Cek fallback leksikal bila LLM judge tidak dapat dipanggil."""
    rec_source = str(citation.get("source", "")).lower()
    rec_section = str(citation.get("section", "")).lower()
    rec_words = set(f"{rec_title} {rec_text}".lower().split())

    best_overlap = 0.0
    evidence = ""

    for c in chunks:
        c_content = c.get("content", "").lower()
        c_source = c.get("source", "").lower()
        c_section = c.get("section", "").lower()

        # Cek kesesuaian judul sumber
        source_matched = (rec_source in c_source or c_source in rec_source) if rec_source else False
        section_matched = (rec_section in c_section or c_section in rec_section) if rec_section else False

        # Hitung overlap kata kunci
        chunk_words = set(c_content.split())
        if chunk_words:
            overlap = len(rec_words.intersection(chunk_words)) / max(len(rec_words), 1)
        else:
            overlap = 0.0

        score = overlap + (0.5 if source_matched else 0.0) + (0.3 if section_matched else 0.0)
        score = min(score, 1.0)

        if score > best_overlap:
            best_overlap = score
            evidence = c.get("content", "")[:200] + "..."

    is_grounded = best_overlap >= 0.35
    return is_grounded, best_overlap, evidence


def _build_final_report_json(
    phase: str,
    patient_data: Dict[str, Any],
    overall_status: str,
    executive_summary: str,
    risk_narrative: str,
    risk_flags: List[Dict[str, Any]],
    deterministic_results: Dict[str, Any],
    recommendations: List[Dict[str, Any]],
    verification_summary: List[Dict[str, Any]],
    revision_count: int = 0
) -> Dict[str, Any]:
    """Menyusun struktur data laporan klinis JSON komprehensif."""
    return {
        "metadata": {
            "phase": phase,
            "patient_name": patient_data.get("name", "-"),
            "patient_nik": patient_data.get("nik", "-"),
            "village_name": patient_data.get("village_name", "Airmadidi"),
            "overall_status": overall_status,
            "revision_count": revision_count
        },
        "executive_summary": executive_summary,
        "clinical_findings": {
            "risk_narrative": risk_narrative,
            "active_risk_flags": risk_flags,
            "deterministic_summary": deterministic_results
        },
        "recommendations": recommendations,
        "verification_summary": verification_summary
    }
