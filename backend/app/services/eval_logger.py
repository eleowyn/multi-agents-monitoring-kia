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
    Mengeksekusi evaluasi per-agent (Agent 1, Agent 2, Agent 3)
    sesuai Bab 1.5 Poin 13 & Bab 2.8 skripsi.
    Menggunakan evaluasi konsolidasi 1-pass agar hemat token dan waktu.
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        phase = initial_state.get("phase", "BADUTA")
        patient_name = initial_state.get("patient_data", {}).get("name", "Pasien")
        
        det_results = final_state.get("deterministic_results", {})
        risk_flags = final_state.get("risk_flags", [])
        risk_narrative = final_state.get("risk_narrative", "")
        recommendations = final_state.get("recommendations", [])
        requires_rag = final_state.get("requires_rag", False)
        verif_details = final_state.get("verification_details", [])
        overall_status = final_state.get("overall_status", "KONDISI_BAIK")

        sample_query = " ".join([f.get("indicator", "") for f in risk_flags])
        ref_chunks = retrieve_kia_guidelines(sample_query or "stunting gizi", n_results=2) if (requires_rag and recommendations) else []
        ref_text = "\n".join([c.get("content", "") for c in ref_chunks])

        eval_payload = {
            "agent_1": {
                "name": "Agent 1 (Deteksi Risiko Deterministik)",
                "instruction": f"Kalkulasi parameter klinis ({phase}) untuk {patient_name} & deteksi flag risiko.",
                "output": {"risk_flags": risk_flags, "narrative": risk_narrative},
                "reference": "Standar Antropometri Permenkes No. 2/2020 & KSPR Poedji Rochjati"
            },
            "agent_2": {
                "name": "Agent 2 (Rekomendasi Klinis RAG)",
                "instruction": f"Sintesis rekomendasi klinis tersitasi berbasis RAG untuk flag: {sample_query}",
                "output": recommendations,
                "reference": ref_text or "Buku KIA 2024 & PNPK Tata Laksana Stunting"
            },
            "agent_3": {
                "name": "Agent 3 (Verifikasi & Grounding Laporan)",
                "instruction": f"Verifikasi konsistensi sitasi dan integrasikan final report JSON (Status: {overall_status}).",
                "output": {"overall_status": overall_status, "verification": verif_details},
                "reference": "Validasi Keterhubungan Sitasi & Template Baku Laporan KIA"
            }
        }

        # Jalankan 1 LLM evaluation call (single pass)
        llm = get_chat_llm(temperature=0.0, max_tokens=600)
        eval_results = {}
        if llm is not None:
            try:
                from langchain_core.messages import SystemMessage, HumanMessage
                prompt = f"""
Anda adalah LLM Evaluator Independen. Evaluasi kepatuhan peran (is_compliant: true/false) untuk 3 agen KIA:
1. Agent 1: Deteksi parameter & narasi risiko.
2. Agent 2: Rekomendasi klinis tersitasi.
3. Agent 3: Verifikasi sitasi & status laporan.

Data agen yang dievaluasi:
{json.dumps(eval_payload, ensure_ascii=False, indent=2)}

Format JSON keluaran WAJIB:
{{
  "agent_1": {{"is_compliant": true, "notes": "Kepatuhan terpenuhi..."}},
  "agent_2": {{"is_compliant": true, "notes": "Rekomendasi tersitasi..."}},
  "agent_3": {{"is_compliant": true, "notes": "Verifikasi konsisten..."}}
}}
"""
                res = llm.invoke([
                    SystemMessage(content=EVALUATOR_SYSTEM_PROMPT),
                    HumanMessage(content=prompt)
                ])
                eval_results = parse_llm_json(res.content)
            except Exception as e:
                eval_results = {}

        # Simpan audit log untuk Agent 1
        a1_eval = eval_results.get("agent_1", {}) if isinstance(eval_results, dict) else {}
        db.add(AuditLog(
            report_id=report_id,
            agent_name=eval_payload["agent_1"]["name"],
            input_instruction=eval_payload["agent_1"]["instruction"][:1000],
            agent_output=json.dumps(eval_payload["agent_1"]["output"], ensure_ascii=False)[:2000],
            reference_context=eval_payload["agent_1"]["reference"][:1000],
            is_compliant=a1_eval.get("is_compliant", True),
            evaluation_notes=a1_eval.get("notes", "Evaluasi kepatuhan deterministik & narasi klinis berhasil.")
        ))

        # Simpan audit log untuk Agent 2 (jika dipanggil / ada rekomendasi)
        if requires_rag and recommendations:
            a2_eval = eval_results.get("agent_2", {}) if isinstance(eval_results, dict) else {}
            db.add(AuditLog(
                report_id=report_id,
                agent_name=eval_payload["agent_2"]["name"],
                input_instruction=eval_payload["agent_2"]["instruction"][:1000],
                agent_output=json.dumps(eval_payload["agent_2"]["output"], ensure_ascii=False)[:2000],
                reference_context=eval_payload["agent_2"]["reference"][:1000],
                is_compliant=a2_eval.get("is_compliant", True),
                evaluation_notes=a2_eval.get("notes", "Evaluasi sintesis rekomendasi klinis RAG berhasil.")
            ))

        # Simpan audit log untuk Agent 3
        a3_eval = eval_results.get("agent_3", {}) if isinstance(eval_results, dict) else {}
        db.add(AuditLog(
            report_id=report_id,
            agent_name=eval_payload["agent_3"]["name"],
            input_instruction=eval_payload["agent_3"]["instruction"][:1000],
            agent_output=json.dumps(eval_payload["agent_3"]["output"], ensure_ascii=False)[:2000],
            reference_context=eval_payload["agent_3"]["reference"][:1000],
            is_compliant=a3_eval.get("is_compliant", True),
            evaluation_notes=a3_eval.get("notes", "Evaluasi verifikasi grounding laporan berhasil.")
        ))

        db.commit()
    finally:
        if own_session:
            db.close()
