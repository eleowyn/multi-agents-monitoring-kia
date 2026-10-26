import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.multiagent.graph import build_kia_multiagent_graph

app = build_kia_multiagent_graph()

initial_state = {
    "patient_id": 999,
    "visit_id": 999,
    "phase": "IBU_HAMIL",
    "patient_data": {
        "name": "Ibu Hamil Tes",
        "nik": "7106012345670002",
        "village_name": "Airmadidi Atas"
    },
    "visit_data": {
        "trimester": 2,
        "gestational_age_weeks": 24,
        "maternal_weight_kg": 46.0,
        "maternal_height_cm": 148.0,
        "lila_cm": 21.0, # KEK
        "hb_level": 9.5,  # Anemia Sedang
        "systolic_bp": 110,
        "diastolic_bp": 70,
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
    "kader_feedback": None,
    "iteration_count": 0,
    "recommender_mode": None,
    "verifier_mode": None,
    "thought_process": []
}

print("=== STARTING DIAGNOSTIC MULTIAGENT FLOW ===")
t0 = time.time()
try:
    final_state = app.invoke(initial_state, config={"configurable": {"thread_id": "diag_test_1"}})
    t1 = time.time()
    print(f"\n[DONE in {t1 - t0:.2f} seconds]")
    print("Risk Narrative:", final_state.get("risk_narrative"))
    print("Risk Flags Count:", len(final_state.get("risk_flags", [])))
    print("Recommender Mode:", final_state.get("recommender_mode"))
    print("Recommendations Count:", len(final_state.get("recommendations", [])))
    print("Verifier Mode:", final_state.get("verifier_mode"))
    print("Overall Status:", final_state.get("overall_status"))
    print("Thought process:", final_state.get("thought_process"))
except Exception as e:
    t1 = time.time()
    print(f"\n[FAILED after {t1 - t0:.2f} seconds]: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
