from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.visit import Visit, PhaseEnum
from app.models.patient import Patient, PatientType
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.visit import VisitCreate, VisitResponse
from app.schemas.report import ReportResponse
from app.api.v1.endpoints.auth import get_current_user
from app.multiagent.graph import kia_multiagent_app
from app.services.eval_logger import log_multiagent_parallel_evaluations

router = APIRouter()


@router.post("/", response_model=ReportResponse)
def create_visit_and_analyze(
    visit_in: VisitCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    1. Mencatat data kunjungan ke MySQL.
    2. Menarik data riwayat longitudinal pasien.
    3. Mengeksekusi orkestrasi Multi-Agent LangGraph secara real-time.
    4. Menyimpan draf laporan.
    5. Mendaftarkan background task evaluasi audit biner per-agent secara paralel.
    """
    patient = db.query(Patient).filter(Patient.id == visit_in.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    # Data Scoping: Pastikan kader melayani pasien di wilayah posyandunya
    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    # 1. Simpan Kunjungan
    visit = Visit(
        patient_id=visit_in.patient_id,
        kader_id=current_user.id,
        visit_date=visit_in.visit_date,
        phase=visit_in.phase,
        gestational_age_weeks=visit_in.gestational_age_weeks,
        trimester=visit_in.trimester,
        maternal_weight_kg=visit_in.maternal_weight_kg,
        maternal_height_cm=visit_in.maternal_height_cm,
        lila_cm=visit_in.lila_cm,
        hb_level=visit_in.hb_level,
        systolic_bp=visit_in.systolic_bp,
        diastolic_bp=visit_in.diastolic_bp,
        fundal_height_cm=visit_in.fundal_height_cm,
        kspr_answers=visit_in.kspr_answers,
        birth_weight_gram=visit_in.birth_weight_gram,
        birth_length_cm=visit_in.birth_length_cm,
        head_circumference_cm=visit_in.head_circumference_cm,
        gestational_age_at_birth_weeks=visit_in.gestational_age_at_birth_weeks,
        early_initiation_breastfeeding=visit_in.early_initiation_breastfeeding,
        age_in_months=visit_in.age_in_months,
        child_weight_kg=visit_in.child_weight_kg,
        child_length_cm=visit_in.child_length_cm,
        child_head_circumference_cm=visit_in.child_head_circumference_cm,
        weight_trend_kms=visit_in.weight_trend_kms,
        feeding_status=visit_in.feeding_status,
        vitamin_a=visit_in.vitamin_a,
        immunization_status=visit_in.immunization_status,
        clinical_notes=visit_in.clinical_notes
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # 2. Persiapkan Context Longitudinal & Shared State melalui state_builder
    from app.multiagent.state_builder import build_initial_state

    initial_state = build_initial_state(
        db=db,
        visit=visit,
        patient=patient,
        village_fallback=current_user.village_name or "Airmadidi",
        kader_feedback=None,
        iteration_count=0
    )

    # 3. Eksekusi Multi-Agent LangGraph (Stateful Checkpointer per Visit ID)
    thread_config = {"configurable": {"thread_id": f"visit_{visit.id}"}}
    final_state = kia_multiagent_app.invoke(initial_state, config=thread_config)

    # 4. Simpan Hasil ke Tabel Reports
    report = Report(
        visit_id=visit.id,
        patient_id=patient.id,
        kader_id=current_user.id,
        risk_flags=final_state.get("risk_flags", []),
        risk_narrative=final_state.get("risk_narrative", ""),
        recommendations=final_state.get("recommendations", []),
        verification_summary=final_state.get("verification_details", []),
        overall_status=final_state.get("overall_status", "KONDISI_BAIK"),
        final_report_json=final_state.get("final_report_json", {}),
        status=ReportStatus.DRAFT,
        revision_count=0
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # 5. Background Task: Evaluasi Paralel Per-Agent (Agent 1, Agent 2, Agent 3)
    background_tasks.add_task(
        log_multiagent_parallel_evaluations,
        report_id=report.id,
        initial_state=initial_state,
        final_state=final_state,
        db=None
    )

    return report
