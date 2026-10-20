from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models.revision import RevisionRequest, RevisionStatus
from app.models.visit import Visit
from app.models.patient import Patient, PatientType
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.revision import RevisionCreate, RevisionValidationRequest, RevisionResponse
from app.api.v1.endpoints.auth import get_current_user
from app.multiagent.graph import kia_multiagent_app
from app.services.pdf_service import generate_visit_report_pdf

router = APIRouter()


def _require_admin(user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Akses dibatasi khusus Administrator Puskesmas.")
    return user


def _snapshot_visit_data(visit: Visit) -> Dict[str, Any]:
    return {
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
    visit = db.query(Visit).filter(Visit.id == rev.visit_id).first()
    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first() if visit else None
    kader = db.query(User).filter(User.id == rev.kader_id).first()
    admin = db.query(User).filter(User.id == rev.admin_id).first() if rev.admin_id else None

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
        patient_name=patient.name if patient else None,
        patient_nik=patient.nik if patient else None,
        village_name=patient.village_name if patient else (kader.village_name if kader else None),
        visit_date=str(visit.visit_date) if visit else None,
        phase=visit.phase.value if (visit and hasattr(visit.phase, "value")) else None
    )


@router.post("/", response_model=RevisionResponse)
def submit_revision_request(
    rev_in: RevisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kader mengajukan revisi data kunjungan yang telah tersimpan (Bab 4 Tabel 16).
    Data kunjungan yang ada di-snapshot dan pengajuan disimpan dengan status PENDING.
    """
    visit = db.query(Visit).filter(Visit.id == rev_in.visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Data kunjungan tidak ditemukan.")

    patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien terkait kunjungan tidak ditemukan.")

    # Data Scoping: Pastikan kader melayani di desa yang sama
    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name != current_user.village_name:
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
        previous_data=_snapshot_visit_data(visit),
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

    return _enrich_revision_response(rev, db)


@router.post("/{revision_id}/validate", response_model=RevisionResponse)
def validate_revision_by_admin(
    revision_id: int,
    val_req: RevisionValidationRequest,
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
        # 1. Update data kunjungan asli dengan proposed_data
        proposed = rev.proposed_data or {}
        for field, value in proposed.items():
            if hasattr(visit, field) and field not in ["id", "patient_id", "kader_id", "created_at"]:
                setattr(visit, field, value)

        visit.updated_at = datetime.utcnow()

        # 2. Re-evaluasi laporan jika laporan sudah ada
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

                # Jalankan kembali multi-agent workflow dengan data yang sudah disetujui
                revised_state = kia_multiagent_app.invoke(initial_state)

                report.risk_flags = revised_state.get("risk_flags", [])
                report.risk_narrative = revised_state.get("risk_narrative", "")
                report.recommendations = revised_state.get("recommendations", [])
                report.verification_summary = revised_state.get("verification_details", [])
                report.overall_status = revised_state.get("overall_status", report.overall_status)
                report.final_report_json = revised_state.get("final_report_json", {})
                report.updated_at = datetime.utcnow()

                # Jika sebelumnya sudah berstatus APPROVED, generate ulang PDF resminya
                if report.status == ReportStatus.APPROVED and patient:
                    filename = f"Laporan_KIA_{patient.nik}_{visit.visit_date}_revised.pdf"
                    pdf_path = generate_visit_report_pdf(
                        report_data=report.final_report_json,
                        visit_date=str(visit.visit_date),
                        kader_name=admin.full_name,
                        validated_date=datetime.now().strftime("%d %B %Y"),
                        filename=filename
                    )
                    report.pdf_path = pdf_path

        rev.status = RevisionStatus.APPROVED

    elif val_req.status == RevisionStatus.REJECTED:
        rev.status = RevisionStatus.REJECTED

    rev.admin_id = admin.id
    rev.admin_notes = val_req.admin_notes
    rev.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(rev)

    return _enrich_revision_response(rev, db)
