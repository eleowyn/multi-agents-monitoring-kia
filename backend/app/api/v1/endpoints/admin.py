from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.report import Report, ReportStatus
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.admin import DashboardSummary, VillageStats, AuditLogResponse
from app.schemas.auth import UserResponse, UserCreate
from app.core.security import get_password_hash
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

AIRMADIDI_VILLAGES = [
    "Airmadidi Atas", "Airmadidi Bawah", "Sarongsong Satu", "Sarongsong Dua",
    "Sukur", "Rap-Rap", "Sawangan", "Sampiri", "Tanggari"
]


def _require_admin(user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Akses dibatasi khusus Admin Puskesmas.")
    return user


@router.get("/dashboard-summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    total_patients = db.query(Patient).count()
    total_visits = db.query(Visit).count()
    total_reports_approved = db.query(Report).filter(Report.status == ReportStatus.APPROVED).count()
    total_reports_pending = db.query(Report).filter(Report.status == ReportStatus.DRAFT).count()

    all_reports = db.query(Report).all()
    
    total_stunting = 0
    total_kek = 0
    total_anemia = 0
    
    for r in all_reports:
        flags = r.risk_flags or []
        for f in flags:
            f_name = f.get("flag", "")
            if "STUNTING" in f_name:
                total_stunting += 1
            if "KEK" in f_name:
                total_kek += 1
            if "ANEMIA" in f_name:
                total_anemia += 1

    # Rekapitulasi per desa
    village_breakdown = []
    for v_name in AIRMADIDI_VILLAGES:
        v_patients = db.query(Patient).filter(Patient.village_name == v_name).all()
        p_ids = [p.id for p in v_patients]
        
        v_reports = db.query(Report).filter(Report.patient_id.in_(p_ids)).all() if p_ids else []
        
        stunt_v = sum(1 for r in v_reports if any("STUNTING" in f.get("flag", "") for f in (r.risk_flags or [])))
        kek_v = sum(1 for r in v_reports if any("KEK" in f.get("flag", "") for f in (r.risk_flags or [])))
        anemia_v = sum(1 for r in v_reports if any("ANEMIA" in f.get("flag", "") for f in (r.risk_flags or [])))
        high_risk_v = sum(1 for r in v_reports if r.overall_status == "RISIKO_TINGGI")
        
        village_breakdown.append(VillageStats(
            village_name=v_name,
            total_patients=len(v_patients),
            stunting_count=stunt_v,
            kek_count=kek_v,
            anemia_count=anemia_v,
            high_risk_count=high_risk_v
        ))

    return DashboardSummary(
        total_patients=total_patients,
        total_visits=total_visits,
        total_stunting=total_stunting,
        total_kek=total_kek,
        total_anemia=total_anemia,
        total_reports_approved=total_reports_approved,
        total_reports_pending=total_reports_pending,
        village_breakdown=village_breakdown
    )


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    return db.query(AuditLog).order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()


@router.get("/kaders", response_model=List[UserResponse])
def get_kaders(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    return db.query(User).filter(User.role == UserRole.KADER).all()


@router.post("/kaders", response_model=UserResponse)
def create_kader(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username kader sudah digunakan.")

    kader = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.KADER,
        posyandu_name=user_in.posyandu_name,
        village_name=user_in.village_name
    )
    db.add(kader)
    db.commit()
    db.refresh(kader)
    return kader

