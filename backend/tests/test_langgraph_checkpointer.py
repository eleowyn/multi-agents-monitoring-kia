import pytest
from app.multiagent.graph import kia_multiagent_app, shared_checkpointer


def test_langgraph_stateful_checkpoint_persistence():
    """Menguji persistensi state per thread_id menggunakan checkpointer LangGraph."""
    thread_id = "test_thread_visit_99"
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "patient_id": 99,
        "visit_id": 99,
        "patient_data": {"name": "Balita Checkpointer", "nik": "7106000000000099", "village_name": "Airmadidi Atas"},
        "visit_data": {"phase": "BADUTA", "age_in_months": 14, "child_weight_kg": 7.0, "child_length_cm": 68.0},
        "phase": "BADUTA",
        "longitudinal_history": [],
        "maternal_history": {},
        "risk_flags": [],
        "risk_narrative": "",
        "deterministic_results": {},
        "requires_rag": False,
        "narrative_mode": "",
        "recommendations": [],
        "retrieved_chunks": [],
        "recommender_mode": None,
        "thought_process": [],
        "verification_details": [],
        "overall_status": "",
        "verifier_mode": None,
        "final_report_json": {},
        "iteration_count": 0,
        "kader_feedback": None,
        "is_approved_by_kader": None
    }

    # 1. Eksekusi pertama
    res1 = kia_multiagent_app.invoke(initial_state, config=config)
    assert res1["overall_status"] in ["PERLU_PERHATIAN", "RISIKO_TINGGI"]
    assert len(res1["risk_flags"]) >= 1

    # 2. Ambil snapshot state dari checkpointer LangGraph
    snapshot = kia_multiagent_app.get_state(config)
    assert snapshot is not None
    assert snapshot.values["patient_id"] == 99
    assert snapshot.values["overall_status"] == res1["overall_status"]
    assert snapshot.values["iteration_count"] == 0

    # 3. Simulasikan penolakan kader pada thread yang sama (Revisi 1x)
    revision_state = dict(snapshot.values)
    revision_state["kader_feedback"] = "Pasien alergi telur, ganti menu protein hewani."
    revision_state["iteration_count"] = 1

    res2 = kia_multiagent_app.invoke(revision_state, config=config)
    assert res2["iteration_count"] == 1

    # 4. Verifikasi snapshot setelah revisi
    snapshot2 = kia_multiagent_app.get_state(config)
    assert snapshot2.values["iteration_count"] == 1
    assert snapshot2.values["kader_feedback"] == "Pasien alergi telur, ganti menu protein hewani."
