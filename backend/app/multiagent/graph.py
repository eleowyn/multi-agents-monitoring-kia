from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from app.multiagent.state import AgentState
from app.multiagent.agents.risk_detector import risk_detection_agent
from app.multiagent.agents.recommender import clinical_recommender_agent
from app.multiagent.agents.verifier import verification_and_report_agent

# Shared in-memory checkpointer untuk menyimpan snapshot state per thread_id (visit/laporan)
shared_checkpointer = MemorySaver()


def should_route_from_risk_detector(state: AgentState) -> str:
    """
    Routing Kondisional LangGraph:
    1. Jika data tidak plausibel secara biologis (anomali), langsung CUT ke END (Early Exit).
    2. Jika terdapat flag risiko aktif, teruskan ke Agent Rekomendasi Klinis RAG.
    3. Jika tidak ada risiko (pasien sehat), langsung ke verifier.
    """
    if state.get("is_data_plausible") is False:
        return END
    if state.get("requires_rag", False):
        return "clinical_recommender"
    return "verifier"


def build_kia_multiagent_graph(checkpointer=shared_checkpointer):
    """
    Membangun graf orkestrasi Multi-Agent AI LangGraph untuk pemantauan KIA.
    Terdiri dari 3 node agent fungsional dengan conditional routing dan checkpointer state.
    """
    workflow = StateGraph(AgentState)

    # 1. Daftarkan Nodes
    workflow.add_node("risk_detector", risk_detection_agent)
    workflow.add_node("clinical_recommender", clinical_recommender_agent)
    workflow.add_node("verifier", verification_and_report_agent)

    # 2. Atur Entry Point
    workflow.set_entry_point("risk_detector")

    # 3. Percabangan Kondisional dari Agent 1 (mendukung Early Exit ke END)
    workflow.add_conditional_edges(
        "risk_detector",
        should_route_from_risk_detector,
        {
            "clinical_recommender": "clinical_recommender",
            "verifier": "verifier",
            END: END
        }
    )

    # 4. Alur dari Agent 2 menuju Agent 3
    workflow.add_edge("clinical_recommender", "verifier")

    # 5. Selesai di Agent 3 (menghasilkan draft siap review kader)
    workflow.add_edge("verifier", END)

    # Compile Graf dengan dukungan checkpointer
    if checkpointer is not None:
        return workflow.compile(checkpointer=checkpointer)
    return workflow.compile()


# Instance graf siap pakai
kia_multiagent_app = build_kia_multiagent_graph()
