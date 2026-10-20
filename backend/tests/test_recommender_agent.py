import pytest
from app.multiagent.agents.recommender import (
    clinical_recommender_agent,
    _generate_rule_based_recommendations,
    MODE_LLM_REACT,
    MODE_FALLBACK
)
from app.schemas.recommendation import RecommendationItem, CitationModel


def test_pydantic_recommendation_schema():
    """Menguji kepatuhan skema Pydantic untuk RecommendationItem."""
    valid_data = {
        "title": "Intervensi Gizi Stunting",
        "category": "GIZI",
        "recommendation_text": "Berikan telur 1 butir per hari dan PMT Pemulihan.",
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
    assert item.citation.source == "Buku KIA RI (2020)"
    assert item.citation.page == 12


def test_recommender_no_risk_flags():
    """Menguji bahwa pasien tanpa risiko langsung mengembalikan array kosong tanpa membuang kuota LLM."""
    state = {
        "phase": "BADUTA",
        "risk_flags": [],
        "risk_narrative": "Kondisi normal.",
        "deterministic_results": {},
        "retrieved_chunks": []
    }
    result = clinical_recommender_agent(state)
    assert result["recommendations"] == []
    assert result["recommender_mode"] == "NO_RISK"
    assert len(result["thought_process"]) >= 1


def test_recommender_deterministic_fallback():
    """Menguji generator aturan deterministik fallback."""
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
            "who_zscore": {"PB_U": {"z_score": -2.8, "category": "PENDEK"}}
        },
        "retrieved_chunks": [],
        "kader_feedback": None
    }
    result = clinical_recommender_agent(state)
    assert len(result["recommendations"]) >= 1
    assert result["recommender_mode"] in [MODE_LLM_REACT, MODE_FALLBACK]
    assert len(result["retrieved_chunks"]) >= 1
    assert len(result["thought_process"]) >= 1

    # Validasi tiap rekomendasi memiliki sitasi dan langkah aksi
    for rec in result["recommendations"]:
        assert "title" in rec
        assert "recommendation_text" in rec
        assert "citation" in rec
        assert "source" in rec["citation"]
