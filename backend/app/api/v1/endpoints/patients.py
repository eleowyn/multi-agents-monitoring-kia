import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models.patient import Patient, PatientType
from app.models.visit import Visit
from app.models.report import Report
from app.models.revision import RevisionRequest
from app.models.audit_log import AuditLog
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, LongitudinalHistoryResponse
from app.schemas.admin import BulkDeleteRequest, PatientTrendPoint, PatientTrendResponse
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User, UserRole
from app.multiagent.tools.hpk_tracker import calculate_1000_hpk_status
from app.multiagent.tools.who_zscore import calculate_who_zscore
from app.multiagent.state_builder import build_maternal_history

router = APIRouter()


def _serialize_visit_rich(v: Visit, patient: Patient) -> Dict[str, Any]:
    """Mengubah objek Visit menjadi dictionary lengkap lintas 3 fase + Z-Score + 1.000 HPK."""
    phase_str = v.phase.value if hasattr(v.phase, "value") else str(v.phase)
    p_type_str = patient.patient_type.value if hasattr(patient.patient_type, "value") else str(patient.patient_type)
    gender_str = patient.gender.value if (patient.gender and hasattr(patient.gender, "value")) else (str(patient.gender) if patient.gender else "L")

    latest_report = max(v.reports, key=lambda r: r.id) if v.reports else None

    hpk_info = calculate_1000_hpk_status(
        phase=phase_str,
        patient_type=p_type_str,
        birth_date=patient.birth_date,
        visit_date=v.visit_date,
        gestational_age_weeks=v.gestational_age_weeks,
        trimester=v.trimester,
        age_in_months=v.age_in_months,
    )

    z_pbu = None
    z_bbu = None
    z_bbpb = None
    pbu_cat = None
    if phase_str == "BADUTA" and (v.child_length_cm or v.child_weight_kg):
        try:
            z_res = calculate_who_zscore(
                gender=gender_str,
                age_in_months=int(v.age_in_months if v.age_in_months is not None else hpk_info.get("child_age_months") or 12),
                weight_kg=float(v.child_weight_kg) if v.child_weight_kg else None,
                length_cm=float(v.child_length_cm) if v.child_length_cm else None,
            )
            ind = z_res.get("indicators", {})
            z_pbu = ind.get("PB_U", {}).get("z_score")
            pbu_cat = ind.get("PB_U", {}).get("category")
            z_bbu = ind.get("BB_U", {}).get("z_score")
            z_bbpb = ind.get("BB_PB", {}).get("z_score")
        except Exception:
            pass

    return {
        "id": v.id,
        "visit_date": str(v.visit_date),
        "phase": phase_str,
        "hpk_day": hpk_info.get("hpk_day"),
        "hpk_summary": hpk_info.get("summary_label"),
        # Ibu Hamil
        "trimester": v.trimester,
        "gestational_age_weeks": v.gestational_age_weeks,
        "lila_cm": v.lila_cm,
        "hb_level": v.hb_level,
        "maternal_weight_kg": v.maternal_weight_kg,
        "maternal_height_cm": v.maternal_height_cm,
        "systolic_bp": v.systolic_bp,
        "diastolic_bp": v.diastolic_bp,
        "fundal_height_cm": v.fundal_height_cm,
        "kspr_answers": v.kspr_answers or [],
        # Bayi Baru Lahir
        "birth_weight_gram": v.birth_weight_gram,
        "birth_length_cm": v.birth_length_cm,
        "head_circumference_cm": v.head_circumference_cm,
        "gestational_age_at_birth_weeks": v.gestational_age_at_birth_weeks,
        "early_initiation_breastfeeding": v.early_initiation_breastfeeding,
        # Baduta
        "age_in_months": v.age_in_months if v.age_in_months is not None else (hpk_info.get("child_age_months") if phase_str == "BADUTA" else None),
        "child_weight_kg": v.child_weight_kg,
        "child_length_cm": v.child_length_cm,
        "child_head_circumference_cm": v.child_head_circumference_cm,
        "weight_trend_kms": v.weight_trend_kms,
        "feeding_status": v.feeding_status,
        "vitamin_a": v.vitamin_a,
        "immunization_status": v.immunization_status,
        "z_score_pbu": z_pbu,
        "pbu_category": pbu_cat,
        "z_score_bbu": z_bbu,
        "z_score_bbpb": z_bbpb,
        # Laporan & Catatan
        "clinical_notes": v.clinical_notes,
        "report_id": latest_report.id if latest_report else None,
        "overall_status": latest_report.overall_status if latest_report else None,
        "report_status": (latest_report.status.value if hasattr(latest_report.status, "value") else str(latest_report.status)) if latest_report else None,
        "risk_flags": latest_report.risk_flags if latest_report else [],
    }


