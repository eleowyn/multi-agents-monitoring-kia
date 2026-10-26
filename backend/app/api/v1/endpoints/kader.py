from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.report import Report, ReportStatus
from app.models.user import User, UserRole
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


class PriorityPatientItem(BaseModel):
    report_id: int
    visit_id: int
    patient_id: int
    patient_name: str
    patient_nik: str
    patient_type: str
    phase: str
    visit_date: Optional[str] = None
    overall_status: str
    status: str
    risk_summary: List[str]
    village_name: Optional[str] = None
    posyandu_name: Optional[str] = None


class KaderDashboardSummary(BaseModel):
    posyandu_name: str
    village_name: str
    total_patients: int
    total_mothers: int
    total_children: int
    monthly_visits: int
    pending_validation: int
    high_risk_count: int
    priority_patients: List[PriorityPatientItem]


@router.get("/dashboard-summary", response_model=KaderDashboardSummary)
def get_kader_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menghasilkan ringkasan operasional dan radar deteksi risiko tinggi
    khusus untuk wilayah kerja Posyandu Kader yang sedang login.
    """
    posyandu = current_user.posyandu_name or "Posyandu Mawar"
    village = current_user.village_name or "Airmadidi Atas"

    # Base query pasien wilayah kader
    patient_q = db.query(Patient)
    if current_user.role == UserRole.KADER and current_user.village_name:
        patient_q = patient_q.filter(Patient.village_name == current_user.village_name)

    total_patients = patient_q.count()
    total_mothers = patient_q.filter(Patient.patient_type == "MOTHER").count()
    total_children = patient_q.filter(Patient.patient_type == "CHILD").count()

    # Kunjungan bulan berjalan
    now = datetime.now()
    first_of_month = f"{now.year}-{now.month:02d}-01"
    
    visit_q = (
        db.query(Visit)
        .join(Patient, Visit.patient_id == Patient.id)
    )
    if current_user.role == UserRole.KADER and current_user.village_name:
        visit_q = visit_q.filter(Patient.village_name == current_user.village_name)

    monthly_visits = visit_q.filter(Visit.visit_date >= first_of_month).count()

    # Laporan wilayah kader
    report_q = (
        db.query(Report)
        .join(Patient, Report.patient_id == Patient.id)
        .join(Visit, Report.visit_id == Visit.id)
    )
    if current_user.role == UserRole.KADER and current_user.village_name:
        report_q = report_q.filter(Patient.village_name == current_user.village_name)

    pending_validation = report_q.filter(Report.status == ReportStatus.DRAFT).count()
    high_risk_count = report_q.filter(Report.overall_status == "RISIKO_TINGGI").count()

    # Daftar radar pasien prioritas berisiko tinggi / perlu perhatian (maksimal 8 terbaru)
    priority_reports = (
        report_q.filter(Report.overall_status.in_(["RISIKO_TINGGI", "PERLU_PERHATIAN"]))
        .order_by(Visit.visit_date.desc(), Report.id.desc())
        .limit(8)
        .all()
    )

    priority_items = []
    for r in priority_reports:
        p = r.patient
        v = r.visit
        findings = []
        if r.risk_flags and isinstance(r.risk_flags, list):
            for flag_item in r.risk_flags:
                if isinstance(flag_item, dict):
                    detail = flag_item.get("detail") or flag_item.get("flag") or flag_item.get("indicator")
                    if detail:
                        findings.append(str(detail))
                elif isinstance(flag_item, str):
                    findings.append(flag_item)
        elif r.risk_narrative:
            first_sentence = r.risk_narrative.split("\n")[0].strip()
            if first_sentence:
                findings.append(first_sentence[:110])

        p_type = p.patient_type.value if (p and hasattr(p.patient_type, "value")) else (str(p.patient_type) if p and p.patient_type else "CHILD")
        v_phase = v.phase.value if (v and hasattr(v.phase, "value")) else (str(v.phase) if v and v.phase else "-")
        v_date = str(v.visit_date) if (v and v.visit_date) else "-"

        priority_items.append(
            PriorityPatientItem(
                report_id=r.id,
                visit_id=r.visit_id,
                patient_id=p.id if p else 0,
                patient_name=p.name if p else "Pasien",
                patient_nik=p.nik if p else "-",
                patient_type=p_type,
                phase=v_phase,
                visit_date=v_date,
                overall_status=r.overall_status or "PERLU_PERHATIAN",
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                risk_summary=findings[:3],
                village_name=p.village_name if p else village,
                posyandu_name=p.posyandu_name if p else posyandu,
            )
        )

    return KaderDashboardSummary(
        posyandu_name=posyandu,
        village_name=village,
        total_patients=total_patients,
        total_mothers=total_mothers,
        total_children=total_children,
        monthly_visits=monthly_visits,
        pending_validation=pending_validation,
        high_risk_count=high_risk_count,
        priority_patients=priority_items,
    )
