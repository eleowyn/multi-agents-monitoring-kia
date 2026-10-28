import pytest
from app.multiagent.agents.recommender import (
    clinical_recommender_agent,
    _generate_rule_based_recommendations,
    build_comprehensive_care_plan,
    MODE_LLM_REACT,
    MODE_FALLBACK
)
from app.schemas.recommendation import RecommendationItem, CitationModel


def test_pydantic_recommendation_schema():
    """Menguji kepatuhan skema Pydantic untuk RecommendationItem termasuk field panduan lengkap."""
    valid_data = {
        "title": "Intervensi Gizi Stunting",
        "category": "GIZI",
        "recommendation_text": "Berikan telur 1 butir per hari dan PMT Pemulihan.",
        "food_guide": "Nasi tim ikan tude/cakalang + telur + sayur kelor 3x sehari.",
        "milk_and_supplements": "ASI lanjut hingga 24 bulan, Vitamin A, evaluasi Susu PKMK di Puskesmas.",
        "activity_and_stimulation": "Stimulasi motorik kasar berjalan dan bicara aktif tanpa layar HP.",
        "action_steps": ["Langkah 1", "Langkah 2"],
        "citation": {
            "source": "Buku KIA RI (2020)",
            "section": "Pemantauan Pertumbuhan",
            "page": 12,
            "chunk_id": "chunk_123"
        }
    }
    item = RecommendationItem(**valid_data)
    assert item.title == "Intervensi Gizi Stunting"
    assert item.category == "GIZI"
    assert "ikan tude" in item.food_guide
    assert "PKMK" in item.milk_and_supplements
    assert "motorik" in item.activity_and_stimulation
    assert item.citation.source == "Buku KIA RI (2020)"
    assert item.citation.page == 12


def test_recommender_no_risk_flags():
    """Menguji bahwa pasien tanpa risiko mengembalikan array recommendations kosong namun tetap menghasilkan care_plan 1.000 HPK lengkap."""
    state = {
        "phase": "BADUTA",
        "risk_flags": [],
        "risk_narrative": "Kondisi normal.",
        "deterministic_results": {"age_in_months": 10},
        "retrieved_chunks": []
    }
    result = clinical_recommender_agent(state)
    assert result["recommendations"] == []
    assert result["recommender_mode"] == "NO_RISK"
    assert len(result["thought_process"]) >= 1
    assert "care_plan" in result
    assert "food_and_nutrition" in result["care_plan"]
    assert "milk_and_supplements" in result["care_plan"]
    assert "activity_and_stimulation" in result["care_plan"]
    assert len(result["care_plan"]["food_and_nutrition"]["sample_daily_menu"]) >= 4


def test_build_comprehensive_care_plan_all_phases():
    """Menguji kelengkapan care_plan pada 3 fase 1.000 HPK (IBU_HAMIL, BAYI_BARU_LAHIR, BADUTA)."""
    cp_bumil = build_comprehensive_care_plan(
        phase="IBU_HAMIL",
        visit_data={"gestational_age_weeks": 24, "trimester": 2},
        risk_flags=[{"indicator": "MATERNAL_LILA", "flag": "RISIKO_KEK", "detail": "LiLA 22 cm"}],
    )
    assert cp_bumil["phase"] == "IBU_HAMIL"
    assert len(cp_bumil["food_and_nutrition"]["sample_daily_menu"]) == 5
    assert "TTD" in " ".join(cp_bumil["milk_and_supplements"]["guidelines"])

    cp_bbl = build_comprehensive_care_plan(
        phase="BAYI_BARU_LAHIR",
        visit_data={"birth_weight_gram": 2300},
        risk_flags=[{"indicator": "NEONATAL_BBLR", "flag": "RISIKO_BBLR", "detail": "BB Lahir 2300 g"}],
    )
    assert cp_bbl["phase"] == "BAYI_BARU_LAHIR"
    assert "ASI" in cp_bbl["milk_and_supplements"]["primary_source"]
    assert "Kanguru" in " ".join(cp_bbl["activity_and_stimulation"]["daily_activities"])

    cp_baduta = build_comprehensive_care_plan(
        phase="BADUTA",
        visit_data={"age_in_months": 8},
        risk_flags=[{"indicator": "PB_U", "flag": "RISIKO_STUNTING", "detail": "Pendek"}],
    )
    assert cp_baduta["phase"] == "BADUTA"
    assert "PKMK" in " ".join(cp_baduta["milk_and_supplements"]["guidelines"])


