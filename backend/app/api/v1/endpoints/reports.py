import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models.report import Report, ReportStatus
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.schemas.report import ReportResponse, ReportValidationRequest, ReportListItemResponse
from app.schemas.admin import BulkDeleteRequest
from app.api.v1.endpoints.auth import get_current_user
from app.services.pdf_service import generate_visit_report_pdf
from app.multiagent.graph import kia_multiagent_app

router = APIRouter()


@router.get("/", response_model=List[ReportListItemResponse])
def list_reports(
    status: Optional[ReportStatus] = None,
    overall_status: Optional[str] = None,
    search: Optional[str] = None,
    village_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mengambil daftar laporan KIA untuk arsip kader dan kelola laporan admin (Bab 4 Tabel 19).
    Mendukung filter status, risiko, wilayah/desa, dan rentang tanggal kunjungan.
    """
    query = (
        db.query(Report)
        .join(Patient, Report.patient_id == Patient.id)
        .join(Visit, Report.visit_id == Visit.id)
    )

    if current_user.role == UserRole.KADER and current_user.village_name:
        query = query.filter(Patient.village_name == current_user.village_name)
    elif village_name:
        query = query.filter(Patient.village_name == village_name)

    if status:
        query = query.filter(Report.status == status)

    if overall_status:
        query = query.filter(Report.overall_status == overall_status)

    if start_date:
        query = query.filter(Visit.visit_date >= start_date)

    if end_date:
        query = query.filter(Visit.visit_date <= end_date)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter((Patient.name.ilike(s)) | (Patient.nik.like(s)))

    reports = query.order_by(Report.id.desc()).all()

    results = []
    for r in reports:
        p = r.patient
        v = r.visit
        latest_rev = None
        if v and v.revisions:
            latest_rev = v.revisions[-1].status.value if hasattr(v.revisions[-1].status, "value") else str(v.revisions[-1].status)
        results.append(
            ReportListItemResponse(
                id=r.id,
                visit_id=r.visit_id,
                patient_id=r.patient_id,
                patient_name=p.name if p else None,
                patient_nik=p.nik if p else None,
                patient_type=p.patient_type.value if (p and hasattr(p.patient_type, "value")) else (str(p.patient_type) if p else None),
                village_name=p.village_name if p else None,
                posyandu_name=p.posyandu_name if p else None,
                phase=v.phase.value if (v and hasattr(v.phase, "value")) else (str(v.phase) if v else None),
                visit_date=str(v.visit_date) if v else None,
                overall_status=r.overall_status,
                status=r.status,
                risk_count=len(r.risk_flags) if r.risk_flags else 0,
                revision_count=r.revision_count,
                validated_at=r.validated_at,
                has_pdf=(r.status == ReportStatus.APPROVED),
                latest_revision_status=latest_rev
            )
        )
    return results


def _extract_visit_data(visit: Optional[Visit]) -> Optional[Dict[str, Any]]:
    if not visit:
        return None
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
        "kspr_answers": visit.kspr_answers,
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
        "clinical_notes": visit.clinical_notes,
    }


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        # Fallback check by visit_id in case caller passed visit_id
        report = db.query(Report).filter(Report.visit_id == report_id).order_by(Report.id.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    report.visit_data = _extract_visit_data(report.visit)
    return report


@router.get("/visit/{visit_id}", response_model=ReportResponse)
def get_report_by_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.visit_id == visit_id).order_by(Report.id.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan untuk kunjungan ini belum tersedia.")
    report.visit_data = _extract_visit_data(report.visit)
    return report


@router.post("/{report_id}/validate", response_model=ReportResponse)
def validate_report_by_kader(
    report_id: int,
    val_req: ReportValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Human-in-the-loop validation oleh Kader (Sesuai Bab 1.5.2 Poin 1 & Bab 2.8 Poin 4.iii.f):
    - APPROVE: Mengesahkan laporan dan mencetak dokumen PDF resmi WeasyPrint.
    - REJECT: Memicu maksimal 1x perulangan graf AI dengan menyertakan feedback koreksi kader.
              Jika sudah pernah direvisi 1x, penolakan lanjutan ditolak oleh sistem.
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")

    visit = db.query(Visit).filter(Visit.id == report.visit_id).first()
    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()

    # Data Scoping: Pastikan kader melayani pasien di wilayah posyandunya
    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Laporan ini milik Posyandu desa lain.")

    if val_req.status == ReportStatus.APPROVED:
        report.status = ReportStatus.APPROVED
        report.validated_at = datetime.utcnow()
        report.rejection_reason = None

        # Generate PDF
        filename = f"Laporan_KIA_{patient.nik}_{visit.visit_date}.pdf"
        visit_dict = _extract_visit_data(visit)
        pdf_path = generate_visit_report_pdf(
            report_data=report.final_report_json,
            visit_date=str(visit.visit_date),
            kader_name=current_user.full_name,
            validated_date=datetime.now().strftime("%d %B %Y"),
            filename=filename,
            visit_data=visit_dict
        )
        report.pdf_path = pdf_path

    elif val_req.status == ReportStatus.REJECTED:
        # Pembatasan Satu Kali Revisi (Strict 1-Cycle Limit)
        if report.revision_count >= 1:
            raise HTTPException(
                status_code=400,
                detail="Batas maksimal 1 kali revisi AI telah digunakan. Silakan sahkan laporan atau lakukan rujukan manual ke Puskesmas."
            )

        report.status = ReportStatus.REJECTED
        report.rejection_reason = val_req.rejection_reason
        report.revision_count += 1
        report.validated_at = datetime.utcnow()

        # Eksekusi 1x Loop Revisi Multi-Agent LangGraph
        from app.multiagent.state_builder import build_initial_state

        initial_state = build_initial_state(
            db=db,
            visit=visit,
            patient=patient,
            village_fallback=current_user.village_name or "Airmadidi",
            kader_feedback=val_req.rejection_reason,
            iteration_count=report.revision_count,
        )

        thread_config = {"configurable": {"thread_id": f"visit_{report.visit_id}"}}
        revised_state = kia_multiagent_app.invoke(initial_state, config=thread_config)

        # Perbarui laporan dengan hasil revisi
        report.risk_flags = revised_state.get("risk_flags", [])
        report.risk_narrative = revised_state.get("risk_narrative", "")
        report.recommendations = revised_state.get("recommendations", [])
        report.verification_summary = revised_state.get("verification_details", [])
        report.overall_status = revised_state.get("overall_status", report.overall_status)
        report.final_report_json = revised_state.get("final_report_json", {})
        report.status = ReportStatus.DRAFT # Kembali ke DRAFT untuk review final kader

    db.commit()
    db.refresh(report)
    report.visit_data = _extract_visit_data(report.visit)
    return report


@router.get("/{report_id}/download-pdf")
def download_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.pdf_service import render_report_html, write_pdf_strict, PdfEngineUnavailable

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    if report.status != ReportStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Dokumen PDF hanya tersedia untuk laporan yang telah disahkan.")

    pdf_path = report.pdf_path
    needs_render = (
        not pdf_path
        or not pdf_path.lower().endswith(".pdf")
        or not os.path.exists(pdf_path)
    )

    if needs_render:
        visit = report.visit
        patient = report.patient
        if not visit or not patient:
            raise HTTPException(status_code=404, detail="Data kunjungan/pasien untuk laporan ini tidak ditemukan.")

        validated_dt = report.validated_at or datetime.now()
        kader_name = report.kader.full_name if report.kader else current_user.full_name
        try:
            html_out = render_report_html(
                report_data=report.final_report_json,
                visit_date=str(visit.visit_date),
                kader_name=kader_name,
                validated_date=validated_dt.strftime("%d %B %Y"),
                visit_data=_extract_visit_data(visit),
            )
            pdf_path = write_pdf_strict(html_out, f"Laporan_KIA_{patient.nik}_{visit.visit_date}_r{report.id}.pdf")
        except PdfEngineUnavailable as e:
            raise HTTPException(status_code=503, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gagal membuat dokumen PDF: {e}")

        report.pdf_path = pdf_path
        db.commit()

    patient = report.patient
    visit = report.visit
    safe_name = (patient.name if patient else "Pasien").replace(" ", "_")
    download_name = f"Laporan_KIA_{safe_name}_{visit.visit_date if visit else report.id}.pdf"
    return FileResponse(
        path=pdf_path,
        filename=download_name,
        media_type="application/pdf"
    )


@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menghapus satu data laporan kunjungan (Bab 4 Activity Diagram 26: Kelola Hasil Laporan oleh Admin).
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang menghapus laporan.")

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")

    # 1. Hapus audit log terkait
    db.query(AuditLog).filter(AuditLog.report_id == report_id).delete(synchronize_session=False)

    # 2. Hapus berkas PDF fisik jika ada
    if report.pdf_path and os.path.exists(report.pdf_path):
        try:
            os.remove(report.pdf_path)
        except Exception:
            pass

    # 3. Hapus rekam laporan
    db.delete(report)
    db.commit()
    return {"message": f"Laporan #{report_id} berhasil dihapus."}


@router.post("/bulk-delete")
def bulk_delete_reports(
    req: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menghapus massal data laporan kunjungan (Khusus Administrator Puskesmas).
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang menghapus laporan.")

    if not req.ids:
        return {"deleted_count": 0, "message": "Tidak ada laporan yang dipilih."}

    # 1. Hapus audit log terkait
    db.query(AuditLog).filter(AuditLog.report_id.in_(req.ids)).delete(synchronize_session=False)

    # 2. Hapus berkas PDF fisik
    reports = db.query(Report).filter(Report.id.in_(req.ids)).all()
    for r in reports:
        if r.pdf_path and os.path.exists(r.pdf_path):
            try:
                os.remove(r.pdf_path)
            except Exception:
                pass

    # 3. Hapus rekam laporan
    deleted_count = db.query(Report).filter(Report.id.in_(req.ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted_count, "message": f"{deleted_count} laporan berhasil dihapus."}

