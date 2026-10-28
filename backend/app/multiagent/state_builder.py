"""
Penyusun Shared State awal LangGraph.

Satu fungsi ini dipakai oleh analisis kunjungan pertama, revisi akibat penolakan
kader, dan re-evaluasi setelah revisi data disetujui admin. Dengan begitu data
yang sama selalu menghasilkan konteks (dan flag risiko) yang sama.
"""
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.patient import Patient, PatientType
from app.models.visit import Visit, PhaseEnum
from app.multiagent.tools.hpk_tracker import calculate_1000_hpk_status
from app.multiagent.tools.kspr import calculate_kspr
from app.multiagent.tools.anemia import classify_maternal_anemia

KEK_LILA_THRESHOLD_CM = 23.5


def _enum_value(v: Any) -> Any:
    return v.value if hasattr(v, "value") else v


def snapshot_visit_data(visit: Visit, patient: Optional[Patient] = None) -> Dict[str, Any]:
    """Seluruh kolom klinis kunjungan (semua fase) + usia ibu yang dihitung otomatis."""
    data = {
        "visit_date": str(visit.visit_date),
        "phase": _enum_value(visit.phase),
        "gestational_age_weeks": visit.gestational_age_weeks,
        "trimester": visit.trimester,
        "maternal_weight_kg": visit.maternal_weight_kg,
        "maternal_height_cm": visit.maternal_height_cm,
        "lila_cm": visit.lila_cm,
        "hb_level": visit.hb_level,
        "systolic_bp": visit.systolic_bp,
        "diastolic_bp": visit.diastolic_bp,
        "fundal_height_cm": visit.fundal_height_cm,
        "kspr_answers": visit.kspr_answers or [],
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
    # Usia ibu untuk aturan KSPR otomatis (<=16 / >=35 tahun) dihitung dari tanggal lahir
    if patient is not None and patient.patient_type == PatientType.MOTHER and patient.birth_date:
        data["maternal_age"] = _age_in_years(patient.birth_date, visit.visit_date)
    return data


def _age_in_years(birth: date, on: date) -> int:
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def build_longitudinal_history(db: Session, patient_id: int, current_visit: Visit) -> List[Dict[str, Any]]:
    """Kunjungan sebelumnya (urut kronologis lama -> baru) sebelum/pada tanggal kunjungan ini."""
    past: List[Visit] = (
        db.query(Visit)
        .filter(
            Visit.patient_id == patient_id,
            Visit.id != current_visit.id,
            Visit.visit_date <= current_visit.visit_date,
        )
        .order_by(Visit.visit_date.asc(), Visit.id.asc())
        .all()
    )
    return [
        {
            "id": v.id,
            "visit_date": str(v.visit_date),
            "phase": _enum_value(v.phase),
            "trimester": v.trimester,
            "gestational_age_weeks": v.gestational_age_weeks,
            "age_in_months": v.age_in_months,
            "child_weight_kg": v.child_weight_kg,
            "child_length_cm": v.child_length_cm,
            "birth_weight_gram": v.birth_weight_gram,
            "birth_length_cm": v.birth_length_cm,
            "gestational_age_at_birth_weeks": v.gestational_age_at_birth_weeks,
            "early_initiation_breastfeeding": v.early_initiation_breastfeeding,
            "maternal_weight_kg": v.maternal_weight_kg,
            "maternal_height_cm": v.maternal_height_cm,
            "lila_cm": v.lila_cm,
            "hb_level": v.hb_level,
            "systolic_bp": v.systolic_bp,
            "diastolic_bp": v.diastolic_bp,
            "kspr_answers": v.kspr_answers or [],
            "weight_trend_kms": v.weight_trend_kms,
            "feeding_status": v.feeding_status,
            "vitamin_a": v.vitamin_a,
        }
        for v in past
    ]


def build_maternal_history(db: Session, patient: Patient) -> Optional[Dict[str, Any]]:
    """
    Riwayat lintas generasi 1.000 HPK untuk pasien anak:
    - is_kek: ibu pernah LiLA < 23,5 cm pada kunjungan kehamilan;
    - is_anemia: ibu pernah mengalami anemia berdasarkan ambang Hb per trimester;
    - is_high_risk_kspr: ibu pernah memiliki skor KSPR >= 6 (KRT / KRST);
    - birth_weight_gram / gestational_age_at_birth_weeks: dari kunjungan fase
      BAYI_BARU_LAHIR milik anak itu sendiri.
    """
    if patient.patient_type != PatientType.CHILD:
        return None

    history: Dict[str, Any] = {
        "mother_id": patient.mother_id,
        "mother_name": None,
        "mother_nik": None,
        "maternal_visits_count": 0,
        "is_kek": False,
        "min_maternal_lila_cm": None,
        "is_anemia": False,
        "min_maternal_hb": None,
        "anemia_severity": None,
        "is_high_risk_kspr": False,
        "max_kspr_score": 2,
        "kspr_category": "KRR",
        "birth_weight_gram": None,
        "birth_length_cm": None,
        "gestational_age_at_birth_weeks": None,
        "early_initiation_breastfeeding": None,
    }

    if patient.mother_id:
        mother = db.query(Patient).filter(Patient.id == patient.mother_id).first()
        if mother:
            history["mother_name"] = mother.name
            history["mother_nik"] = mother.nik

        m_visits = (
            db.query(Visit)
            .filter(Visit.patient_id == patient.mother_id)
            .order_by(Visit.visit_date.asc())
            .all()
        )
        history["maternal_visits_count"] = len(m_visits)

        lilas = [v.lila_cm for v in m_visits if v.lila_cm is not None]
        if lilas:
            history["min_maternal_lila_cm"] = min(lilas)
            history["is_kek"] = min(lilas) < KEK_LILA_THRESHOLD_CM

        hbs = []
        for v in m_visits:
            if v.hb_level is not None:
                hbs.append(v.hb_level)
                anemia_res = classify_maternal_anemia(float(v.hb_level), trimester=int(v.trimester or 1))
                if anemia_res["status"] != "NORMAL":
                    history["is_anemia"] = True
                    history["anemia_severity"] = anemia_res["severity_label"]
        if hbs:
            history["min_maternal_hb"] = min(hbs)

        for v in m_visits:
            m_age = None
            if mother and mother.birth_date and v.visit_date:
                m_age = _age_in_years(mother.birth_date, v.visit_date)
            kspr_res = calculate_kspr(
                selected_risk_keys=v.kspr_answers or [],
                maternal_age=m_age,
                maternal_height_cm=v.maternal_height_cm,
                systolic_bp=v.systolic_bp,
                diastolic_bp=v.diastolic_bp,
            )
            if kspr_res["total_score"] > history["max_kspr_score"]:
                history["max_kspr_score"] = kspr_res["total_score"]
                history["kspr_category"] = kspr_res["category"]
            if kspr_res["category"] in ("KRT", "KRST"):
                history["is_high_risk_kspr"] = True

    birth_visit = (
        db.query(Visit)
        .filter(
            Visit.patient_id == patient.id,
            Visit.phase == PhaseEnum.BAYI_BARU_LAHIR,
            Visit.birth_weight_gram.isnot(None),
        )
        .order_by(Visit.visit_date.asc())
        .first()
    )
    if birth_visit:
        history["birth_weight_gram"] = birth_visit.birth_weight_gram
        history["birth_length_cm"] = birth_visit.birth_length_cm
        history["gestational_age_at_birth_weeks"] = birth_visit.gestational_age_at_birth_weeks
        history["early_initiation_breastfeeding"] = birth_visit.early_initiation_breastfeeding

    return history


def build_initial_state(
    db: Session,
    visit: Visit,
    patient: Patient,
    village_fallback: Optional[str] = None,
    kader_feedback: Optional[str] = None,
    iteration_count: int = 0,
) -> Dict[str, Any]:
    """Menyusun Shared State Memory awal untuk graf multi-agent."""
    phase_str = _enum_value(visit.phase)
    p_type_str = _enum_value(patient.patient_type)
    hpk_status = calculate_1000_hpk_status(
        phase=phase_str,
        patient_type=p_type_str,
        birth_date=patient.birth_date,
        visit_date=visit.visit_date,
        gestational_age_weeks=visit.gestational_age_weeks,
        trimester=visit.trimester,
        age_in_months=visit.age_in_months,
    )

    v_data = snapshot_visit_data(visit, patient)
    v_data["hpk_status"] = hpk_status

    return {
        "patient_id": patient.id,
        "visit_id": visit.id,
        "phase": phase_str,
        "patient_data": {
            "name": patient.name,
            "nik": patient.nik,
            "patient_type": p_type_str,
            "gender": _enum_value(patient.gender) if patient.gender else None,
            "birth_date": str(patient.birth_date) if patient.birth_date else None,
            "village_name": patient.village_name or village_fallback or "Airmadidi",
            "posyandu_name": patient.posyandu_name,
            "mother_id": patient.mother_id,
            "hpk_status": hpk_status,
        },
        "visit_data": v_data,
        "longitudinal_history": build_longitudinal_history(db, patient.id, visit),
        "maternal_history": build_maternal_history(db, patient),
        "risk_flags": [],
        "risk_narrative": "",
        "deterministic_results": {},
        "requires_rag": False,
        "narrative_mode": "",
        "recommendations": [],
        "retrieved_chunks": [],
        "verification_details": [],
        "overall_status": "",
        "final_report_json": {},
        "iteration_count": iteration_count,
        "kader_feedback": kader_feedback,
        "is_approved_by_kader": None,
    }
