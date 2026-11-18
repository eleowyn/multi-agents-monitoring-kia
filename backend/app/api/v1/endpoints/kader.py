from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.models.patient import Patient, PatientType
from app.models.visit import Visit
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user
from app.services import aggregates as agg

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


class PhaseBreakdown(BaseModel):
    mothers: int
    newborns: int
    toddlers: int


class MonthlyTrendItem(BaseModel):
    month: str
    label: str
    visits: int
    stunting: int
    kek: int
    anemia: int


class KaderDashboardSummary(BaseModel):
    posyandu_name: str
    village_name: str
    total_patients: int
    total_mothers: int
    total_children: int
    monthly_visits: int
    pending_validation: int
    high_risk_count: int
    total_stunting: int = 0
    total_kek: int = 0
    total_anemia: int = 0
    phase_breakdown: Optional[PhaseBreakdown] = None
    monthly_trend: Optional[List[MonthlyTrendItem]] = []
    priority_patients: List[PriorityPatientItem]


@router.get("/dashboard-summary", response_model=KaderDashboardSummary)
def get_kader_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ringkasan operasional dan radar pasien berisiko untuk wilayah kerja kader yang login.
    Hitungan memakai app.services.aggregates (sama dengan dashboard admin).
    """
    posyandu = current_user.posyandu_name or "-"
    village = current_user.village_name or "-"

    scope_ids = agg.scoped_patient_ids(db, current_user)
    all_patients = db.query(Patient).all()
    patients = [p for p in all_patients if scope_ids is None or p.id in scope_ids]
    pids = {p.id for p in patients}
    reports = [r for r in db.query(Report).all() if r.patient_id in pids]
    visits = [v for v in db.query(Visit).all() if v.patient_id in pids]

    mothers = [p for p in patients if p.patient_type == PatientType.MOTHER]
    children = [p for p in patients if p.patient_type == PatientType.CHILD]

    # Distribusi fase: anak tanpa tanggal lahir tidak dimasukkan ke fase mana pun
    today = date.today()
    newborns_count = sum(1 for c in children if c.birth_date and (today - c.birth_date).days <= 28)
    toddlers_count = sum(1 for c in children if c.birth_date and (today - c.birth_date).days > 28)
    phase_data = PhaseBreakdown(mothers=len(mothers), newborns=newborns_count, toddlers=toddlers_count)

    first_of_month = today.replace(day=1)
    monthly_visits = sum(1 for v in visits if v.visit_date and v.visit_date >= first_of_month)
    pending_validation = sum(1 for r in reports if r.status == ReportStatus.DRAFT)

    children_by_mother = agg.children_index(all_patients)
    totals = agg.summarize(patients, reports, children_by_mother)

    months = agg.last_n_months(6, today)
    visit_counts = {ym: 0 for ym in months}
    for v in visits:
        if v.visit_date and (v.visit_date.year, v.visit_date.month) in visit_counts:
            visit_counts[(v.visit_date.year, v.visit_date.month)] += 1
    monthly_trend = [
        MonthlyTrendItem(visits=visit_counts[ym], **m)
        for ym, m in zip(months, agg.monthly_trend(patients, reports, months))
    ]

    # Radar "Pantauan Berisiko": laporan terakhir (belum ditolak) tiap pasien berstatus RISIKO_TINGGI / PERLU_PERHATIAN
    by_pid = agg.index_by_patient(reports)
    latest_reports = []
    for pid, p_reps in by_pid.items():
        latest = agg.latest_report(p_reps, approved_only=False)
        if latest and latest.overall_status in agg.ATTENTION_STATUSES:
            latest_reports.append(latest)
    high_risk_count = len(latest_reports)
    latest_reports.sort(key=lambda r: ((r.visit.visit_date if r.visit else date.min), r.id), reverse=True)

    priority_items = []
    for r in latest_reports[:8]:
        p = r.patient
        v = r.visit
        findings = []
        for flag_item in (r.risk_flags or []):
            if isinstance(flag_item, dict):
                detail = flag_item.get("detail") or flag_item.get("flag") or flag_item.get("indicator")
                if detail:
                    findings.append(str(detail))
            elif isinstance(flag_item, str):
                findings.append(flag_item)
        if not findings and r.risk_narrative:
            first_sentence = r.risk_narrative.split("\n")[0].strip()
            if first_sentence:
                findings.append(first_sentence[:110])

        priority_items.append(PriorityPatientItem(
            report_id=r.id,
            visit_id=r.visit_id,
            patient_id=p.id,
            patient_name=p.name,
            patient_nik=p.nik,
            patient_type=p.patient_type.value if hasattr(p.patient_type, "value") else str(p.patient_type),
            phase=(v.phase.value if hasattr(v.phase, "value") else str(v.phase)) if (v and v.phase) else "-",
            visit_date=str(v.visit_date) if (v and v.visit_date) else "-",
            overall_status=r.overall_status,
            status=r.status.value if hasattr(r.status, "value") else str(r.status),
            risk_summary=findings[:3],
            village_name=p.village_name,
            posyandu_name=p.posyandu_name,
        ))

    return KaderDashboardSummary(
        posyandu_name=posyandu,
        village_name=village,
        total_patients=len(patients),
        total_mothers=len(mothers),
        total_children=len(children),
        monthly_visits=monthly_visits,
        pending_validation=pending_validation,
        high_risk_count=high_risk_count,
        total_stunting=totals["stunting"],
        total_kek=totals["kek"],
        total_anemia=totals["anemia"],
        phase_breakdown=phase_data,
        monthly_trend=monthly_trend,
        priority_patients=priority_items,
    )
