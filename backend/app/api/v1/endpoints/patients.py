import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.core.database import get_db
from app.models.patient import Patient, PatientType
from app.models.visit import Visit
from app.models.report import Report
from app.models.revision import RevisionRequest
from app.models.audit_log import AuditLog
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, LongitudinalHistoryResponse
from app.schemas.admin import BulkDeleteRequest
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User, UserRole

router = APIRouter()


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
    
    # Data Scoping: Batasi jangkauan Kader ke desa kerjanya
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
    return query.order_by(Patient.id.desc()).offset(skip).limit(limit).all()


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
    return patient


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")
    
    # Cek jangkauan akses kader
    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")
            
    return patient


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
    return patient


from app.models.audit_log import AuditLog

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

    # 1. Cari seluruh report_id dan visit_id dari pasien ini
    report_ids = [r[0] for r in db.query(Report.id).filter(Report.patient_id == patient_id).all()]
    visit_ids = [v[0] for v in db.query(Visit.id).filter(Visit.patient_id == patient_id).all()]

    # 2. Hapus pengajuan revisi terkait report atau visit
    if report_ids or visit_ids:
        rev_filters = []
        if report_ids:
            rev_filters.append(RevisionRequest.report_id.in_(report_ids))
        if visit_ids:
            rev_filters.append(RevisionRequest.visit_id.in_(visit_ids))
        db.query(RevisionRequest).filter(or_(*rev_filters)).delete(synchronize_session=False)

    # 3. Hapus audit logs terkait
    if report_ids:
        db.query(AuditLog).filter(AuditLog.report_id.in_(report_ids)).delete(synchronize_session=False)

    # 4. Hapus berkas PDF fisik
    reports = db.query(Report).filter(Report.patient_id == patient_id).all()
    for r in reports:
        if r.pdf_path and os.path.exists(r.pdf_path):
            try:
                os.remove(r.pdf_path)
            except Exception:
                pass

    # 5. Hapus reports dan visits
    db.query(Report).filter(Report.patient_id == patient_id).delete(synchronize_session=False)
    db.query(Visit).filter(Visit.patient_id == patient_id).delete(synchronize_session=False)

    # 6. Lepas foreign key mother_id jika pasien ini adalah ibu bagi pasien lain
    db.query(Patient).filter(Patient.mother_id == patient_id).update({Patient.mother_id: None}, synchronize_session=False)

    # 7. Hapus pasien
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

    # 1. Cari seluruh report_id dan visit_id dari pasien-pasien ini
    report_ids = [r[0] for r in db.query(Report.id).filter(Report.patient_id.in_(req.ids)).all()]
    visit_ids = [v[0] for v in db.query(Visit.id).filter(Visit.patient_id.in_(req.ids)).all()]

    # 2. Hapus pengajuan revisi terkait report atau visit
    if report_ids or visit_ids:
        rev_filters = []
        if report_ids:
            rev_filters.append(RevisionRequest.report_id.in_(report_ids))
        if visit_ids:
            rev_filters.append(RevisionRequest.visit_id.in_(visit_ids))
        db.query(RevisionRequest).filter(or_(*rev_filters)).delete(synchronize_session=False)

    # 3. Hapus audit logs terkait laporan pasien ini
    if report_ids:
        db.query(AuditLog).filter(AuditLog.report_id.in_(report_ids)).delete(synchronize_session=False)

    # 4. Hapus berkas PDF fisik
    reports = db.query(Report).filter(Report.patient_id.in_(req.ids)).all()
    for r in reports:
        if r.pdf_path and os.path.exists(r.pdf_path):
            try:
                os.remove(r.pdf_path)
            except Exception:
                pass

    # 5. Hapus reports dan visits
    db.query(Report).filter(Report.patient_id.in_(req.ids)).delete(synchronize_session=False)
    db.query(Visit).filter(Visit.patient_id.in_(req.ids)).delete(synchronize_session=False)

    # 6. Lepas foreign key mother_id untuk pasien yang merujuk ke pasien-pasien ini
    db.query(Patient).filter(Patient.mother_id.in_(req.ids)).update({Patient.mother_id: None}, synchronize_session=False)

    # 7. Hapus pasien-pasien
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
    Menarik riwayat longitudinal lengkap:
    - Data pasien saat ini beserta seluruh rekam kunjungannya.
    - Jika pasien adalah anak, secara otomatis menarik data & riwayat kehamilan Ibu.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    # Cek jangkauan akses kader
    if current_user.role == UserRole.KADER and current_user.village_name:
        if patient.village_name and patient.village_name.strip().lower() != current_user.village_name.strip().lower():
            raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    mother = None
    maternal_visits = []
    
    if patient.patient_type == PatientType.CHILD and patient.mother_id:
        mother = db.query(Patient).filter(Patient.id == patient.mother_id).first()
        if mother:
            m_visits = db.query(Visit).filter(Visit.patient_id == mother.id).order_by(Visit.visit_date.asc()).all()
            maternal_visits = [
                {
                    "id": v.id,
                    "visit_date": str(v.visit_date),
                    "trimester": v.trimester,
                    "lila_cm": v.lila_cm,
                    "hb_level": v.hb_level,
                    "maternal_weight_kg": v.maternal_weight_kg
                }
                for v in m_visits
            ]

    child_visits = db.query(Visit).filter(Visit.patient_id == patient.id).order_by(Visit.visit_date.asc()).all()
    c_visits_data = [
        {
            "id": v.id,
            "visit_date": str(v.visit_date),
            "phase": v.phase.value,
            "age_in_months": v.age_in_months,
            "child_weight_kg": v.child_weight_kg,
            "child_length_cm": v.child_length_cm
        }
        for v in child_visits
    ]

    return {
        "patient": patient,
        "mother": mother,
        "maternal_visits": maternal_visits,
        "child_visits": c_visits_data
    }
