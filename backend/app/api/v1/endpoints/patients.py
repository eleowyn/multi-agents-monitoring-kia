import os
from datetime import date
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
    # Safely extract mother_name
    if hasattr(p, "mother") and isinstance(p.mother, Patient):
        p.mother_name = p.mother.name
    elif hasattr(p, "mother_id") and p.mother_id:
        mom = db.query(Patient).filter(Patient.id == p.mother_id).first()
        p.mother_name = mom.name if mom else None
    else:
        p.mother_name = None

    # Safely extract children_count
    if hasattr(p, "children") and isinstance(p.children, (list, tuple, set)):
        p.children_count = len(p.children)
    else:
        p.children_count = 0

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
        v_clean = current_user.village_name.strip()
        query = query.filter(
            or_(
                Patient.village_name == v_clean,
                Patient.village_name.ilike(f"%{v_clean}%"),
                Patient.village_name.ilike("%Airmadidi%"),
                Patient.village_name.is_(None)
            )
        )
    elif village_name:
        query = query.filter(Patient.village_name.ilike(f"%{village_name.strip()}%"))

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


AIRMADIDI_VILLAGES_LIST = [
    "Airmadidi Atas", "Airmadidi Bawah", "Sarongsong Satu", "Sarongsong Dua",
    "Sukur", "Rap-Rap", "Sawangan", "Sampiri", "Tanggari"
]

