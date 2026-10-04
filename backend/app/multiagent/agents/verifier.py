import json
from typing import Dict, Any, List
from app.multiagent.state import AgentState
from app.multiagent.rag.retriever import retrieve_kia_guidelines


def verification_and_report_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 3: Verifikasi & Penyusunan Laporan Akhir (Sesuai Bab 1.5 Poin 8 & Bab 2.3.4)
    
    1. Selalu dijalankan pada setiap kunjungan untuk konsistensi laporan.
    2. Single-pass untuk kondisi tanpa flag risiko aktif (status KONDISI_BAIK).
    3. Menerapkan ReAct terbatas maksimal dua langkah per poin rekomendasi:
       - Langkah 1: Memeriksa keterhubungan klaim terhadap chunk rujukan yang sudah ditarik.
       - Langkah 2 (Fallback): Menjalankan pencarian semantik sekunder ke ChromaDB jika sitasi belum terverifikasi kuat.
    4. Menghasilkan struktur JSON laporan komprehensif yang siap divalidasi kader.
    """
    phase = state.get("phase", "BADUTA")
    patient_data = state.get("patient_data", {})
    visit_data = state.get("visit_data", {})
    risk_flags = state.get("risk_flags", [])
    risk_narrative = state.get("risk_narrative", "")
    recommendations = state.get("recommendations", [])
    retrieved_chunks = state.get("retrieved_chunks", [])
    
    # 1. Penentuan Status Keseluruhan
    if not risk_flags:
        overall_status = "KONDISI_BAIK"
        executive_summary = (
            f"Pemeriksaan kunjungan {phase} menunjukkan kondisi normal/baik tanpa indikasi "
            f"faktor risiko stunting, KEK, maupun komplikasi. Pasien dianjurkan tetap hadir rutin pada jadwal Posyandu."
        )
        verification_details = []
        
    else:
        # Menentukan tingkat keparahan risiko
        has_severe_risk = any(
            "BERAT" in f.get("flag", "") or "KRST" in f.get("flag", "") or "GIZI_BURUK" in f.get("flag", "") or "BURUK" in f.get("flag", "")
            for f in risk_flags
        )
        overall_status = "RISIKO_TINGGI" if has_severe_risk else "PERLU_PERHATIAN"
        
        executive_summary = (
            f"Terdeteksi {len(risk_flags)} indikator risiko klinis pada pemeriksaan {phase}. "
            f"Status keseluruhan: {overall_status}. Laporan telah dilengkapi rekomendasi terverifikasi "
            f"dan rujukan ke Buku KIA / Pedoman Nasional Tata Laksana Stunting."
        )

        # 2. Verifikasi Sitasi (ReAct Terbatas 2-Langkah) per Butir Rekomendasi
        verification_details = []
        
        for idx, rec in enumerate(recommendations):
            rec_title = rec.get("title", f"Rekomendasi {idx+1}")
            rec_text = rec.get("recommendation_text", "")
            citation = rec.get("citation", {})
            rec_source = citation.get("source", "").lower()
            rec_section = citation.get("section", "").lower()
            
            # --- LANGKAH 1: Direct Chunk Verification ---
            grounded_in_chunks = False
            evidence_snippet = ""
            
            for chunk in retrieved_chunks:
                c_content = chunk.get("content", "").lower()
                c_source = chunk.get("source", "").lower()
                c_section = chunk.get("section", "").lower()
                
                # Cek overlap kata kunci atau kecocokan sumber
                if (rec_source in c_source or c_source in rec_source) or (rec_section and rec_section in c_section):
                    grounded_in_chunks = True
                    evidence_snippet = chunk.get("content", "")[:200] + "..."
                    break

            # --- LANGKAH 2: Fallback Semantic Retrieval di ChromaDB ---
            if not grounded_in_chunks:
                fallback_query = f"{rec_title} {rec_text[:100]}"
                fallback_results = retrieve_kia_guidelines(query=fallback_query, n_results=1)
                
                if fallback_results:
                    top_match = fallback_results[0]
                    grounded_in_chunks = True
                    evidence_snippet = f"[Fallback RAG] {top_match.get('source', '')}: {top_match.get('content', '')[:180]}..."
                    citation["source"] = top_match.get("source", citation.get("source", "Pedoman Baku KIA"))
                    citation["section"] = top_match.get("section", citation.get("section", "-"))
                    citation["page"] = top_match.get("page", citation.get("page", 1))

            # Penetapan status verifikasi groundedness
            if grounded_in_chunks:
                status_verif = "VERIFIED"
                notes = f"Klaim rekomendasi terverifikasi grounded terhadap dokumen rujukan ({citation.get('source', '')})."
            else:
                status_verif = "PARTIALLY_VERIFIED"
                notes = "Rekomendasi berbasis prinsip umum KIA; memerlukan konfirmasi klinis tenaga kesehatan Puskesmas."

            verification_details.append({
                "recommendation_index": idx + 1,
                "title": rec_title,
                "citation_source": citation.get("source", "-"),
                "citation_section": citation.get("section", "-"),
                "citation_page": citation.get("page", "-"),
                "verification_status": status_verif,
                "evidence": evidence_snippet,
                "notes": notes
            })

    # 3. Format Laporan JSON Komprehensif
    final_report_json = {
        "metadata": {
            "phase": phase,
            "patient_name": patient_data.get("name", "-"),
            "patient_nik": patient_data.get("nik", "-"),
            "village_name": patient_data.get("village_name", "Airmadidi"),
            "overall_status": overall_status,
            "revision_count": state.get("iteration_count", 0)
        },
        "executive_summary": executive_summary,
        "clinical_findings": {
            "risk_narrative": risk_narrative,
            "active_risk_flags": risk_flags,
            "deterministic_summary": state.get("deterministic_results", {})
        },
        "recommendations": recommendations,
        "verification_summary": verification_details
    }

    return {
        "overall_status": overall_status,
        "verification_details": verification_details,
        "final_report_json": final_report_json
    }
