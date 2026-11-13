"""Pengujian perbaikan PLAN_PERBAIKAN.md: chunk verbatim, kutipan, agregat, validasi fase."""
import os
import re
import sys
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.patient import PatientType
from app.models.report import ReportStatus
from app.models.user import UserRole
from app.models.visit import PhaseEnum
from app.multiagent.agents.recommender import attach_chunk_evidence
from app.multiagent.rag.ingest import KNOWLEDGE_BASE_DIR, chunk_markdown_file
from app.services import aggregates as agg
from app.api.v1.endpoints.visits import validate_visit_phase


# ---------- Chunk & kutipan ----------

def _words(text):
    return re.findall(r"[a-z]{4,}", text.lower())


@pytest.mark.parametrize("filename", [f for f in os.listdir(KNOWLEDGE_BASE_DIR) if f.lower().endswith(".md")])
def test_markdown_chunks_only_contain_book_words(filename):
    """Setiap kata pada chunk harus ada di file sumber (tidak ada teks tambahan)."""
    path = os.path.join(KNOWLEDGE_BASE_DIR, filename)
    source_words = set(_words(open(path, encoding="utf-8").read()))
    chunks = chunk_markdown_file(path, "uji", "uji")
    assert chunks
    for c in chunks:
        extra = set(_words(c["content"])) - source_words
        assert not extra, f"{c['id']} memuat kata di luar dokumen: {sorted(extra)[:5]}"
        assert "jdih.kemkes.go.id" not in c["content"]
        assert "KIA 2024 Book" not in c["content"]


def test_quote_is_verbatim_chunk_content():
    chunk = {"id": "md_kia24_0001", "content": "Teks asli buku.", "source": "Buku KIA", "page": "12", "origin": "MARKDOWN_DOC"}
    item = {"title": "X", "citation": {"chunk_id": "md_kia24_0001", "source": "karangan LLM"}, "evidence_quote": "kutipan karangan"}
    out = attach_chunk_evidence(item, {chunk["id"]: chunk})
    assert out["evidence_quote"] == "Teks asli buku."
    assert out["citation"]["source"] == "Buku KIA"
    assert out["evidence_status"] == "CHUNK_DOKUMEN"


def test_unknown_chunk_id_gives_no_quote():
    out = attach_chunk_evidence({"citation": {"chunk_id": "tidak_ada"}, "evidence_quote": "x"}, {})
    assert out["evidence_quote"] is None
    assert out["evidence_status"] == "TANPA_KUTIPAN"
    assert out["citation"]["source"] is None


# ---------- Wilayah & agregat ----------

def test_same_village_is_exact_not_substring():
    assert agg.same_village("Desa Sarongsong 1", "Sarongsong Satu")
    assert not agg.same_village("Airmadidi", "Airmadidi Atas")
    assert not agg.same_village("Airmadidi Atas", "Airmadidi Bawah")


def test_kader_scope_denies_patient_without_village_or_other_village():
    kader = SimpleNamespace(role=UserRole.KADER, village_name="Sukur", posyandu_name="Posyandu Cempaka")
    assert agg.in_kader_scope(SimpleNamespace(village_name="Sukur", posyandu_name=None), kader)
    assert not agg.in_kader_scope(SimpleNamespace(village_name="Sawangan", posyandu_name="Posyandu Cempaka"), kader)
    assert not agg.in_kader_scope(SimpleNamespace(village_name=None, posyandu_name=None), kader)


def _patient(pid, ptype, mother_id=None, birth=None):
    return SimpleNamespace(id=pid, patient_type=ptype, mother_id=mother_id, birth_date=birth, village_name="Sukur")


def _report(rid, pid, flags, visit_date, status=ReportStatus.APPROVED, overall="PERLU_PERHATIAN"):
    return SimpleNamespace(
        id=rid, patient_id=pid, visit_id=rid, status=status, overall_status=overall,
        risk_flags=[{"flag": f} for f in flags], visit=SimpleNamespace(visit_date=visit_date),
    )


def test_kek_counts_pregnant_mothers_only():
    mother = _patient(1, PatientType.MOTHER)
    child = _patient(2, PatientType.CHILD, mother_id=1, birth=date(2026, 3, 1))
    pregnant = _patient(3, PatientType.MOTHER)
    patients = [mother, child, pregnant]
    reports = [
        _report(1, 1, ["RISIKO_KEK_MATERNAL"], date(2026, 1, 10)),          # sebelum melahirkan
        _report(2, 2, ["RIWAYAT_IBU_KEK", "RISIKO_STUNTING"], date(2026, 6, 1)),
        _report(3, 3, ["RISIKO_KEK_MATERNAL", "RISIKO_ANEMIA_RINGAN"], date(2026, 6, 1)),
        _report(4, 3, ["RISIKO_KEK_MATERNAL"], date(2026, 7, 1), status=ReportStatus.DRAFT),
    ]
    totals = agg.summarize(patients, reports, agg.children_index(patients))
    assert totals == {"stunting": 1, "kek": 1, "anemia": 1, "high_risk": 0}


# ---------- Validasi fase kunjungan ----------

