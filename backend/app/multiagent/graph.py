from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from app.multiagent.state import AgentState
from app.multiagent.agents.risk_detector import risk_detection_agent
from app.multiagent.agents.recommender import clinical_recommender_agent
from app.multiagent.agents.verifier import verification_and_report_agent

# Shared in-memory checkpointer untuk menyimpan snapshot state per thread_id (visit/laporan)
shared_checkpointer = MemorySaver()


def should_route_to_recommender(state: AgentState) -> str:
    """
    Routing Kondisional LangGraph:
    Hanya teruskan ke Agent Rekomendasi Klinis RAG jika terdapat
    setidaknya satu flag risiko aktif yang memerlukan referensi rujukan.
    """
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

    # 3. Percabangan Kondisional dari Agent 1
    workflow.add_conditional_edges(
        "risk_detector",
        should_route_to_recommender,
        {
            "clinical_recommender": "clinical_recommender",
            "verifier": "verifier"
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
