from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.models.visit import Visit, PhaseEnum
from app.models.patient import Patient, PatientType
from app.models.report import Report, ReportStatus
from app.models.user import User
from app.schemas.visit import VisitCreate, VisitResponse
from app.schemas.report import ReportResponse
from app.api.v1.endpoints.auth import get_current_user
from app.multiagent.graph import kia_multiagent_app
from app.services.eval_logger import log_multiagent_parallel_evaluations

router = APIRouter()


def _months_between(birth: date, on: date) -> int:
    months = (on.year - birth.year) * 12 + (on.month - birth.month)
    if on.day < birth.day:
        months -= 1
    return max(0, months)


# Batas bawah usia kehamilan (minggu) per trimester bila minggu tidak diisi
_TRIMESTER_MIN_WEEKS = {1: 0, 2: 13, 3: 28}


def validate_visit_phase(
    patient: Patient,
    phase: PhaseEnum,
    visit_date: date,
    gestational_age_weeks: Optional[int] = None,
    trimester: Optional[int] = None,
    child_birth_dates: Optional[list] = None,
) -> Optional[str]:
    """
    Fase kunjungan harus sesuai tipe pasien dan umur anak pada tanggal kunjungan:
    - IBU_HAMIL hanya untuk pasien ibu; BAYI_BARU_LAHIR/BADUTA hanya untuk pasien anak.
    - BAYI_BARU_LAHIR: umur 0-28 hari. BADUTA: umur > 28 hari s.d. 24 bulan.
    Mengembalikan pesan kesalahan, atau None bila valid.
    """
    if visit_date > date.today():
        return "Tanggal kunjungan tidak boleh melewati hari ini."
    is_mother = patient.patient_type == PatientType.MOTHER
    if is_mother and phase != PhaseEnum.IBU_HAMIL:
        return "Pasien ibu hanya dapat dicatat pada fase Ibu Hamil. Catat bayi/baduta pada data pasien anak."
    if not is_mother and phase == PhaseEnum.IBU_HAMIL:
        return "Fase Ibu Hamil tidak dapat dipakai untuk pasien anak."
    if is_mother and child_birth_dates:
        # Awal kehamilan ini tidak boleh sebelum kelahiran anak sebelumnya
        weeks = gestational_age_weeks if gestational_age_weeks else _TRIMESTER_MIN_WEEKS.get(int(trimester or 0))
        if weeks is not None:
            from datetime import timedelta
            pregnancy_start = visit_date - timedelta(weeks=int(weeks))
            later_births = [b for b in child_birth_dates if b and b > pregnancy_start]
            if later_births:
                return (
                    f"Usia kehamilan {weeks} minggu pada {visit_date} berarti kehamilan dimulai sekitar {pregnancy_start}, "
                    f"sebelum anak terakhir lahir ({max(later_births)}). Periksa kembali usia kehamilan atau tanggal kunjungan."
                )
    if is_mother or not patient.birth_date:
        return None

    age_days = (visit_date - patient.birth_date).days
    if age_days < 0:
        return "Tanggal kunjungan tidak boleh sebelum tanggal lahir anak."
    if phase == PhaseEnum.BAYI_BARU_LAHIR and age_days > 28:
        return f"Fase Bayi Baru Lahir hanya untuk usia 0-28 hari (usia anak {age_days} hari). Gunakan fase Baduta."
    if phase == PhaseEnum.BADUTA:
        if age_days <= 28:
            return f"Usia anak {age_days} hari masih masa neonatus. Gunakan fase Bayi Baru Lahir."
        months = _months_between(patient.birth_date, visit_date)
        if months > 24:
            return f"Usia anak {months} bulan sudah melewati periode 1.000 HPK (0-24 bulan)."
    return None