def _enrich_patient(db: Session, p: Patient) -> Patient:
    """Menambahkan metadata relasi Ibu/Anak, jumlah kunjungan, dan status 1.000 HPK terkini pada objek Patient."""
    p_type_str = p.patient_type.value if hasattr(p.patient_type, "value") else str(p.patient_type)
    p.mother_name = p.mother.name if p.mother else None
    p.children_count = len(p.children) if p.children else 0
    p.visits_count = len(p.visits) if p.visits else 0

    latest_visit = max(p.visits, key=lambda v: (v.visit_date, v.id)) if p.visits else None
    if latest_visit:
        phase_str = latest_visit.phase.value if hasattr(latest_visit.phase, "value") else str(latest_visit.phase)
        p.hpk_status = calculate_1000_hpk_status(
            phase=phase_str,
            patient_type=p_type_str,
            birth_date=p.birth_date,
            visit_date=latest_visit.visit_date,
            gestational_age_weeks=latest_visit.gestational_age_weeks,
            trimester=latest_visit.trimester,
            age_in_months=latest_visit.age_in_months,
        )
    else:
        p.hpk_status = calculate_1000_hpk_status(
            phase="IBU_HAMIL" if p_type_str == "MOTHER" else "BADUTA",
            patient_type=p_type_str,
            birth_date=p.birth_date,
        )
    return p


