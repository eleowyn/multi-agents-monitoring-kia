import os
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models.patient import Patient, PatientType
from app.models.visit import Visit, PhaseEnum
from app.models.report import Report
from app.models.revision import RevisionRequest
from app.models.audit_log import AuditLog
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, LongitudinalHistoryResponse
from app.schemas.admin import BulkDeleteRequest
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User, UserRole
from app.multiagent.tools.hpk_tracker import calculate_1000_hpk_status, pregnancy_completed_status
from app.multiagent.tools.who_zscore import calculate_who_zscore
from app.multiagent.state_builder import build_maternal_history

router = APIRouter()


def _serialize_visit_rich(v: Visit, patient: Patient) -> Dict[str, Any]:
    """Mengubah objek Visit menjadi dictionary lengkap lintas 3 fase + Z-Score + 1.000 HPK."""
    phase_str = v.phase.value if hasattr(v.phase, "value") else str(v.phase)
    p_type_str = patient.patient_type.value if hasattr(patient.patient_type, "value") else str(patient.patient_type)
    gender_str = patient.gender.value if (patient.gender and hasattr(patient.gender, "value")) else (str(patient.gender) if patient.gender else None)

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
    age_for_z = hpk_info.get("child_age_months") if hpk_info.get("data_available") else v.age_in_months
    if phase_str == "BADUTA" and gender_str and age_for_z is not None and (v.child_length_cm or v.child_weight_kg):
        try:
            z_res = calculate_who_zscore(
                gender=gender_str,
                age_in_months=int(age_for_z),
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
        "age_in_months": age_for_z if phase_str == "BADUTA" else v.age_in_months,
        "child_weight_kg": v.child_weight_kg,
        "child_length_cm": v.child_length_cm,
        "child_head_circumference_cm": v.child_head_circumference_cm,
        "weight_trend_kms": v.weight_trend_kms if phase_str == "BADUTA" else None,
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

    # Safely extract children_count via direct count query for reliability
    if p_type_str == "MOTHER":
        p.children_count = db.query(func.count(Patient.id)).filter(Patient.mother_id == p.id).scalar() or 0
    elif hasattr(p, "children") and isinstance(p.children, (list, tuple, set)):
        p.children_count = len(p.children)
    else:
        p.children_count = 0

    p.visits_count = len(p.visits) if p.visits else 0

    latest_visit = max(p.visits, key=lambda v: (v.visit_date, v.id)) if p.visits else None
    p.hpk_status = None

    if p_type_str == "MOTHER":
        # Ibu yang sudah melahirkan setelah kunjungan kehamilan terakhir: fase kehamilan selesai,
        # pemantauan 1.000 HPK dilanjutkan pada anak.
        latest_child = (
            db.query(Patient)
            .filter(Patient.mother_id == p.id)
            .order_by(Patient.birth_date.desc())
            .first()
        )
        if latest_child and latest_child.birth_date and (
            not latest_visit or latest_child.birth_date >= latest_visit.visit_date
        ):
            p.hpk_status = pregnancy_completed_status(latest_child.name, latest_child.birth_date)
        elif latest_visit:
            p.hpk_status = calculate_1000_hpk_status(
                phase="IBU_HAMIL",
                patient_type=p_type_str,
                visit_date=latest_visit.visit_date,
                gestational_age_weeks=latest_visit.gestational_age_weeks,
                trimester=latest_visit.trimester,
            )
        # Tanpa kunjungan kehamilan: usia kehamilan tidak diketahui, hpk_status = None
    else:
        # Anak: posisi HPK dihitung dari tanggal lahir sampai kunjungan terakhir (atau hari ini)
        p.hpk_status = calculate_1000_hpk_status(
            phase=None,
            patient_type=p_type_str,
            birth_date=p.birth_date,
            visit_date=latest_visit.visit_date if latest_visit else date.today(),
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

    from app.services.aggregates import scoped_patient_ids, same_village
    scope_ids = scoped_patient_ids(db, current_user)
    if scope_ids is not None:
        query = query.filter(Patient.id.in_(scope_ids))
    elif village_name:
        ids = [p.id for p in db.query(Patient.id, Patient.village_name).all() if same_village(p.village_name, village_name)]
        query = query.filter(Patient.id.in_(ids))

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


@router.get("/posyandu-aggregates")
def get_posyandu_aggregates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Rekapitulasi 1.000 HPK per desa/kelurahan wilayah Puskesmas Airmadidi (khusus Admin & Dokter, Tabel 11).
    Hitungan stunting/KEK/anemia memakai app.services.aggregates (sama dengan dashboard admin).
    """
    if current_user.role not in (UserRole.ADMIN, UserRole.DOKTER):
        raise HTTPException(status_code=403, detail="Rekap seluruh posyandu khusus Admin Puskesmas dan Dokter.")

    from app.services import aggregates as agg

    all_patients = db.query(Patient).all()
    all_reports = db.query(Report).all()
    visits_by_patient: Dict[int, List[Visit]] = {}
    for v in db.query(Visit).all():
        visits_by_patient.setdefault(v.patient_id, []).append(v)
    reports_by_patient = agg.index_by_patient(all_reports)
    children_by_mother = agg.children_index(all_patients)

    by_village: Dict[str, List[Patient]] = {}
    for p in all_patients:
        by_village.setdefault(agg.village_bucket(p), []).append(p)
    village_names = list(agg.AIRMADIDI_VILLAGES) + ([agg.OTHER_VILLAGE] if agg.OTHER_VILLAGE in by_village else [])

    totals_all = {"stunting": 0, "kek": 0, "anemia": 0, "kms_naik": 0, "kms_tidak_naik": 0, "grad_optimal": 0, "grad_evaluasi": 0}
    village_stats = []
    for v_name in village_names:
        v_patients = by_village.get(v_name, [])
        v_ids = {p.id for p in v_patients}
        v_tot = agg.summarize(v_patients, [r for r in all_reports if r.patient_id in v_ids], children_by_mother)

        kms_naik = kms_tidak_naik = grad_optimal = grad_evaluasi = 0
        for p in v_patients:
            if p.patient_type != PatientType.CHILD:
                continue
            for v in visits_by_patient.get(p.id, []):
                if v.phase != PhaseEnum.BADUTA:
                    continue  # N/T hanya bermakna pada penimbangan baduta
                trend = str(v.weight_trend_kms or "").upper()
                if trend in ("NAIK", "N"):
                    kms_naik += 1
                elif trend in ("TIDAK_NAIK", "T"):
                    kms_tidak_naik += 1
            # Lulus 1.000 HPK: usia >= 24 bulan; evaluasi bila laporan tervalidasi terakhir masih stunting
            if p.birth_date and (date.today() - p.birth_date).days >= 730:
                latest = agg.latest_report(reports_by_patient.get(p.id, []))
                if agg.classify_patient(p, latest, children_by_mother)["stunting"]:
                    grad_evaluasi += 1
                else:
                    grad_optimal += 1

        for k, val in (("stunting", v_tot["stunting"]), ("kek", v_tot["kek"]), ("anemia", v_tot["anemia"]),
                       ("kms_naik", kms_naik), ("kms_tidak_naik", kms_tidak_naik),
                       ("grad_optimal", grad_optimal), ("grad_evaluasi", grad_evaluasi)):
            totals_all[k] += val

        if v_tot["stunting"] >= 3 or v_tot["high_risk"] >= 3:
            status_label, status_color = "Prioritas Dampingan", "rose"
        elif v_tot["stunting"] > 0 or v_tot["high_risk"] > 0:
            status_label, status_color = "Waspada Stunting", "amber"
        else:
            status_label, status_color = "Terkendali (Aman)", "emerald"

        village_stats.append({
            "village_name": v_name,
            "posyandu_name": f"Posyandu {v_name}",
            "total_patients": len(v_patients),
            "total_mothers": sum(1 for p in v_patients if p.patient_type == PatientType.MOTHER),
            "total_children": sum(1 for p in v_patients if p.patient_type == PatientType.CHILD),
            "stunting_count": v_tot["stunting"],
            "kek_count": v_tot["kek"],
            "anemia_count": v_tot["anemia"],
            "high_risk_count": v_tot["high_risk"],
            "kms_naik_count": kms_naik,
            "kms_tidak_naik_count": kms_tidak_naik,
            "graduated_optimal": grad_optimal,
            "graduated_evaluasi": grad_evaluasi,
            "status_label": status_label,
            "status_color": status_color,
            "is_user_village": agg.same_village(current_user.village_name, v_name),
        })

    total_kms = totals_all["kms_naik"] + totals_all["kms_tidak_naik"]
    total_grad = totals_all["grad_optimal"] + totals_all["grad_evaluasi"]

    return {
        "summary": {
            "total_target_all": len(all_patients),
            "total_mothers_all": sum(1 for p in all_patients if p.patient_type == PatientType.MOTHER),
            "total_children_all": sum(1 for p in all_patients if p.patient_type == PatientType.CHILD),
            "total_stunting_all": totals_all["stunting"],
            "total_kek_all": totals_all["kek"],
            "total_anemia_all": totals_all["anemia"],
            "total_kms_naik": totals_all["kms_naik"],
            "total_kms_tidak_naik": totals_all["kms_tidak_naik"],
            "kms_naik_percent": round(totals_all["kms_naik"] / total_kms * 100, 1) if total_kms else None,
            "total_graduated_optimal": totals_all["grad_optimal"],
            "total_graduated_evaluasi": totals_all["grad_evaluasi"],
            "graduation_rate": round(totals_all["grad_optimal"] / total_grad * 100, 1) if total_grad else None,
            "user_village": current_user.village_name,
            "user_role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
            "is_kader": False,
        },
        "villages": village_stats,
    }


def _is_patient_in_kader_scope(patient: Patient, current_user: User) -> bool:
    from app.services.aggregates import in_kader_scope
    return in_kader_scope(patient, current_user)


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    if not _is_patient_in_kader_scope(patient, current_user):
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

    if not _is_patient_in_kader_scope(patient, current_user):
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