def test_recommender_deterministic_fallback():
    """Menguji generator aturan deterministik fallback menghasilkan panduan makanan, susu/ASI, dan aktivitas."""
    risk_flags = [
        {"indicator": "PB_U", "flag": "RISIKO_STUNTING_BERAT", "detail": "Panjang badan sangat pendek"},
        {"indicator": "MATERNAL_LILA", "flag": "RISIKO_KEK", "detail": "LiLA < 23.5 cm"},
        {"indicator": "MATERNAL_HB", "flag": "RISIKO_ANEMIA", "detail": "Hb < 11.0 g/dL"},
        {"indicator": "NEONATAL_BBLR", "flag": "RISIKO_BBLR", "detail": "BBLR < 2500 gram"}
    ]
    chunks = [{
        "id": "c1",
        "source": "Buku KIA RI",
        "section": "Kesehatan Bayi",
        "page": 20,
        "content": "Tata laksana BBLR dan stunting...",
        "category": "STUNTING"
    }]
    recs = _generate_rule_based_recommendations(risk_flags, chunks)
    assert len(recs) == 4
    categories = [r["category"] for r in recs]
    assert "GIZI" in categories
    assert "GIZI_MATERNAL" in categories
    assert "MEDIS" in categories
    assert "NEONATAL" in categories
    for r in recs:
        assert r.get("food_guide")
        assert r.get("milk_and_supplements")
        assert r.get("activity_and_stimulation")


def test_recommender_kader_feedback_handling():
    """Menguji penyesuaian rekomendasi saat ada feedback penolakan/alergi dari kader."""
    risk_flags = [
        {"indicator": "PB_U", "flag": "RISIKO_STUNTING", "detail": "PB/U Pendek"}
    ]
    chunks = [{
        "id": "c2",
        "source": "Pedoman Stunting KMK 1928/2022",
        "section": "Tata Laksana Gizi",
        "page": 15,
        "content": "Protein hewani untuk balita stunting...",
        "category": "STUNTING"
    }]
    # Feedback penolakan: Pasien alergi telur
    recs = _generate_rule_based_recommendations(
        risk_flags=risk_flags,
        chunks=chunks,
        kader_feedback="Pasien alergi telur, ganti menu protein hewani."
    )
    assert len(recs) == 1
    rec = recs[0]
    # Langkah aksi harus memuat edukasi alternatif non-alergen
    action_texts = " ".join(rec["action_steps"])
    assert "ikan" in action_texts or "ayam" in action_texts or "tahu" in action_texts
    assert "alergi" in rec["recommendation_text"].lower() or "catatan kader" in rec["recommendation_text"].lower()


def test_clinical_recommender_agent_full_flow():
    """Menguji eksekusi clinical_recommender_agent pada state baduta berisiko."""
    state = {
        "phase": "BADUTA",
        "risk_flags": [
            {"indicator": "PB_U", "flag": "RISIKO_STUNTING", "detail": "Panjang badan 69 cm pada usia 14 bulan."}
        ],
        "risk_narrative": "Baduta usia 14 bulan mengalami stunting.",
        "deterministic_results": {
            "who_zscore": {"PB_U": {"z_score": -2.8, "category": "PENDEK"}},
            "age_in_months": 14,
        },
        "retrieved_chunks": [],
        "kader_feedback": None
    }
    result = clinical_recommender_agent(state)
    assert len(result["recommendations"]) >= 1
    assert result["recommender_mode"] in [MODE_LLM_REACT, MODE_FALLBACK]
    assert len(result["retrieved_chunks"]) >= 1
    assert len(result["thought_process"]) >= 1
    assert "care_plan" in result

    # Validasi tiap rekomendasi memiliki sitasi, langkah aksi, serta panduan makanan/susu/aktivitas
    for rec in result["recommendations"]:
        assert "title" in rec
        assert "recommendation_text" in rec
        assert rec.get("food_guide")
        assert rec.get("milk_and_supplements")
        assert rec.get("activity_and_stimulation")
        assert "citation" in rec
        assert "source" in rec["citation"]
