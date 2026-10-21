import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional

from app.core.database import get_db
from app.models.report import Report, ReportStatus
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.report import ReportResponse, ReportValidationRequest
from app.api.v1.endpoints.auth import get_current_user
from app.services.pdf_service import generate_visit_report_pdf
from app.multiagent.graph import kia_multiagent_app

router = APIRouter()


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
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
        if patient.village_name and patient.village_name != current_user.village_name:
            raise HTTPException(status_code=403, detail="Akses ditolak: Laporan ini milik Posyandu desa lain.")

    if val_req.status == ReportStatus.APPROVED:
        report.status = ReportStatus.APPROVED
        report.validated_at = datetime.utcnow()
        report.rejection_reason = None

        # Generate PDF
        filename = f"Laporan_KIA_{patient.nik}_{visit.visit_date}.pdf"
        pdf_path = generate_visit_report_pdf(
            report_data=report.final_report_json,
            visit_date=str(visit.visit_date),
            kader_name=current_user.full_name,
            validated_date=datetime.now().strftime("%d %B %Y"),
            filename=filename
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
    return report


@router.get("/{report_id}/download-pdf")
def download_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report or not report.pdf_path:
        raise HTTPException(status_code=404, detail="Dokumen PDF belum tersedia atau belum divalidasi.")

    if not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="File fisik dokumen tidak ditemukan di server.")

    media_type = "application/pdf" if report.pdf_path.endswith(".pdf") else "text/html"
    return FileResponse(
        path=report.pdf_path,
        filename=os.path.basename(report.pdf_path),
        media_type=media_type
    )
