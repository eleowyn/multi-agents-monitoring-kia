from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models.revision import RevisionRequest, RevisionStatus
from app.models.visit import Visit, PhaseEnum
from app.models.patient import Patient, PatientType
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.schemas.revision import RevisionCreate, RevisionValidationRequest, RevisionResponse
from app.api.v1.endpoints.auth import get_current_user
from app.multiagent.graph import kia_multiagent_app
from app.services.eval_logger import log_multiagent_parallel_evaluations

router = APIRouter()


def _require_admin(user: User = Depends(get_current_user)):
    if user.role not in (UserRole.ADMIN, UserRole.DOKTER):
        raise HTTPException(status_code=403, detail="Akses dibatasi khusus Administrator Puskesmas atau Dokter.")
    return user


def _snapshot_visit_data(visit: Visit, patient: Optional[Patient] = None) -> Dict[str, Any]:
    return {
        "patient_name": patient.name if patient else (visit.patient.name if (visit and visit.patient) else None),
        "patient_nik": patient.nik if patient else (visit.patient.nik if (visit and visit.patient) else None),
        "village_name": patient.village_name if patient else (visit.patient.village_name if (visit and visit.patient) else None),
        "visit_date": str(visit.visit_date),
        "phase": visit.phase.value if hasattr(visit.phase, "value") else str(visit.phase),
        "gestational_age_weeks": visit.gestational_age_weeks,
        "trimester": visit.trimester,
        "maternal_weight_kg": visit.maternal_weight_kg,
        "maternal_height_cm": visit.maternal_height_cm,
        "lila_cm": visit.lila_cm,
        "hb_level": visit.hb_level,
        "systolic_bp": visit.systolic_bp,
        "diastolic_bp": visit.diastolic_bp,
        "fundal_height_cm": visit.fundal_height_cm,
        "ttd_consumption": visit.ttd_consumption,
        "kspr_answers": visit.kspr_answers or [],
        "birth_weight_gram": visit.birth_weight_gram,
        "birth_length_cm": visit.birth_length_cm,
        "head_circumference_cm": visit.head_circumference_cm,
        "gestational_age_at_birth_weeks": visit.gestational_age_at_birth_weeks,
        "early_initiation_breastfeeding": visit.early_initiation_breastfeeding,
        "age_in_months": visit.age_in_months,
        "child_weight_kg": visit.child_weight_kg,
        "child_length_cm": visit.child_length_cm,
        "child_head_circumference_cm": visit.child_head_circumference_cm,
        "weight_trend_kms": visit.weight_trend_kms,
        "feeding_status": visit.feeding_status,
        "vitamin_a": visit.vitamin_a,
        "immunization_status": visit.immunization_status,
        "clinical_notes": visit.clinical_notes
    }


def _enrich_revision_response(rev: RevisionRequest, db: Session) -> RevisionResponse:
    visit = db.query(Visit).filter(Visit.id == rev.visit_id).first() if rev.visit_id else None
    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first() if visit else None
    kader = db.query(User).filter(User.id == rev.kader_id).first()
    admin = db.query(User).filter(User.id == rev.admin_id).first() if rev.admin_id else None

    prev = rev.previous_data or {}
    p_name = patient.name if patient else prev.get("patient_name")
    p_nik = patient.nik if patient else prev.get("patient_nik")
    v_date = str(visit.visit_date) if visit else prev.get("visit_date")
    phase = (visit.phase.value if (visit and hasattr(visit.phase, "value")) else str(visit.phase)) if visit else prev.get("phase")
    v_village = patient.village_name if patient else (prev.get("village_name") or (kader.village_name if kader else None))

    return RevisionResponse(
        id=rev.id,
        visit_id=rev.visit_id,
        report_id=rev.report_id,
        kader_id=rev.kader_id,
        admin_id=rev.admin_id,
        reason=rev.reason,
        proposed_data=rev.proposed_data or {},
        previous_data=rev.previous_data or {},
        status=rev.status,
        admin_notes=rev.admin_notes,
        created_at=rev.created_at,
        resolved_at=rev.resolved_at,
        kader_name=kader.full_name if kader else None,
        admin_name=admin.full_name if admin else None,
        patient_name=p_name,
        patient_nik=p_nik,
        village_name=v_village,
        visit_date=v_date,
        phase=phase
    )


