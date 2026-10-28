import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.multiagent.tools.hpk_tracker import calculate_1000_hpk_status
from app.multiagent.agents.risk_detector import risk_detection_agent


def test_1000_hpk_calculator():
    """Menguji kalkulator deterministik 1.000 HPK untuk ketiga fase."""
    hpk_mother = calculate_1000_hpk_status(patient_type="MOTHER", phase="IBU_HAMIL", trimester=2)
    assert hpk_mother["hpk_day"] == 140
    assert hpk_mother["progress_percent"] == 14.0
    assert hpk_mother["remaining_days"] == 860

    hpk_nb = calculate_1000_hpk_status(patient_type="CHILD", phase="BAYI_BARU_LAHIR")
    assert hpk_nb["hpk_day"] == 277
    assert hpk_nb["remaining_days"] == 723

    hpk_baduta = calculate_1000_hpk_status(patient_type="CHILD", phase="BADUTA", age_in_months=12)
    assert hpk_baduta["hpk_day"] == 635
    assert hpk_baduta["progress_percent"] == 63.5


def test_longitudinal_risk_detector_3_phases():
    """Menguji deteksi risiko longitudinal 3 fase."""
    state_mother = {
        "patient_id": 301,
        "visit_id": 401,
        "phase": "IBU_HAMIL",
        "patient_data": {"name": "Ny. Rina", "nik": "7106010001", "patient_type": "MOTHER"},
        "visit_data": {
            "trimester": 3,
            "lila_cm": 22.5,
            "hb_level": 10.2,
            "maternal_weight_kg": 54.0,
            "kspr_answers": [],
        },
        "longitudinal_history": [
            {
                "visit_id": 400,
                "visit_date": "2026-07-01",
                "phase": "IBU_HAMIL",
                "trimester": 2,
                "lila_cm": 22.8,
                "hb_level": 10.4,
                "maternal_weight_kg": 55.2,
            }
        ],
        "maternal_history": None,
    }
    res_mother = risk_detection_agent(state_mother)
    mother_flags = [f["flag"] for f in res_mother["risk_flags"]]
    assert "BB_IBU_HAMIL_TURUN" in mother_flags
    assert "RISIKO_KEK_MATERNAL" in mother_flags
    assert "KEK_PERSISTEN_ANTAR_KUNJUNGAN" in mother_flags
    assert res_mother["deterministic_results"]["maternal_trend"]["is_persistent_kek"] is True
    assert res_mother["deterministic_results"]["hpk_status"]["hpk_day"] == 238

    state_baduta = {
        "patient_id": 302,
        "visit_id": 402,
        "phase": "BADUTA",
        "patient_data": {"name": "Anak Rina", "nik": "7106010002", "gender": "L", "patient_type": "CHILD"},
        "visit_data": {"age_in_months": 6, "child_length_cm": 64.0, "child_weight_kg": 7.0},
        "longitudinal_history": [
            {
                "visit_id": 398,
                "visit_date": "2026-06-01",
                "phase": "BADUTA",
                "age_in_months": 4,
                "child_length_cm": 63.9,
                "child_weight_kg": 7.0,
            },
            {
                "visit_id": 399,
                "visit_date": "2026-07-01",
                "phase": "BADUTA",
                "age_in_months": 5,
                "child_length_cm": 64.0,
                "child_weight_kg": 7.0,
            },
        ],
        "maternal_history": {
            "mother_name": "Ny. Rina",
            "is_kek": True,
            "min_maternal_lila_cm": 22.5,
            "is_anemia": True,
            "min_maternal_hb": 10.2,
            "birth_weight_gram": 2350,
        },
    }
    res_baduta = risk_detection_agent(state_baduta)
    baduta_flags = [f["flag"] for f in res_baduta["risk_flags"]]
    assert "RIWAYAT_IBU_KEK" in baduta_flags
    assert "RIWAYAT_IBU_ANEMIA" in baduta_flags
    assert "RIWAYAT_BBLR_ANAK" in baduta_flags
    assert "BB_TIDAK_NAIK_2T" in baduta_flags
    assert res_baduta["deterministic_results"]["hpk_status"]["hpk_day"] == 453


def test_1000_hpk_graduation_milestone_and_compliance():
    """Menguji milestone kelulusan hari ke-1000 (usia 24 bulan) dan kepatuhan medis ASI vs Formula/PKMK."""
    from app.multiagent.agents.recommender import build_comprehensive_care_plan, clinical_recommender_agent

    # 1. Uji Care Plan Usia 24 Bulan (Kelulusan Normal Bebas Stunting)
    cp_normal = build_comprehensive_care_plan(
        phase="BADUTA",
        visit_data={"age_in_months": 24, "child_weight_kg": 12.0, "child_length_cm": 87.0},
        risk_flags=[],
    )
    assert "graduation_package" in cp_normal
    grad_normal = cp_normal["graduation_package"]
    assert grad_normal["is_graduation"] is True
    assert grad_normal["graduation_status"] == "LULUS_OPTIMAL_BEBAS_STUNTING"
    assert "Weaning with Love" in grad_normal["weaning_guidance"]["title"]
    assert "Isi Piringku Balita" in grad_normal["toddler_nutrition_transition"]["title"]
    assert "KPSP" in grad_normal["kpsp_24_months"]["title"]
    assert "ASI Standar Emas" in grad_normal["medical_compliance"]["badge"]

    # 2. Uji Care Plan Usia 24 Bulan dengan Stunting (Perhatian Khusus)
    cp_stunting = build_comprehensive_care_plan(
        phase="BADUTA",
        visit_data={"age_in_months": 24, "child_weight_kg": 9.2, "child_length_cm": 78.5},
        risk_flags=[{"flag": "STUNTING_BERAT", "detail": "PB/U < -3 SD"}],
    )
    grad_stunting = cp_stunting["graduation_package"]
    assert grad_stunting["graduation_status"] == "PERHATIAN_KHUSUS_STUNTING"
    assert "Dokter Spesialis Anak" in grad_stunting["exit_assessment"]
    assert "Susu PKMK" in cp_stunting["milk_and_supplements"]["recommended_type"]

    # 3. Uji Agen Rekomendasi Menyisipkan Item Kelulusan di Posisi Pertama Saat Ada Risiko Pertumbuhan
    state_grad = {
        "phase": "BADUTA",
        "visit_data": {"age_in_months": 24, "child_weight_kg": 9.5, "child_length_cm": 80.0},
        "risk_flags": [{"flag": "STUNTING_RINGAN", "detail": "PB/U -2.2 SD"}],
        "deterministic_results": {"hpk_status": {"is_graduation_milestone": True, "hpk_day": 1000}},
        "kader_feedback": None,
    }
    rec_res = clinical_recommender_agent(state_grad)
    recs = rec_res["recommendations"]
    assert len(recs) > 0
    assert recs[0]["category"] == "KELULUSAN_1000_HPK"
    assert "Milestone Hari ke-1.000" in recs[0]["title"]