@router.get("/", response_model=List[PatientResponse])
def get_patients(
    skip: int = 0,
    limit: int = 200,
    patient_type: Optional[PatientType] = None,
    village_name: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mengambil data pasien:
    - KADER: otomatis difilter berdasarkan wilayah desa/kelurahan Posyandu miliknya.
    - ADMIN: memiliki akses global mencakup 9 desa/kelurahan di Kecamatan Airmadidi.
    """
    query = db.query(Patient)

    if current_user.role == UserRole.KADER and current_user.village_name:
        query = query.filter(Patient.village_name == current_user.village_name)
    elif village_name:
        query = query.filter(Patient.village_name == village_name)

    if patient_type:
        query = query.filter(Patient.patient_type == patient_type)
    if search:
        query = query.filter(
            (Patient.name.ilike(f"%{search}%")) | (Patient.nik.ilike(f"%{search}%"))
        )
    patients = query.order_by(Patient.id.desc()).offset(skip).limit(limit).all()
    return [_enrich_patient(db, p) for p in patients]


@router.post("/", response_model=PatientResponse)
def create_patient(
    patient_in: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mendaftarkan pasien baru.
    Jika diinput oleh Kader, wilayah otomatis disesuaikan jika tidak dispesifikasikan.
    """
    existing = db.query(Patient).filter(Patient.nik == patient_in.nik).first()
    if existing:
        raise HTTPException(status_code=400, detail="Pasien dengan NIK tersebut sudah terdaftar.")

    patient_data = patient_in.model_dump()
    if current_user.role == UserRole.KADER:
        if current_user.village_name:
            patient_data["village_name"] = current_user.village_name
        if current_user.posyandu_name:
            patient_data["posyandu_name"] = current_user.posyandu_name

    patient = Patient(**patient_data)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _enrich_patient(db, patient)


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    return _enrich_patient(db, patient)


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: int,
    patient_in: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Memperbarui data induk pasien (Wewenang Penuh Administrator Puskesmas).
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang mengubah data induk pasien.")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    update_data = patient_in.model_dump(exclude_unset=True)
    if "nik" in update_data and update_data["nik"] != patient.nik:
        duplicate = db.query(Patient).filter(Patient.nik == update_data["nik"], Patient.id != patient_id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="NIK tersebut sudah digunakan oleh pasien lain.")

    for field, value in update_data.items():
        setattr(patient, field, value)

    db.commit()
    db.refresh(patient)
    return _enrich_patient(db, patient)


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menghapus data pasien dan riwayat terkait (Wewenang Penuh Administrator Puskesmas).
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang menghapus data pasien.")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    report_ids = [r[0] for r in db.query(Report.id).filter(Report.patient_id == patient_id).all()]
    visit_ids = [v[0] for v in db.query(Visit.id).filter(Visit.patient_id == patient_id).all()]

    if report_ids or visit_ids:
        rev_filters = []
        if report_ids:
            rev_filters.append(RevisionRequest.report_id.in_(report_ids))
        if visit_ids:
            rev_filters.append(RevisionRequest.visit_id.in_(visit_ids))
        db.query(RevisionRequest).filter(or_(*rev_filters)).delete(synchronize_session=False)

    if report_ids:
        db.query(AuditLog).filter(AuditLog.report_id.in_(report_ids)).delete(synchronize_session=False)

    reports = db.query(Report).filter(Report.patient_id == patient_id).all()
    for r in reports:
        if r.pdf_path and os.path.exists(r.pdf_path):
            try:
                os.remove(r.pdf_path)
            except Exception:
                pass

    db.query(Report).filter(Report.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Visit).filter(Visit.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Patient).filter(Patient.mother_id == patient_id).update({Patient.mother_id: None}, synchronize_session=False)

    db.delete(patient)
    db.commit()
    return {"message": f"Data pasien {patient.name} beserta rekam kunjungannya berhasil dihapus."}


@router.post("/bulk-delete")
def bulk_delete_patients(
    req: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menghapus massal data pasien dan seluruh riwayat terkait (Wewenang Penuh Administrator Puskesmas).
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang menghapus data pasien.")

    if not req.ids:
        return {"deleted_count": 0, "message": "Tidak ada pasien yang dipilih."}

    report_ids = [r[0] for r in db.query(Report.id).filter(Report.patient_id.in_(req.ids)).all()]
    visit_ids = [v[0] for v in db.query(Visit.id).filter(Visit.patient_id.in_(req.ids)).all()]

    if report_ids or visit_ids:
        rev_filters = []
        if report_ids:
            rev_filters.append(RevisionRequest.report_id.in_(report_ids))
        if visit_ids:
            rev_filters.append(RevisionRequest.visit_id.in_(visit_ids))
        db.query(RevisionRequest).filter(or_(*rev_filters)).delete(synchronize_session=False)

    if report_ids:
        db.query(AuditLog).filter(AuditLog.report_id.in_(report_ids)).delete(synchronize_session=False)

    reports = db.query(Report).filter(Report.patient_id.in_(req.ids)).all()
    for r in reports:
        if r.pdf_path and os.path.exists(r.pdf_path):
            try:
                os.remove(r.pdf_path)
            except Exception:
                pass

    db.query(Report).filter(Report.patient_id.in_(req.ids)).delete(synchronize_session=False)
    db.query(Visit).filter(Visit.patient_id.in_(req.ids)).delete(synchronize_session=False)
    db.query(Patient).filter(Patient.mother_id.in_(req.ids)).update({Patient.mother_id: None}, synchronize_session=False)

    deleted_count = db.query(Patient).filter(Patient.id.in_(req.ids)).delete(synchronize_session=False)
    db.commit()

    return {
        "deleted_count": deleted_count,
        "message": f"{deleted_count} data pasien beserta rekam kunjungannya berhasil dihapus."
    }


@router.get("/{patient_id}/longitudinal", response_model=LongitudinalHistoryResponse)
def get_longitudinal_history(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menarik riwayat longitudinal 1.000 HPK lengkap:
    - Posisi pasien pada garis waktu 1.000 HPK (hpk_status).
    - Jika pasien adalah Anak: otomatis menarik data Ibu Kandung, ringkasan risiko maternal
      (KEK, Anemia, KSPR, BBLR), seluruh kunjungan kehamilan Ibu, serta seluruh kunjungan Anak.
    - Jika pasien adalah Ibu Hamil: menarik seluruh kunjungan ANC Ibu beserta daftar Anak kandung
      yang terhubung dan riwayat pertumbuhan anaknya.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    enriched_patient = _enrich_patient(db, patient)
    own_visits_orm = (
        db.query(Visit)
        .filter(Visit.patient_id == patient.id)
        .order_by(Visit.visit_date.asc(), Visit.id.asc())
        .all()
    )
    own_visits_rich = [_serialize_visit_rich(v, patient) for v in own_visits_orm]

    mother = None
    maternal_visits: List[Dict[str, Any]] = []
    child_visits: List[Dict[str, Any]] = []
    children_list: List[Patient] = []
    maternal_summary = None

    if patient.patient_type == PatientType.CHILD:
        child_visits = own_visits_rich
        maternal_summary = build_maternal_history(db, patient)
        if patient.mother_id:
            mother_orm = db.query(Patient).filter(Patient.id == patient.mother_id).first()
            if mother_orm:
                mother = _enrich_patient(db, mother_orm)
                m_visits_orm = (
                    db.query(Visit)
                    .filter(Visit.patient_id == mother_orm.id)
                    .order_by(Visit.visit_date.asc(), Visit.id.asc())
                    .all()
                )
                maternal_visits = [_serialize_visit_rich(v, mother_orm) for v in m_visits_orm]
    else:
        # Pasien adalah Ibu Hamil (MOTHER)
        maternal_visits = own_visits_rich
        # Agar kompatibel dengan komponen lama yang membaca child_visits sebagai daftar kunjungan pasien terpilih
        child_visits = own_visits_rich
        linked_children = db.query(Patient).filter(Patient.mother_id == patient.id).order_by(Patient.birth_date.asc()).all()
        children_list = [_enrich_patient(db, c) for c in linked_children]

    return {
        "patient": enriched_patient,
        "mother": mother,
        "children": children_list,
        "hpk_status": enriched_patient.hpk_status,
        "maternal_summary": maternal_summary,
        "maternal_visits": maternal_visits,
        "child_visits": child_visits,
        "visits": own_visits_rich,
    }


@router.get("/{patient_id}/trend", response_model=PatientTrendResponse)
def get_patient_trend_for_kader_or_admin(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Riwayat pengukuran per kunjungan untuk grafik tren individu pasien (Kader & Admin)."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date.asc(), Visit.id.asc()).all()
    points = []
    for v in visits:
        latest_report = max(v.reports, key=lambda r: r.id) if v.reports else None
        points.append(PatientTrendPoint(
            visit_date=str(v.visit_date),
            phase=v.phase.value if hasattr(v.phase, "value") else str(v.phase),
            age_in_months=v.age_in_months,
            child_weight_kg=v.child_weight_kg,
            child_length_cm=v.child_length_cm,
            birth_weight_gram=v.birth_weight_gram,
            birth_length_cm=v.birth_length_cm,
            lila_cm=v.lila_cm,
            hb_level=v.hb_level,
            maternal_weight_kg=v.maternal_weight_kg,
            overall_status=latest_report.overall_status if latest_report else None,
        ))

    p_type = patient.patient_type.value if hasattr(patient.patient_type, "value") else str(patient.patient_type)
    return PatientTrendResponse(
        patient_id=patient.id,
        patient_name=patient.name,
        patient_type=p_type,
        village_name=patient.village_name,
        points=points,
    )