@router.post("/", response_model=RevisionResponse)
def submit_revision_request(
    rev_in: RevisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kader mengajukan revisi atau penghapusan data kunjungan yang telah tersimpan (Bab 4 Tabel 16).
    Data kunjungan yang ada di-snapshot dan pengajuan disimpan dengan status PENDING.
    """
    visit = db.query(Visit).filter(Visit.id == rev_in.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Data kunjungan tidak ditemukan.")

    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien terkait kunjungan tidak ditemukan.")

    # Data Scoping: Pastikan kader melayani di desa yang sama
    from app.services.aggregates import in_kader_scope
    if not in_kader_scope(patient, current_user):
        raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    # Cek jika sudah ada pengajuan pending untuk kunjungan ini
    existing_pending = db.query(RevisionRequest).filter(
        RevisionRequest.visit_id == visit.id,
        RevisionRequest.status == RevisionStatus.PENDING
    ).first()
    if existing_pending:
        raise HTTPException(
            status_code=400,
            detail="Kunjungan ini masih memiliki pengajuan revisi yang menunggu validasi Admin Puskesmas."
        )

    # Cari laporan terkait jika ada
    report = db.query(Report).filter(Report.visit_id == visit.id).order_by(Report.id.desc()).first()

    new_rev = RevisionRequest(
        visit_id=visit.id,
        report_id=report.id if report else None,
        kader_id=current_user.id,
        reason=rev_in.reason,
        proposed_data=rev_in.proposed_data,
        previous_data=_snapshot_visit_data(visit, patient),
        status=RevisionStatus.PENDING
    )
    db.add(new_rev)
    db.commit()
    db.refresh(new_rev)

    return _enrich_revision_response(new_rev, db)



@router.get("/", response_model=List[RevisionResponse])
def get_revision_requests(
    status: Optional[RevisionStatus] = None,
    village_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mengambil daftar pengajuan revisi:
    - Kader: hanya melihat pengajuan dari wilayah Posyandu binaannya.
    - Admin: melihat semua pengajuan lintas 9 desa Puskesmas Airmadidi.
    """
    query = db.query(RevisionRequest)

    if current_user.role == UserRole.KADER:
        query = query.filter(RevisionRequest.kader_id == current_user.id)
    elif village_name:
        # Filter berdasarkan desa pasien
        query = query.join(Visit, RevisionRequest.visit_id == Visit.id)\
                     .join(Patient, Visit.patient_id == Patient.id)\
                     .filter(Patient.village_name == village_name)

    if status:
        query = query.filter(RevisionRequest.status == status)

    revisions = query.order_by(RevisionRequest.id.desc()).offset(skip).limit(limit).all()
    return [_enrich_revision_response(r, db) for r in revisions]


@router.get("/{revision_id}", response_model=RevisionResponse)
def get_revision_detail(
    revision_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rev = db.query(RevisionRequest).filter(RevisionRequest.id == revision_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Pengajuan revisi tidak ditemukan.")

    if current_user.role == UserRole.KADER and rev.kader_id != current_user.id:
        from app.services.aggregates import in_kader_scope
        visit = db.query(Visit).filter(Visit.id == rev.visit_id).first() if rev.visit_id else None
        patient = db.query(Patient).filter(Patient.id == visit.patient_id).first() if visit else None
        if not patient or not in_kader_scope(patient, current_user):
            raise HTTPException(status_code=403, detail="Akses ditolak: Pengajuan revisi di luar wilayah kerja Posyandu Anda.")

    return _enrich_revision_response(rev, db)


@router.post("/{revision_id}/validate", response_model=RevisionResponse)
def validate_revision_by_admin(
    revision_id: int,
    val_req: RevisionValidationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """
    Admin Puskesmas memvalidasi pengajuan revisi (Bab 4 Tabel 17 & Gambar 29):
    - Jika APPROVED: Memperbarui data kunjungan asli di MySQL, dan jika ada laporan,
      menjalankan re-evaluasi AI agar flag risiko & rekomendasi sinkron dengan data baru.
    - Jika REJECTED: Menolak usulan revisi dengan mencatat catatan penolakan admin.
    """
    rev = db.query(RevisionRequest).filter(RevisionRequest.id == revision_id).first()
    if not rev:
        raise HTTPException(status_code=404, detail="Pengajuan revisi tidak ditemukan.")

    if rev.status != RevisionStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Pengajuan revisi sudah berstatus {rev.status.value}.")

    visit = db.query(Visit).filter(Visit.id == rev.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Data kunjungan asli tidak ditemukan.")

    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()

    if val_req.status == RevisionStatus.APPROVED:
        proposed = rev.proposed_data or {}

        # 1. Penanganan Pengajuan Hapus Kunjungan (Use Case 8 & 9)
        if proposed.get("_action") == "DELETE":
            if rev.report_id:
                db.query(AuditLog).filter(AuditLog.report_id == rev.report_id).delete(synchronize_session=False)
                db.query(RevisionRequest).filter(RevisionRequest.report_id == rev.report_id).update(
                    {"report_id": None}, synchronize_session=False
                )
                db.query(Report).filter(Report.id == rev.report_id).delete(synchronize_session=False)

            # Lepaskan relasi agar Visit terhapus tanpa ikut meng-cascade RevisionRequest
            db.query(RevisionRequest).filter(RevisionRequest.visit_id == visit.id).update(
                {"visit_id": None}, synchronize_session=False
            )
            rev.visit = None
            rev.visit_id = None
            rev.report_id = None
            db.flush()
            db.delete(visit)
            rev.status = RevisionStatus.APPROVED
        else:
            # 2. Penanganan Koreksi / Modifikasi Data Kunjungan
            # Validasi tipe nilai usulan dengan skema kunjungan, lalu cek fase & kewajaran biologis
            from app.schemas.visit import VisitCreate
            from app.api.v1.endpoints.visits import validate_visit_phase, _months_between
            from app.multiagent.tools.hpk_tracker import check_visit_plausibility

            allowed = set(VisitCreate.model_fields) - {"patient_id"}
            merged = {f: getattr(visit, f) for f in allowed}
            merged.update({k: v for k, v in proposed.items() if k in allowed})
            try:
                validated = VisitCreate(patient_id=visit.patient_id, **merged)
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"Data usulan revisi tidak valid: {e}")

            child_births = [c.birth_date for c in db.query(Patient).filter(Patient.mother_id == patient.id).all()]
            phase_error = validate_visit_phase(
                patient, validated.phase, validated.visit_date,
                validated.gestational_age_weeks, validated.trimester, child_births,
            )
            if phase_error:
                raise HTTPException(status_code=422, detail=f"Revisi tidak dapat disetujui: {phase_error}")
            if patient.patient_type == PatientType.CHILD and validated.phase == PhaseEnum.BADUTA and patient.birth_date:
                validated.age_in_months = _months_between(patient.birth_date, validated.visit_date)

            phase_val = validated.phase.value if hasattr(validated.phase, "value") else str(validated.phase)
            plaus = check_visit_plausibility(phase_val, validated.model_dump())
            if not plaus["is_plausible"]:
                raise HTTPException(
                    status_code=422,
                    detail="Revisi tidak dapat disetujui karena data di luar batas biologis wajar:\n"
                    + "\n".join(f"{i + 1}. {w}" for i, w in enumerate(plaus["warnings"])),
                )

            for field in proposed:
                if field in allowed:
                    setattr(visit, field, getattr(validated, field))
            if patient.patient_type == PatientType.CHILD and validated.phase == PhaseEnum.BADUTA and patient.birth_date:
                visit.age_in_months = validated.age_in_months

            visit.updated_at = datetime.utcnow()

            # Re-evaluasi laporan jika laporan sudah ada
            if rev.report_id:
                report = db.query(Report).filter(Report.id == rev.report_id).first()
                if report:
                    from app.multiagent.state_builder import build_initial_state

                    initial_state = build_initial_state(
                        db=db,
                        visit=visit,
                        patient=patient,
                        village_fallback="Airmadidi",
                        kader_feedback=f"[DATA DIREVISI & DISETUJUI ADMIN]: {val_req.admin_notes or '-'}",
                        iteration_count=0
                    )

                    # Jalankan ulang graf dari awal pada thread baru (state lama tidak terbawa)
                    thread_config = {"configurable": {"thread_id": f"visit_{report.visit_id}_admrev{rev.id}"}}
                    revised_state = kia_multiagent_app.invoke(initial_state, config=thread_config)
                    if revised_state.get("is_data_plausible") is False:
                        db.rollback()
                        warnings = revised_state.get("plausibility_warnings") or []
                        raise HTTPException(
                            status_code=422,
                            detail="Revisi dibatalkan: analisis ulang menolak data karena di luar batas biologis wajar:\n"
                            + "\n".join(f"{i + 1}. {w}" for i, w in enumerate(warnings)),
                        )

                    report.risk_flags = revised_state.get("risk_flags", [])
                    report.risk_narrative = revised_state.get("risk_narrative", "")
                    report.recommendations = revised_state.get("recommendations", [])
                    report.verification_summary = revised_state.get("verification_details", [])
                    report.overall_status = revised_state.get("overall_status", report.overall_status)
                    report.final_report_json = revised_state.get("final_report_json", {})
                    report.updated_at = datetime.utcnow()

                    report.status = ReportStatus.DRAFT
                    report.revision_count = max(int(report.revision_count or 0), 1)
                    report.validated_at = None
                    report.pdf_path = None

                    db.query(AuditLog).filter(AuditLog.report_id == report.id).delete(synchronize_session=False)
                    if background_tasks is not None:
                        background_tasks.add_task(
                            log_multiagent_parallel_evaluations,
                            report_id=report.id,
                            initial_state=initial_state,
                            final_state=revised_state,
                            db=None,
                        )
                    else:
                        log_multiagent_parallel_evaluations(
                            report_id=report.id,
                            initial_state=initial_state,
                            final_state=revised_state,
                            db=db,
                        )

            rev.status = RevisionStatus.APPROVED

    elif val_req.status == RevisionStatus.REJECTED:
        rev.status = RevisionStatus.REJECTED


    rev.admin_id = admin.id
    rev.admin_notes = val_req.admin_notes
    rev.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(rev)

    return _enrich_revision_response(rev, db)
