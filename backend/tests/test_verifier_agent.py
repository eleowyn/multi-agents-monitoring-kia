import pytest
from app.multiagent.agents.verifier import (
    verification_and_report_agent,
    _lexical_grounding_check,
    MODE_LLM_JUDGE,
    MODE_SINGLE_PASS,
    MODE_FALLBACK
)


def test_verifier_single_pass_healthy():
    """Menguji eksekusi single-pass untuk balita sehat tanpa flag risiko."""
    state = {
        "phase": "BADUTA",
        "patient_data": {"name": "Balita Sehat", "nik": "7106000000000001", "village_name": "Airmadidi Atas"},
        "visit_data": {"age_in_months": 12, "child_weight_kg": 9.5, "child_length_cm": 75.0},
        "risk_flags": [],
        "risk_narrative": "Kondisi balita baik dan bertumbuh normal.",
        "deterministic_results": {"who_zscore": {"PB_U": {"z_score": 0.1, "category": "NORMAL"}}},
        "recommendations": [],
        "retrieved_chunks": [],
        "iteration_count": 0
    }
    result = verification_and_report_agent(state)
    assert result["overall_status"] == "KONDISI_BAIK"
    assert result["verifier_mode"] == MODE_SINGLE_PASS
    assert result["verification_details"] == []
    assert result["final_report_json"]["metadata"]["overall_status"] == "KONDISI_BAIK"
    assert "normal" in result["final_report_json"]["executive_summary"].lower()


def test_verifier_severe_risk_status():
    """Menguji penetapan status RISIKO_TINGGI jika ada flag risiko berat/stunting berat."""
    state = {
        "phase": "BADUTA",
        "patient_data": {"name": "Balita Berisiko", "nik": "7106000000000002"},
        "visit_data": {"age_in_months": 14},
        "risk_flags": [
            {"indicator": "PB_U", "flag": "RISIKO_STUNTING_BERAT", "detail": "PB/U Z-Score -3.5"}
        ],
        "risk_narrative": "Stunting berat terdeteksi.",
        "deterministic_results": {},
        "recommendations": [
            {
                "title": "Rujukan Segera Stunting",
                "category": "GIZI",
                "recommendation_text": "Rujuk ke Puskesmas untuk konfirmasi stunting dan berikan PMT.",
                "action_steps": ["Rujuk ke Puskesmas Airmadidi"],
                "citation": {"source": "KMK No. 1928/2022", "section": "Tata Laksana Stunting", "page": 18}
            }
        ],
        "retrieved_chunks": [
            {
                "id": "c_stunting_1",
                "source": "KMK No. 1928/2022",
                "section": "Tata Laksana Stunting",
                "page": 18,
                "content": "Balita dengan stunting berat wajib segera dirujuk ke Puskesmas untuk tata laksana."
            }
        ],
        "iteration_count": 0
    }
    result = verification_and_report_agent(state)
    assert result["overall_status"] == "RISIKO_TINGGI"
    assert len(result["verification_details"]) == 1
    detail = result["verification_details"][0]
    assert detail["title"] == "Rujukan Segera Stunting"
    assert detail["verification_status"] in ["VERIFIED", "AUTO_GROUNDED_SECONDARY"]
    assert detail["grounding_score"] >= 0.5


def test_verifier_moderate_risk_status():
    """Menguji penetapan status PERLU_PERHATIAN jika risiko bertaraf sedang (KEK / Anemia Ringan)."""
    state = {
        "phase": "IBU_HAMIL",
        "patient_data": {"name": "Ibu Hamil KEK", "nik": "7106000000000003"},
        "visit_data": {"lila_cm": 22.0, "hb_level": 11.2},
        "risk_flags": [
            {"indicator": "MATERNAL_LILA", "flag": "RISIKO_KEK", "detail": "LiLA 22.0 cm"}
        ],
        "risk_narrative": "Ibu mengalami KEK tanpa anemia berat.",
        "deterministic_results": {},
        "recommendations": [
            {
                "title": "PMT Ibu Hamil",
                "category": "GIZI_MATERNAL",
                "recommendation_text": "Berikan PMT 90 hari.",
                "action_steps": ["Paket PMT"],
                "citation": {"source": "Buku KIA RI", "section": "Gizi Ibu Hamil", "page": 8}
            }
        ],
        "retrieved_chunks": [
            {
                "id": "c_kek_1",
                "source": "Buku KIA RI",
                "section": "Gizi Ibu Hamil",
                "page": 8,
                "content": "Pemberian makanan tambahan pada ibu hamil KEK..."
            }
        ],
        "iteration_count": 0
    }
    result = verification_and_report_agent(state)
    assert result["overall_status"] == "PERLU_PERHATIAN"
    assert len(result["verification_details"]) == 1


def test_lexical_grounding_check():
    """Menguji fungsi scoring leksikal mandiri."""
    rec_title = "Pemberian Makanan Tambahan PMT Pemulihan"
    rec_text = "Berikan telur ayam dan makanan padat gizi untuk mengejar ketertinggalan berat badan balita."
    citation = {"source": "Buku KIA RI (2020)", "section": "Gizi Balita"}

    chunks_matching = [{
        "id": "chk_1",
        "source": "Buku KIA RI (2020)",
        "section": "Gizi Balita",
        "content": "Pemberian makanan tambahan PMT pemulihan dengan telur ayam dan makanan padat gizi untuk berat badan balita."
    }]

    is_grounded, score, evidence = _lexical_grounding_check(rec_title, rec_text, citation, chunks_matching)
    assert is_grounded is True
    assert score >= 0.5
    assert len(evidence) > 0

    chunks_unrelated = [{
        "id": "chk_2",
        "source": "Modul Imunisasi",
        "section": "Jadwal Vaksin",
        "content": "Imunisasi hepatitis B diberikan 24 jam setelah lahir."
    }]

    citation_unrelated = {"source": "Pedoman Lain"}
    is_grounded_bad, score_bad, _ = _lexical_grounding_check(rec_title, rec_text, citation_unrelated, chunks_unrelated)
    assert score_bad < score
