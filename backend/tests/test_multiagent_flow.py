import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.multiagent.graph import build_kia_multiagent_graph
from app.multiagent.rag.ingest import ingest_knowledge_base
from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.services.pdf_service import generate_visit_report_pdf


@pytest.fixture(scope="module")
def setup_knowledge_base():
    """Memastikan knowledge base ChromaDB terindeks sebelum pengujian graf."""
    count = ingest_knowledge_base()
    assert count > 0
    return count


def test_rag_retrieval(setup_knowledge_base):
    """Menguji semantic retrieval pada ChromaDB."""
    chunks = retrieve_clinical_guidelines("stunting gizi buruk balita", n_results=2)
    assert len(chunks) > 0
    assert "content" in chunks[0]
    assert "source" in chunks[0]


def test_multiagent_flow_risky_baduta(setup_knowledge_base):
    """
    Skenario 1: Baduta dengan Stunting & Gizi Buruk
    Alur: Agent 1 -> Agent 2 (RAG) -> Agent 3 (Laporan Risiko Tinggi)
    """
    app = build_kia_multiagent_graph()

    initial_state = {
        "patient_id": 101,
        "visit_id": 201,
        "phase": "BADUTA",
        "patient_data": {
            "name": "Anak Tes Riset",
            "nik": "7106012345670001",
            "gender": "L",
            "village_name": "Airmadidi Atas"
        },
        "visit_data": {
            "age_in_months": 12,
            "child_length_cm": 68.0, # Normal 75.7 -> Z < -3.0 (Stunting Berat)
            "child_weight_kg": 6.5   # Normal 9.6 -> Z < -2.0
        },
        "longitudinal_history": [],
        "maternal_history": {"birth_weight_gram": 2200}, # Riwayat BBLR
        "risk_flags": [],
        "risk_narrative": "",
        "deterministic_results": {},
        "requires_rag": False,
        "recommendations": [],
        "retrieved_chunks": [],
        "verification_details": [],
        "overall_status": "",
        "final_report_json": {},
        "iteration_count": 0,
        "kader_feedback": None,
        "is_approved_by_kader": None
    }

    config = {"configurable": {"thread_id": f"test_visit_{initial_state['visit_id']}"}}
    final_state = app.invoke(initial_state, config=config)

    # Verifikasi Alur & Luaran Agent
    assert final_state["requires_rag"] is True
    assert len(final_state["risk_flags"]) >= 2
    assert final_state["overall_status"] == "RISIKO_TINGGI"
    assert len(final_state["recommendations"]) > 0
    assert "metadata" in final_state["final_report_json"]
    assert "recommendations" in final_state["final_report_json"]


def test_multiagent_flow_healthy_baduta(setup_knowledge_base):
    """
    Skenario 2: Baduta Normal / Sehat
    Alur Pintas: Agent 1 -> Agent 3 (Melompati Agent 2, Status KONDISI_BAIK)
    """
    app = build_kia_multiagent_graph()

    initial_state = {
        "patient_id": 102,
        "visit_id": 202,
        "phase": "BADUTA",
        "patient_data": {
            "name": "Anak Sehat",
            "nik": "7106012345670002",
            "gender": "L",
            "village_name": "Sarongsong Satu"
        },
        "visit_data": {
            "age_in_months": 12,
            "child_length_cm": 75.7, # Normal persis median (Z = 0.0)
            "child_weight_kg": 9.6   # Normal persis median (Z = 0.0)
        },
        "longitudinal_history": [],
        "maternal_history": None,
        "risk_flags": [],
        "risk_narrative": "",
        "deterministic_results": {},
        "requires_rag": False,
        "recommendations": [],
        "retrieved_chunks": [],
        "verification_details": [],
        "overall_status": "",
        "final_report_json": {},
        "iteration_count": 0,
        "kader_feedback": None,
        "is_approved_by_kader": None
    }

    config = {"configurable": {"thread_id": f"test_visit_{initial_state['visit_id']}"}}
    final_state = app.invoke(initial_state, config=config)

    assert final_state["requires_rag"] is False
    assert len(final_state["risk_flags"]) == 0
    assert final_state["overall_status"] == "KONDISI_BAIK"
    assert len(final_state["recommendations"]) == 0


def test_multiagent_flow_maternal_kek_anemia(setup_knowledge_base):
    """
    Skenario 3: Ibu Hamil dengan LiLA KEK dan Anemia Trimester 2
    """
    app = build_kia_multiagent_graph()

    initial_state = {
        "patient_id": 103,
        "visit_id": 203,
        "phase": "IBU_HAMIL",
        "patient_data": {
            "name": "Ny. Maria",
            "nik": "7106012345670003",
            "village_name": "Airmadidi Bawah"
        },
        "visit_data": {
            "trimester": 2,
            "lila_cm": 22.0,       # KEK (< 23.5 cm)
            "hb_level": 9.8,       # Anemia Ringan Trimester 2 (< 10.5 g/dL)
            "kspr_answers": []
        },
        "longitudinal_history": [],
        "maternal_history": None,
        "risk_flags": [],
        "risk_narrative": "",
        "deterministic_results": {},
        "requires_rag": False,
        "recommendations": [],
        "retrieved_chunks": [],
        "verification_details": [],
        "overall_status": "",
        "final_report_json": {},
        "iteration_count": 0,
        "kader_feedback": None,
        "is_approved_by_kader": None
    }

    config = {"configurable": {"thread_id": f"test_visit_{initial_state['visit_id']}"}}
    final_state = app.invoke(initial_state, config=config)

    assert final_state["requires_rag"] is True
    assert any(f["flag"] == "RISIKO_KEK_MATERNAL" for f in final_state["risk_flags"])
    assert any(f["flag"] == "RISIKO_ANEMIA_RINGAN" for f in final_state["risk_flags"])
    assert len(final_state["recommendations"]) > 0


def test_pdf_generation():
    """Menguji pembentukan laporan PDF/HTML WeasyPrint."""
    sample_report = {
        "metadata": {
            "phase": "BADUTA",
            "patient_name": "Anak Uji PDF",
            "patient_nik": "7106012345670099",
            "village_name": "Airmadidi",
            "overall_status": "PERLU_PERHATIAN"
        },
        "executive_summary": "Pasien membutuhkan pemantauan gizi tambahan.",
        "clinical_findings": {
            "risk_narrative": "Terdapat penurunan berat badan.",
            "active_risk_flags": [
                {"indicator": "BB_U", "flag": "RISIKO_UNDERWEIGHT", "detail": "Berat badan kurang dari median."}
            ]
        },
        "recommendations": [
            {
                "title": "Pemberian PMT",
                "category": "GIZI",
                "recommendation_text": "Berikan makanan tambahan kaya protein.",
                "action_steps": ["Telur 1 butir/hari"],
                "citation": {"source": "Buku KIA RI", "section": "Gizi Balita", "page": 32}
            }
        ]
    }

    path = generate_visit_report_pdf(
        report_data=sample_report,
        visit_date="2026-08-25",
        kader_name="Kader Siti",
        validated_date="2026-08-25",
        filename="test_report.pdf"
    )
    assert os.path.exists(path)