@router.post("/", response_model=ReportResponse)
def create_visit_and_analyze(
    visit_in: VisitCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    1. Mencatat data kunjungan ke MySQL.
    2. Menarik data riwayat longitudinal pasien.
    3. Mengeksekusi orkestrasi Multi-Agent LangGraph secara real-time.
    4. Jika terdeteksi anomali biologis (Early Exit di Agent 1), record visit di-rollback & raise 422.
    5. Menyimpan draf laporan.
    6. Mendaftarkan background task evaluasi audit biner per-agent secara paralel.
    """
    patient = db.query(Patient).filter(Patient.id == visit_in.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    # Data Scoping: Pastikan kader melayani pasien di wilayah posyandunya
    from app.services.aggregates import in_kader_scope
    if not in_kader_scope(patient, current_user):
        raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    # Validasi fase terhadap tipe & umur pasien (Bab 1.5.1 no.2 & no.5)
    child_births = [c.birth_date for c in db.query(Patient).filter(Patient.mother_id == patient.id).all()]
    phase_error = validate_visit_phase(
        patient, visit_in.phase, visit_in.visit_date,
        visit_in.gestational_age_weeks, visit_in.trimester, child_births,
    )
    if phase_error:
        raise HTTPException(status_code=422, detail=phase_error)
    if patient.patient_type == PatientType.CHILD and visit_in.phase == PhaseEnum.BADUTA and patient.birth_date:
        # Usia baduta selalu diambil dari tanggal lahir, bukan isian manual
        visit_in.age_in_months = _months_between(patient.birth_date, visit_in.visit_date)

    # 1. Simpan Kunjungan Sementara
    visit = Visit(
        patient_id=visit_in.patient_id,
        kader_id=current_user.id,
        visit_date=visit_in.visit_date,
        phase=visit_in.phase,
        gestational_age_weeks=visit_in.gestational_age_weeks,
        trimester=visit_in.trimester,
        maternal_weight_kg=visit_in.maternal_weight_kg,
        maternal_height_cm=visit_in.maternal_height_cm,
        lila_cm=visit_in.lila_cm,
        hb_level=visit_in.hb_level,
        systolic_bp=visit_in.systolic_bp,
        diastolic_bp=visit_in.diastolic_bp,
        fundal_height_cm=visit_in.fundal_height_cm,
        ttd_consumption=visit_in.ttd_consumption,
        kspr_answers=visit_in.kspr_answers,
        birth_weight_gram=visit_in.birth_weight_gram,
        birth_length_cm=visit_in.birth_length_cm,
        head_circumference_cm=visit_in.head_circumference_cm,
        gestational_age_at_birth_weeks=visit_in.gestational_age_at_birth_weeks,
        early_initiation_breastfeeding=visit_in.early_initiation_breastfeeding,
        age_in_months=visit_in.age_in_months,
        child_weight_kg=visit_in.child_weight_kg,
        child_length_cm=visit_in.child_length_cm,
        child_head_circumference_cm=visit_in.child_head_circumference_cm,
        weight_trend_kms=visit_in.weight_trend_kms if visit_in.phase == PhaseEnum.BADUTA else None,
        feeding_status=visit_in.feeding_status,
        vitamin_a=visit_in.vitamin_a,
        immunization_status=visit_in.immunization_status,
        clinical_notes=visit_in.clinical_notes
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # 2. Persiapkan Context Longitudinal & Shared State melalui state_builder
    from app.multiagent.state_builder import build_initial_state

    initial_state = build_initial_state(
        db=db,
        visit=visit,
        patient=patient,
        village_fallback=current_user.village_name or "Airmadidi",
        kader_feedback=None,
        iteration_count=0
    )

    # 3. Eksekusi Multi-Agent LangGraph (Stateful Checkpointer per Visit ID)
    thread_config = {"configurable": {"thread_id": f"visit_{visit.id}_r0"}}
    try:
        final_state = kia_multiagent_app.invoke(initial_state, config=thread_config)
    except Exception as exc:
        # Jangan tinggalkan kunjungan tanpa laporan bila graf gagal
        db.delete(visit)
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Analisis multi-agent gagal ({type(exc).__name__}); kunjungan tidak disimpan. Silakan coba lagi.",
        )

    # 4. Validasi Early Exit: Jika data tidak plausibel secara biologis
    if final_state.get("is_data_plausible") is False:
        warnings = final_state.get("plausibility_warnings") or []
        # Rollback & Hapus record visit agar tidak mencemari grafik riwayat anak di bulan berikutnya
        db.delete(visit)
        db.commit()

        formatted_msg = (
            "Data pemeriksaan berada di luar batas biologis wajar manusia:\n"
            + "\n".join(f"{i+1}. {w}" for i, w in enumerate(warnings))
            + "\n\nKunjungan dibatalkan dan tidak disimpan. Silakan periksa kembali angka pengukuran dan ketik ulang."
        )
        raise HTTPException(
            status_code=422,
            detail=formatted_msg
        )

    # 5. Simpan Hasil ke Tabel Reports (Data Valid)
    report = Report(
        visit_id=visit.id,
        patient_id=patient.id,
        kader_id=current_user.id,
        risk_flags=final_state.get("risk_flags", []),
        risk_narrative=final_state.get("risk_narrative", ""),
        recommendations=final_state.get("recommendations", []),
        verification_summary=final_state.get("verification_details", []),
        overall_status=final_state.get("overall_status", "KONDISI_BAIK"),
        final_report_json=final_state.get("final_report_json", {}),
        status=ReportStatus.DRAFT,
        revision_count=0
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # 6. Background Task: Evaluasi Paralel Per-Agent (Agent 1, Agent 2, Agent 3)
    background_tasks.add_task(
        log_multiagent_parallel_evaluations,
        report_id=report.id,
        initial_state=initial_state,
        final_state=final_state,
        db=None
    )

    return report


@router.get("/{visit_id}", response_model=VisitResponse)
def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mengambil rincian data kunjungan berdasarkan ID."""
    visit = db.query(Visit).filter(Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Data kunjungan tidak ditemukan.")
    return visit
