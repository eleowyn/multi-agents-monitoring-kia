import json
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.audit_log import AuditLog
from app.multiagent.prompts.evaluator_prompt import EVALUATOR_SYSTEM_PROMPT
from app.multiagent.rag.retriever import retrieve_kia_guidelines
from app.multiagent.llm_utils import parse_llm_json, llm_available, get_chat_llm


def log_agent_evaluation(
    db: Session,
    report_id: Optional[int],
    agent_name: str,
    input_instruction: str,
    agent_output: str,
    reference_context: Optional[str] = None
) -> AuditLog:
    """
    Mengevaluasi output agent secara biner (Ya/Tidak) menggunakan pemanggilan
    LLM independen secara paralel dan menyimpannya ke tabel audit_logs.
    Jika evaluasi gagal, is_compliant bernilai None (bukan diasumsikan True).
    """
    is_compliant: Optional[bool] = None
    eval_notes = "Evaluasi otomatis: Belum dievaluasi."

    llm = get_chat_llm(temperature=0.0)
    if llm is not None:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage

            prompt = f"""
Agent yang dievaluasi: {agent_name}
Instruksi Tugas Awal: {input_instruction}
Output yang Dihasilkan Agent: {agent_output}
Konteks Rujukan Standar: {reference_context or 'Pedoman Baku KIA / Standar Antropometri WHO'}

Tugas Evaluator:
Lakukan evaluasi independen secara biner:
1. Apakah output agen mematuhi instruksi peran dan tidak berhalusinasi?
2. Kembalikan HANYA format JSON valid berikut:
{{"is_compliant": true, "notes": "Penjelasan singkat evaluasi kepatuhan"}}
"""
            res = llm.invoke([
                SystemMessage(content=EVALUATOR_SYSTEM_PROMPT),
                HumanMessage(content=prompt)
            ])
            eval_data = parse_llm_json(res.content)
            is_compliant = bool(eval_data.get("is_compliant", True))
            eval_notes = eval_data.get("notes", "Evaluasi berhasil.")

        except Exception as e:
            eval_notes = f"Gagal mengeksekusi LLM Evaluator: {type(e).__name__}: {e}"
            is_compliant = None
    else:
        eval_notes = "Evaluator LLM offline (API key tidak tersedia)."
        is_compliant = None

    audit_entry = AuditLog(
        report_id=report_id,
        agent_name=agent_name,
        input_instruction=input_instruction[:1000],
        agent_output=agent_output[:2000],
        reference_context=reference_context[:1000] if reference_context else None,
        is_compliant=is_compliant,
        evaluation_notes=eval_notes
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)
    return audit_entry


def log_multiagent_parallel_evaluations(
    report_id: int,
    initial_state: Dict[str, Any],
    final_state: Dict[str, Any],
    db: Optional[Session] = None
):
    """
    Mengeksekusi evaluasi paralel per-agent (Agent 1, Agent 2, Agent 3)
    sesuai Bab 1.5 Poin 13 & Bab 2.8 skripsi.
    Menggunakan sesi database mandiri agar aman berjalan di background task.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        phase = initial_state.get("phase", "BADUTA")
        patient_name = initial_state.get("patient_data", {}).get("name", "Pasien")
        
        # 1. Evaluasi Independen Agent 1: Deteksi Risiko
        det_results = final_state.get("deterministic_results", {})
        risk_flags = final_state.get("risk_flags", [])
        risk_narrative = final_state.get("risk_narrative", "")
        
        log_agent_evaluation(
            db=db,
            report_id=report_id,
            agent_name="Agent 1 (Deteksi Risiko Deterministik)",
            input_instruction=f"Kalkulasi eksak parameter klinis ({phase}) untuk {patient_name} & deteksi flag risiko.",
            agent_output=json.dumps({"risk_flags": risk_flags, "narrative": risk_narrative, "deterministik": det_results}, ensure_ascii=False),
            reference_context="Standar Antropometri Anak Permenkes No. 2/2020 & KSPR Poedji Rochjati"
        )

        # 2. Evaluasi Independen Agent 2: Rekomendasi Klinis RAG (jika dipanggil)
        recommendations = final_state.get("recommendations", [])
        requires_rag = final_state.get("requires_rag", False)
        if requires_rag and recommendations:
            sample_query = " ".join([f.get("indicator", "") for f in risk_flags])
            ref_chunks = retrieve_kia_guidelines(sample_query or "stunting gizi", n_results=2)
            ref_text = "\n".join([c.get("content", "") for c in ref_chunks])
            
            log_agent_evaluation(
                db=db,
                report_id=report_id,
                agent_name="Agent 2 (Rekomendasi Klinis RAG)",
                input_instruction=f"Sintesis rekomendasi klinis tersitasi berbasis RAG untuk flag: {sample_query}",
                agent_output=json.dumps(recommendations, ensure_ascii=False),
                reference_context=ref_text or "Buku KIA & PNPK Tata Laksana Stunting"
            )

        # 3. Evaluasi Independen Agent 3: Verifikasi & Laporan Akhir
        verif_details = final_state.get("verification_details", [])
        overall_status = final_state.get("overall_status", "KONDISI_BAIK")
        
        instruksi_agent3 = f"Verifikasi konsistensi sitasi dan integrasikan final report JSON (Status: {overall_status})."
        if overall_status == "KONDISI_BAIK":
            instruksi_agent3 += " Catatan sistem: Pasien berstatus KONDISI_BAIK (sehat tanpa flag risiko), sehingga daftar verifikasi sitasi rekomendasi memang valid dan wajar jika kosong (single-pass)."

        log_agent_evaluation(
            db=db,
            report_id=report_id,
            agent_name="Agent 3 (Verifikasi & Grounding Laporan)",
            input_instruction=instruksi_agent3,
            agent_output=json.dumps({"overall_status": overall_status, "verification": verif_details}, ensure_ascii=False),
            reference_context="Validasi Keterhubungan Sitasi (Groundedness Check) & Template Baku Laporan KIA"
        )
    finally:
        if own_session:
            db.close()