@router.get("/posyandu-aggregates")
def get_posyandu_aggregates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Menghasilkan data rekapitulasi monitoring KIA 1.000 HPK agregat untuk seluruh posyandu/desa
    di wilayah kerja Puskesmas Airmadidi, termasuk rasio KMS (N/T), kelulusan 1.000 HPK, dan kasus stunting/KEK.
    """
    all_patients = db.query(Patient).all()
    all_visits = db.query(Visit).all()
    all_reports = db.query(Report).all()

    # Pre-index reports by patient_id
    reports_by_patient = {}
    for r in all_reports:
        reports_by_patient.setdefault(r.patient_id, []).append(r)

    # Pre-index visits by patient_id
    visits_by_patient = {}
    for v in all_visits:
        visits_by_patient.setdefault(v.patient_id, []).append(v)

    village_stats = []
    
    def _is_mother(p):
        t = str(getattr(p.patient_type, "value", p.patient_type) or "").upper()
        return "MOTHER" in t or "IBU" in t

    def _is_child(p):
        t = str(getattr(p.patient_type, "value", p.patient_type) or "").upper()
        return "CHILD" in t or "ANAK" in t

    total_target_all = len(all_patients)
    total_mothers_all = sum(1 for p in all_patients if _is_mother(p))
    total_children_all = sum(1 for p in all_patients if _is_child(p))
    
    total_stunting_all = 0
    total_kek_all = 0
    total_anemia_all = 0
    total_kms_naik_all = 0
    total_kms_tidak_naik_all = 0
    total_graduated_optimal_all = 0
    total_graduated_evaluasi_all = 0

    def _find_village_idx(patient):
        p_vill = (patient.village_name or "").strip().lower()
        if not p_vill:
            return 0
        clean_vill = p_vill.replace("desa", "").replace("kelurahan", "").replace("posyandu", "").strip()
        for idx, v_name in enumerate(AIRMADIDI_VILLAGES_LIST):
            v_lower = v_name.lower()
            if clean_vill == v_lower or clean_vill in v_lower or v_lower in clean_vill or (clean_vill == "airmadidi" and idx == 0):
                return idx
            if "sarongsong" in clean_vill and ("1" in clean_vill or "satu" in clean_vill) and "satu" in v_lower:
                return idx
            if "sarongsong" in clean_vill and ("2" in clean_vill or "dua" in clean_vill) and "dua" in v_lower:
                return idx
            if "rap" in clean_vill and "rap" in v_lower:
                return idx
        return 0

    patients_by_village = {idx: [] for idx in range(len(AIRMADIDI_VILLAGES_LIST))}
    for p in all_patients:
        v_idx = _find_village_idx(p)
        patients_by_village[v_idx].append(p)

    for idx, v_name in enumerate(AIRMADIDI_VILLAGES_LIST):
        v_patients = patients_by_village[idx]

        v_mothers = [p for p in v_patients if _is_mother(p)]
        v_children = [p for p in v_patients if _is_child(p)]
        
        stunting_count = 0
        kek_count = 0
        anemia_count = 0
        high_risk_count = 0
        kms_naik = 0
        kms_tidak_naik = 0
        grad_optimal = 0
        grad_evaluasi = 0

        for p in v_patients:
            p_reports = reports_by_patient.get(p.id, [])
            p_visits = visits_by_patient.get(p.id, [])
            
            # Check latest report risk
            if p_reports:
                latest_report = max(p_reports, key=lambda r: r.id)
                flags = latest_report.risk_flags or []
                has_stunt = any("STUNTING" in f.get("flag", "") for f in flags)
                has_kek = any("KEK" in f.get("flag", "") for f in flags)
                has_anemia = any("ANEMIA" in f.get("flag", "") for f in flags)
                
                if has_stunt: stunting_count += 1
                if has_kek: kek_count += 1
                if has_anemia: anemia_count += 1
                if latest_report.overall_status == "RISIKO_TINGGI": high_risk_count += 1

            # KMS trends for children
            if _is_child(p):
                for v in p_visits:
                    trend = str(v.weight_trend_kms or "").upper()
                    if trend in ["NAIK", "N"]:
                        kms_naik += 1
                    elif trend in ["TIDAK_NAIK", "T"]:
                        kms_tidak_naik += 1
                
                # Graduation check for child >= 24 months
                if p.birth_date:
                    days_age = (date.today() - p.birth_date).days
                    if days_age >= 730:
                        if p_reports and any("STUNTING" in f.get("flag", "") for f in (max(p_reports, key=lambda r: r.id).risk_flags or [])):
                            grad_evaluasi += 1
                        else:
                            grad_optimal += 1

        total_stunting_all += stunting_count
        total_kek_all += kek_count
        total_anemia_all += anemia_count
        total_kms_naik_all += kms_naik
        total_kms_tidak_naik_all += kms_tidak_naik
        total_graduated_optimal_all += grad_optimal
        total_graduated_evaluasi_all += grad_evaluasi

        # Status Posyandu category
        if stunting_count >= 3 or high_risk_count >= 3:
            status_label = "Prioritas Dampingan"
            status_color = "rose"
        elif stunting_count > 0 or high_risk_count > 0:
            status_label = "Waspada Stunting"
            status_color = "amber"
        else:
            status_label = "Terkendali (Aman)"
            status_color = "emerald"

        village_stats.append({
            "village_name": v_name,
            "posyandu_name": f"Posyandu {v_name}",
            "total_patients": len(v_patients),
            "total_mothers": len(v_mothers),
            "total_children": len(v_children),
            "stunting_count": stunting_count,
            "kek_count": kek_count,
            "anemia_count": anemia_count,
            "high_risk_count": high_risk_count,
            "kms_naik_count": kms_naik,
            "kms_tidak_naik_count": kms_tidak_naik,
            "graduated_optimal": grad_optimal,
            "graduated_evaluasi": grad_evaluasi,
            "status_label": status_label,
            "status_color": status_color,
            "is_user_village": bool(current_user.village_name and current_user.village_name.strip().lower() == v_name.lower()),
        })

    total_kms = total_kms_naik_all + total_kms_tidak_naik_all
    kms_naik_percent = round((total_kms_naik_all / total_kms * 100), 1) if total_kms > 0 else 0.0

    total_grad = total_graduated_optimal_all + total_graduated_evaluasi_all
    grad_rate = round((total_graduated_optimal_all / total_grad * 100), 1) if total_grad > 0 else 100.0

    return {
        "summary": {
            "total_target_all": total_target_all,
            "total_mothers_all": total_mothers_all,
            "total_children_all": total_children_all,
            "total_stunting_all": total_stunting_all,
            "total_kek_all": total_kek_all,
            "total_anemia_all": total_anemia_all,
            "total_kms_naik": total_kms_naik_all,
            "total_kms_tidak_naik": total_kms_tidak_naik_all,
            "kms_naik_percent": kms_naik_percent,
            "total_graduated_optimal": total_graduated_optimal_all,
            "total_graduated_evaluasi": total_graduated_evaluasi_all,
            "graduation_rate": grad_rate,
            "user_village": current_user.village_name or "Airmadidi Atas",
            "user_role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            "is_kader": current_user.role == UserRole.KADER,
        },
        "villages": village_stats,
    }



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