def test_validate_visit_phase_rules():
    today = date.today()
    mother = SimpleNamespace(patient_type=PatientType.MOTHER, birth_date=None)
    newborn = SimpleNamespace(patient_type=PatientType.CHILD, birth_date=today - timedelta(days=10))
    toddler = SimpleNamespace(patient_type=PatientType.CHILD, birth_date=today - timedelta(days=400))
    old = SimpleNamespace(patient_type=PatientType.CHILD, birth_date=today - timedelta(days=800))

    assert validate_visit_phase(mother, PhaseEnum.IBU_HAMIL, today) is None
    assert validate_visit_phase(mother, PhaseEnum.BADUTA, today)
    assert validate_visit_phase(newborn, PhaseEnum.IBU_HAMIL, today)
    assert validate_visit_phase(newborn, PhaseEnum.BAYI_BARU_LAHIR, today) is None
    assert validate_visit_phase(newborn, PhaseEnum.BADUTA, today)
    assert validate_visit_phase(toddler, PhaseEnum.BAYI_BARU_LAHIR, today)
    assert validate_visit_phase(toddler, PhaseEnum.BADUTA, today) is None
    assert validate_visit_phase(old, PhaseEnum.BADUTA, today)
    assert validate_visit_phase(toddler, PhaseEnum.BADUTA, today + timedelta(days=1))
    assert validate_visit_phase(newborn, PhaseEnum.BAYI_BARU_LAHIR, today - timedelta(days=20))


# ---------- Gizi Agent 2 sesuai hasil analisis ----------

from app.multiagent.agents.recommender import (
    build_comprehensive_care_plan,
    nutrition_text_mismatch,
    _generate_rule_based_recommendations,
)
from app.multiagent.tools.anthropometry_check import check_head_circumference


def _txt(d):
    import json
    return json.dumps(d, ensure_ascii=False).lower()


def test_care_plan_overweight_child_gets_no_catch_up_advice():
    cp = build_comprehensive_care_plan(phase="BADUTA", visit_data={"age_in_months": 15}, risk_flags=[{"flag": "RISIKO_GIZI_LEBIH"}])
    t = _txt(cp)
    assert "kejar tumbuh" not in t and "mengejar berat badan" not in t
    assert "jangan menambah porsi" in t


def test_care_plan_history_flag_is_not_growth_problem():
    cp = build_comprehensive_care_plan(phase="BADUTA", visit_data={"age_in_months": 15}, risk_flags=[{"flag": "RIWAYAT_IBU_KEK"}])
    assert "kejar tumbuh" not in _txt(cp)


def test_care_plan_does_not_guess_missing_trimester_or_age():
    mom = build_comprehensive_care_plan(phase="IBU_HAMIL", visit_data={"lila_cm": 25, "hb_level": 12}, risk_flags=[])
    assert "belum tercatat" in mom["age_or_trimester_label"]
    child = build_comprehensive_care_plan(phase="BADUTA", visit_data={}, risk_flags=[])
    assert "belum tercatat" in child["age_or_trimester_label"]


def test_care_plan_pmt_only_for_kek_mother():
    normal = build_comprehensive_care_plan(phase="IBU_HAMIL", visit_data={"trimester": 2, "lila_cm": 25, "hb_level": 12}, risk_flags=[])
    kek = build_comprehensive_care_plan(phase="IBU_HAMIL", visit_data={"trimester": 2, "lila_cm": 22, "hb_level": 12}, risk_flags=[{"flag": "RISIKO_KEK_MATERNAL"}])
    assert "pmt" not in _txt(normal)
    assert "pmt" in _txt(kek)


def test_nutrition_guard_rejects_condition_not_detected():
    assert nutrition_text_mismatch("PMT pemulihan untuk ibu KEK.", "IBU_HAMIL", None, [])
    assert nutrition_text_mismatch("Ibu KEK perlu PMT.", "IBU_HAMIL", None, ["RISIKO_KEK_MATERNAL"]) is None
    assert nutrition_text_mismatch("Minum TTD untuk mencegah anemia.", "IBU_HAMIL", None, []) is None
    assert nutrition_text_mismatch("Bubur saring kental 3 kali sehari.", "BADUTA", 4, [])
    assert nutrition_text_mismatch("Atasi kekurangan zat besi.", "IBU_HAMIL", None, []) is None


def test_fallback_overweight_child_not_treated_as_stunting():
    cp = build_comprehensive_care_plan(phase="BADUTA", visit_data={"age_in_months": 15}, risk_flags=[{"flag": "RISIKO_OBESITAS"}])
    recs = _generate_rule_based_recommendations([{"flag": "RISIKO_OBESITAS", "detail": "BB/PB > +3 SD"}], [], care_plan=cp)
    t = _txt(recs)
    assert "konfirmasi stunting" not in t and "pkmk" not in t and "lemak tambahan pada mp-asi" in t
    assert recs[0]["title"].startswith("Konfirmasi Gizi Lebih")


def test_head_circumference_uses_kia_table_by_gender():
    assert check_head_circumference(32.0, gender="L")["status"] == "NORMAL"
    assert check_head_circumference(31.9, gender="L")["status"] == "MIKROSEFALI"
    assert check_head_circumference(31.5, gender="P")["status"] == "NORMAL"
    assert check_head_circumference(37.0, gender="P")["status"] == "MAKROSEFALI"
    assert check_head_circumference(32.0)["status"] == "TIDAK_DINILAI"


def test_pregnancy_cannot_start_before_last_child_birth():
    today = date.today()
    mother = SimpleNamespace(patient_type=PatientType.MOTHER, birth_date=None)
    born_2_weeks_ago = [today - timedelta(days=14)]
    assert validate_visit_phase(mother, PhaseEnum.IBU_HAMIL, today, 16, 2, born_2_weeks_ago)
    born_2_years_ago = [today - timedelta(days=730)]
    assert validate_visit_phase(mother, PhaseEnum.IBU_HAMIL, today, 16, 2, born_2_years_ago) is None
