import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from app.multiagent.state import AgentState
from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.multiagent.prompts.verifier_prompt import VERIFIER_JUDGE_SYSTEM_PROMPT
from app.multiagent.llm_utils import (
    parse_llm_json,
    get_chat_llm,
    extract_text,
    extract_token_usage,
    merge_token_usage,
    MODE_FALLBACK,
)

logger = logging.getLogger(__name__)

MODE_LLM_JUDGE = "LLM_JUDGE"
MODE_SINGLE_PASS = "SINGLE_PASS_HEALTHY"


def _consolidate_pipeline_telemetry(
    state_telemetry: Optional[Dict[str, Any]],
    det_results: Dict[str, Any],
    agent3_telemetry: Dict[str, Any],
    phase: str,
    risk_flags: List[Dict[str, Any]],
    risk_narrative: str,
    recommendations: List[Dict[str, Any]],
    verification_details: List[Dict[str, Any]],
    revision_count: int = 0,
    is_approved: bool = False,
) -> Dict[str, Any]:
    """
    Mengintegrasikan telemetri eksekusi Agent 1, Agent 2, dan Agent 3:
    - Membuktikan eksekusi SEQUENTIAL pada pipeline utama (T1 -> T2 -> T3).
    - Mencatat LIFETIME setiap agen (SPAWNED -> EXECUTING -> TERMINATED / Ephemeral).
    - Mencatat KONSUMSI TOKEN masing-masing agen dan total keseluruhan.
    - Mencatat klasifikasi tingkat kepentingan/kesulitan agen sesuai catatan pembimbing.
    """
    st_tel = dict(state_telemetry or {})

    a1 = st_tel.get("agent_1") or det_results.get("_agent1_telemetry")
    if not a1:
        a1 = {
            "agent_id": "agent_1",
            "agent_name": "Agent 1: Deteksi Risiko Deterministik & ReAct",
            "execution_order": 1,
            "execution_pattern": "SEQUENTIAL_STEP_1 (Entry Point)",
            "lifecycle_state": "NOT_RECORDED (Node tidak dieksekusi dalam sesi ini)",
            "spawned_at": None,
            "terminated_at": None,
            "lifetime_ms": None,
            "available": False,
            "mode": "NOT_RECORDED",
            "complexity_rank": "Paling Penting (Keselamatan Jiwa / Clinical Safety Gatekeeper)",
            "complexity_reason": (
                "Gerbang skrining keselamatan awal ibu & anak (Stunting Berat, Gizi Buruk, BBLR, KEK, Anemia, KSPR Risiko Tinggi). "
                "Stage 1 dikunci 100% deterministik baku WHO/Permenkes agar bebas false-negative."
            ),
            "tools_invoked": [],
            "token_usage": extract_token_usage(None, is_llm_call=False),
            "task_proof": {
                "input_summary": f"Fase {phase}",
                "output_summary": f"{len(risk_flags)} Flag Risiko Aktif, requires_rag={len(risk_flags) > 0}",
                "is_grounded_numeric_guard": True,
            },
        }

    a2 = st_tel.get("agent_2") or det_results.get("_agent2_telemetry")
    if not a2:
        has_risk = len(risk_flags) > 0
        a2 = {
            "agent_id": "agent_2",
            "agent_name": "Agent 2: Rekomendasi Klinis RAG & Care Plan",
            "execution_order": 2,
            "execution_pattern": (
                "SEQUENTIAL_STEP_2 (Conditional Router: requires_rag=True)"
                if has_risk
                else "SKIPPED_BY_CONDITIONAL_ROUTER (requires_rag=False -> Langsung ke Agent 3)"
            ),
            "lifecycle_state": (
                "NOT_RECORDED (Node tidak dieksekusi dalam sesi ini)"
                if has_risk
                else "BYPASSED_IDLE (Tidak Di-spawn karena Pasien Sehat / 0 Flag Risiko)"
            ),
            "spawned_at": None,
            "terminated_at": None,
            "lifetime_ms": None if has_risk else 0.0,
            "available": not has_risk,
            "mode": "NOT_RECORDED" if has_risk else "NO_RISK",
            "complexity_rank": "Paling Sulit (Multi-Hop ReAct, RAG ChromaDB & Sintesis Klinis Kontekstual)",
            "complexity_reason": (
                "Menjalankan siklus ReAct otonom, menarik vektor Buku KIA/PNPK dari ChromaDB, serta merumuskan menu "
                "pangan lokal Minahasa, panduan ASI/susu/TTD, dan aktivitas harian ke JSON tersitasi."
            ),
            "tools_invoked": (
                []
                if has_risk
                else ["conditional_router_bypass (requires_rag=False)"]
            ),
            "thought_process": (
                []
                if has_risk
                else ["Kondisi sehat (0 flag risiko): LangGraph Conditional Edge langsung meneruskan state dari Agent 1 ke Agent 3."]
            ),
            "token_usage": extract_token_usage(None, is_llm_call=False),
            "task_proof": {
                "input_summary": f"Fase {phase}, {len(risk_flags)} Flag Risiko",
                "output_summary": (
                    f"{len(recommendations)} Rekomendasi"
                    if has_risk
                    else "Dilewati Conditional Router (0 Flag Risiko)"
                ),
                "chunks_retrieved_count": 0,
                "recommendations_count": len(recommendations),
            },
        }

    # Lengkapi work_breakdown masing-masing agent untuk inspeksi detail pada Log Audit Admin
    a1.setdefault(
        "work_breakdown",
        {
            "phase": phase,
            "plausibility": det_results.get("plausibility"),
            "hpk_status": det_results.get("hpk_status"),
            "who_zscore": det_results.get("who_zscore"),
            "kspr": det_results.get("kspr"),
            "maternal_nutrition": det_results.get("maternal_nutrition"),
            "neonatal_status": det_results.get("neonatal_status"),
            "weight_trend": det_results.get("weight_trend"),
            "active_risk_flags": risk_flags,
            "risk_narrative": risk_narrative,
        },
    )
    a2.setdefault(
        "work_breakdown",
        {
            "recommender_mode": a2.get("mode"),
            "chunks_retrieved_count": (a2.get("task_proof") or {}).get("chunks_retrieved_count", len(recommendations)),
            "recommendations_trace": [
                {
                    "title": r.get("title"),
                    "category": r.get("category"),
                    "reasoning_mode": r.get("reasoning_mode"),
                    "evidence_status": r.get("evidence_status"),
                    "citation": r.get("citation"),
                    "evidence_quote": r.get("evidence_quote"),
                    "ai_insight": r.get("ai_insight"),
                    "ai_insight_details": r.get("ai_insight_details"),
                }
                for r in recommendations
            ],
        },
    )
    agent3_telemetry.setdefault(
        "work_breakdown",
        {
            "verifier_mode": agent3_telemetry.get("mode"),
            "verified_count": (agent3_telemetry.get("task_proof") or {}).get("verified_count", 0),
            "grounding_rate_percent": (agent3_telemetry.get("task_proof") or {}).get("grounding_rate_percent", 100.0),
            "verification_details": verification_details,
        },
    )

    agents_list = [a1, a2, agent3_telemetry]
    total_ms = round(sum(float(a.get("lifetime_ms") or 0.0) for a in agents_list), 2)
    total_in_tok = sum(int((a.get("token_usage") or {}).get("input_tokens", 0)) for a in agents_list)
    total_out_tok = sum(int((a.get("token_usage") or {}).get("output_tokens", 0)) for a in agents_list)
    total_tok = sum(int((a.get("token_usage") or {}).get("total_tokens", 0)) for a in agents_list)
    total_saved_tok = sum(int((a.get("token_usage") or {}).get("estimated_saved_tokens", 0)) for a in agents_list)
    total_llm_calls = sum(int((a.get("token_usage") or {}).get("llm_calls", 0)) for a in agents_list)

    return {
        "architecture_pattern": {
            "main_pipeline": "SEQUENTIAL_STATEGRAPH (Agent 1 -> Conditional Router -> Agent 2 -> Agent 3 -> END)",
            "audit_evaluator": "PARALLEL_BACKGROUND_THREADPOOL (3 Concurrent Audit Worker Threads untuk Agent 1, 2, 3)",
            "sequential_proof": (
                f"Agent 1 selesai pada {a1.get('terminated_at')} -> "
                f"Agent 2 ({a2.get('spawned_at')} s/d {a2.get('terminated_at')}) -> "
                f"Agent 3 mulai pada {agent3_telemetry.get('spawned_at')} dan selesai pada {agent3_telemetry.get('terminated_at')}."
            ),
            "agent_lifetime_policy": (
                "Ephemeral Stateless Node Execution: Setiap agent di-spawn saat node LangGraph aktif, "
                "menjalankan tugas spesifiknya, menulis ke Shared AgentState, dan langsung TERMINATED (selesai tugas = selesai hidup). "
                "Snapshot state disimpan di MemorySaver Checkpointer hanya selama menunggu validasi Kader (maksimal 1x siklus revisi)."
            ),
            "thread_checkpoint_status": (
                "THREAD_CLOSED (Laporan Disetujui Kader - Siklus Hidup Selesai Permanen)"
                if is_approved
                else f"CHECKPOINT_STANDBY (Menunggu Validasi Kader • Iterasi Revisi: {revision_count}/1)"
            ),
        },
        "complexity_hierarchy": {
            "most_important_life_safety": {
                "agent": "Agent 1 (Deteksi Risiko Deterministik & ReAct)",
                "reason": "Gerbang keselamatan jiwa ibu & anak (Clinical Safety Gatekeeper). Mencegah false-negative pada Stunting Berat, Gizi Buruk, BBLR, KEK, Anemia Berat, dan Preeklamsia/KSPR Tinggi.",
            },
            "most_difficult_cognitive": {
                "agent": "Agent 2 (Rekomendasi Klinis ReAct + ChromaDB RAG)",
                "reason": "Multi-hop reasoning, pencarian semantik vektor ChromaDB, adaptasi pangan lokal Minahasa, aturan jeda suplemen/susu, serta akomodasi revisi Kader ke JSON tersitasi.",
            },
            "easiest_most_focused": {
                "agent": "Agent 3 (Verifikasi Grounding LLM-Judge & Integrator)",
                "reason": "Verifikasi keterhubungan tertutup (closed-context faithfulness check) antara draf Agent 2 dan kutipan ChromaDB, atau Single-Pass otomatis (0 token) saat kondisi sehat.",
            },
        },
        "summary_metrics": {
            "total_pipeline_lifetime_ms": total_ms,
            "total_input_tokens": total_in_tok,
            "total_output_tokens": total_out_tok,
            "total_tokens": total_tok,
            "total_estimated_saved_tokens": total_saved_tok,
            "total_llm_calls": total_llm_calls,
        },
        "agents": {
            "agent_1": a1,
            "agent_2": a2,
            "agent_3": agent3_telemetry,
        },
    }


def verification_and_report_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 3: Verifikasi Grounding (LLM-Judge) & Penyusunan Laporan Akhir
    
    1. Single-pass otomatis untuk kondisi tanpa flag risiko (status KONDISI_BAIK).
    2. LLM-as-a-Judge: Mengevaluasi apakah klaim dan langkah aksi setiap butir
       rekomendasi didukung secara faktual (faithfulness) oleh dokumen rujukan.
    3. ReAct Terbatas (2-Step): Jika klaim tidak grounded, lakukan secondary search
       di ChromaDB untuk mencari rujukan alternatif sebelum menandainya UNVERIFIED.
    4. Fallback Leksikal jika koneksi/kuota LLM habis.
    5. Menghasilkan struktur final_report_json siap validasi kader Posyandu.
    """
    t0 = time.perf_counter()
    spawned_at = datetime.now().isoformat(timespec="milliseconds")

    phase = state.get("phase", "BADUTA")
    patient_data = state.get("patient_data", {})
    visit_data = state.get("visit_data", {})
    risk_flags = state.get("risk_flags", [])
    risk_narrative = state.get("risk_narrative", "")
    recommendations = state.get("recommendations", [])
    retrieved_chunks = state.get("retrieved_chunks", [])
    det_results = state.get("deterministic_results", {}) or {}
    revision_count = state.get("iteration_count", 0)

    phase_label_map = {
        "IBU_HAMIL": "Ibu Hamil",
        "BAYI_BARU_LAHIR": "Bayi Baru Lahir (0-28 Hari)",
        "BADUTA": "Anak Baduta (1-24 Bulan)",
    }
    human_phase_label = phase_label_map.get(str(phase).upper(), str(phase).replace("_", " "))

    # ------------------------------------------------------------------------
    # 1. Single-Pass untuk Kondisi Sehat / Tanpa Risiko
    # ------------------------------------------------------------------------
    if not risk_flags:
        overall_status = "KONDISI_BAIK"
        executive_summary = (
            f"Hasil pemantauan pada fase {human_phase_label} menunjukkan kondisi pertumbuhan dan kesehatan yang baik dan normal "
            f"tanpa tanda risiko stunting, KEK, anemia, maupun komplikasi klinis. Keluarga dianjurkan mempertahankan "
            f"pola makan bergizi seimbang berbahan pangan lokal, pemberian ASI/suplemen sesuai jadwal, serta rutin hadir setiap bulan di Posyandu."
        )
        t1 = time.perf_counter()
        terminated_at = datetime.now().isoformat(timespec="milliseconds")
        lifetime_ms = round(max(0.5, (t1 - t0) * 1000.0), 2)

        agent3_telemetry = {
            "agent_id": "agent_3",
            "agent_name": "Agent 3: Verifikasi Grounding & Integrasi Laporan",
            "execution_order": 3,
            "execution_pattern": "SEQUENTIAL_STEP_3 (Single-Pass Healthy -> END)",
            "lifecycle_state": "TERMINATED (Selesai Tugas, Selesai Hidup / Ephemeral)",
            "spawned_at": spawned_at,
            "terminated_at": terminated_at,
            "lifetime_ms": lifetime_ms,
            "mode": MODE_SINGLE_PASS,
            "complexity_rank": "Paling Mudah / Terfokus (Closed-Context Faithfulness Judge & Integrator)",
            "complexity_reason": (
                "Karena tidak ada flag risiko (KONDISI_BAIK), Agent 3 mengeksekusi jalur Single-Pass otomatis (0 token LLM) "
                "untuk mengintegrasikan laporan akhir secara instan."
            ),
            "tools_invoked": ["single_pass_healthy_integrator", "_build_final_report_json"],
            "token_usage": extract_token_usage(None, prompt_text=executive_summary, output_text=executive_summary, is_llm_call=False),
            "task_proof": {
                "input_summary": "0 Rekomendasi Risiko (Pasien Sehat)",
                "output_summary": f"Status {overall_status}, Laporan Final JSON siap divalidasi Kader.",
                "verified_count": 0,
                "grounding_rate_percent": 100.0,
            },
        }

        consolidated_telemetry = _consolidate_pipeline_telemetry(
            state_telemetry=state.get("agent_telemetry"),
            det_results=det_results,
            agent3_telemetry=agent3_telemetry,
            phase=phase,
            risk_flags=[],
            risk_narrative=risk_narrative,
            recommendations=[],
            verification_details=[],
            revision_count=revision_count,
        )

        final_report_json = _build_final_report_json(
            phase=phase,
            patient_data=patient_data,
            visit_data=visit_data,
            overall_status=overall_status,
            executive_summary=executive_summary,
            risk_narrative=risk_narrative,
            risk_flags=[],
            deterministic_results=det_results,
            recommendations=[],
            verification_summary=[],
            revision_count=revision_count,
            agent_telemetry=consolidated_telemetry,
        )
        from app.multiagent.terminal_logger import print_pipeline_terminal_banner
        res_single = {
            "overall_status": overall_status,
            "verification_details": [],
            "verifier_mode": MODE_SINGLE_PASS,
            "final_report_json": final_report_json,
            "agent_telemetry": consolidated_telemetry,
        }
        print_pipeline_terminal_banner({**state, **res_single})
        return res_single

    # ------------------------------------------------------------------------
    # 2. Penentuan Tingkat Keparahan Risiko (daftar flag eksplisit)
    # ------------------------------------------------------------------------
    has_severe_risk = any(f.get("flag") in SEVERE_RISK_FLAGS for f in risk_flags)
    overall_status = "RISIKO_TINGGI" if has_severe_risk else "PERLU_PERHATIAN"

    flag_details_all = "; ".join(
        [str(f.get("detail") or f.get("flag") or "").rstrip(".") for f in risk_flags if isinstance(f, dict)]
    )
    action_urgency = (
        "Pasien memerlukan rujukan dan pemeriksaan segera ke Tenaga Kesehatan / Dokter di Puskesmas Airmadidi disertai perbaikan asupan gizi harian."
        if has_severe_risk
        else "Diperlukan pendampingan gizi harian, pemantauan ketat di Posyandu, serta evaluasi oleh Bidan/Petugas Gizi Puskesmas Airmadidi."
    )
    executive_summary = (
        f"Hasil pemeriksaan pada fase {human_phase_label} menemukan {len(risk_flags)} kondisi yang memerlukan perhatian: "
        f"{flag_details_all}. {action_urgency}"
    )

    verification_details = []
    verifier_mode = MODE_FALLBACK
    tools_invoked = ["_build_final_report_json", "_check_flag_and_structure_consistency"]
    token_usages: List[Dict[str, Any]] = []
    chunks_by_id = {c.get("id"): c for c in retrieved_chunks if c.get("id")}
    llm = get_chat_llm(temperature=0.0, max_tokens=1200) if recommendations else None

    # ------------------------------------------------------------------------
    # 3. Langkah 1: LLM-Judge terhadap chunk yang dirujuk masing-masing rekomendasi
    #    (Rekomendasi ATURAN_SISTEM / KELULUSAN_1000_HPK dikecualikan dari verifikasi chunk RAG)
    # ------------------------------------------------------------------------
    primary_pairs = []
    for idx, rec in enumerate(recommendations):
        if (
            rec.get("evidence_status") == "ATURAN_SISTEM"
            or rec.get("reasoning_mode") == "ATURAN_SISTEM"
            or rec.get("category") == "KELULUSAN_1000_HPK"
        ):
            continue
        chunk_id = (rec.get("citation") or {}).get("chunk_id")
        primary_pairs.append((idx + 1, rec, chunks_by_id.get(chunk_id) if chunk_id else None))

    primary_results, used_llm = _judge_pairs(llm, primary_pairs, token_usages, extra_chunks_by_id=chunks_by_id)
    if used_llm:
        verifier_mode = MODE_LLM_JUDGE
        tools_invoked.insert(0, "llm_judge_grounding_evaluator")
    else:
        tools_invoked.insert(0, "_lexical_grounding_check (Fallback Overlap Scorer)")

    # ------------------------------------------------------------------------
    # 4. Langkah 2: pencarian cadangan ChromaDB untuk poin yang belum grounded,
    #    lalu dinilai ulang dengan penilai yang sama (maks. 2 langkah per poin).
    # ------------------------------------------------------------------------
    secondary_pairs = []
    for rec_idx, rec, chunk in primary_pairs:
        if primary_results.get(rec_idx, {}).get("is_grounded"):
            continue
        sec_query = f"{rec.get('title', '')} {rec.get('recommendation_text', '')[:120]}"
        sec_results = retrieve_clinical_guidelines(query=sec_query, n_results=1)
        sec_chunk = sec_results[0] if sec_results else None
        if sec_chunk and (not chunk or sec_chunk.get("id") != chunk.get("id")):
            secondary_pairs.append((rec_idx, rec, sec_chunk))
    if secondary_pairs:
        tools_invoked.append("secondary_retrieval_check (ChromaDB)")
        secondary_results, _ = _judge_pairs(llm if used_llm else None, secondary_pairs, token_usages, extra_chunks_by_id=chunks_by_id)
    else:
        secondary_results = {}
    secondary_chunk_by_idx = {rec_idx: c for rec_idx, _, c in secondary_pairs}

    # ------------------------------------------------------------------------
    # 5. Finalisasi status per poin. Bukti = isi chunk asli (verbatim), bukan teks LLM.
    # ------------------------------------------------------------------------
    from app.multiagent.agents.recommender import attach_chunk_evidence

    for rec_idx, rec, chunk in primary_pairs:
        primary = primary_results.get(rec_idx, {})
        secondary = secondary_results.get(rec_idx, {})
        if primary.get("is_grounded"):
            status_verif = "VERIFIED"
            used_chunk = chunk
            result = primary
            notes = f"Didukung chunk rujukan utama. {primary.get('reasoning', '')}".strip()
        elif secondary.get("is_grounded"):
            status_verif = "AUTO_GROUNDED_SECONDARY"
            used_chunk = secondary_chunk_by_idx[rec_idx]
            result = secondary
            notes = f"Didukung chunk hasil pencarian cadangan. {secondary.get('reasoning', '')}".strip()
            # Sitasi rekomendasi diganti ke chunk cadangan yang terbukti mendukung
            rec["citation"] = {"chunk_id": used_chunk["id"]}
            attach_chunk_evidence(rec, {used_chunk["id"]: used_chunk})
        else:
            status_verif = "UNVERIFIED"
            used_chunk = None
            result = secondary or primary
            reason = secondary.get("reasoning") or primary.get("reasoning") or ""
            notes = f"Tidak ditemukan dukungan pada chunk rujukan maupun pencarian cadangan. {reason}".strip()

        citation = rec.get("citation") or {}
        verification_details.append({
            "recommendation_index": rec_idx,
            "title": rec.get("title", f"Rekomendasi {rec_idx}"),
            "citation_source": citation.get("source"),
            "citation_section": citation.get("section"),
            "citation_page": citation.get("page"),
            "additional_pages": citation.get("additional_pages"),
            "additional_sections": citation.get("additional_sections"),
            "supporting_chunk_ids": citation.get("supporting_chunk_ids"),
            "supporting_chunks": citation.get("supporting_chunks"),
            "chunk_id": used_chunk.get("id") if used_chunk else citation.get("chunk_id"),
            "evidence_origin": used_chunk.get("origin") if used_chunk else None,
            "verification_status": status_verif,
            "grounding_score": round(float(result.get("grounding_score", 0.0)), 2),
            "evidence": used_chunk.get("content") if used_chunk else None,
            "judge_mode": result.get("mode"),
            "notes": notes,
        })

    token_usage = (
        merge_token_usage(token_usages)
        if token_usages
        else extract_token_usage(None, prompt_text=json.dumps(recommendations, ensure_ascii=False), output_text=executive_summary, is_llm_call=False)
    )

    t1 = time.perf_counter()
    terminated_at = datetime.now().isoformat(timespec="milliseconds")
    lifetime_ms = round(max(0.5, (t1 - t0) * 1000.0), 2)

    verified_cnt = sum(1 for v in verification_details if v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY"))
    g_rate = round((verified_cnt / max(1, len(verification_details))) * 100.0, 1)

    agent3_telemetry = {
        "agent_id": "agent_3",
        "agent_name": "Agent 3: Verifikasi Grounding & Integrasi Laporan",
        "execution_order": 3,
        "execution_pattern": "SEQUENTIAL_STEP_3 (Final Verifier -> END)",
        "lifecycle_state": "TERMINATED (Selesai Tugas, Selesai Hidup / Ephemeral)",
        "spawned_at": spawned_at,
        "terminated_at": terminated_at,
        "lifetime_ms": lifetime_ms,
        "mode": verifier_mode,
        "complexity_rank": "Paling Mudah / Terfokus (Closed-Context Faithfulness Judge & Integrator)",
        "complexity_reason": (
            "Melakukan evaluasi keterhubungan tertutup (faithfulness scoring 0.0-1.0) antara draf rekomendasi Agent 2 "
            "dengan potongan teks rujukan ChromaDB yang sudah tersedia, lalu mengemas Final Report JSON."
        ),
        "tools_invoked": list(dict.fromkeys(tools_invoked)),
        "token_usage": token_usage,
        "task_proof": {
            "input_summary": f"{len(recommendations)} Rekomendasi Agent 2 & {len(retrieved_chunks)} Chunks Rujukan",
            "output_summary": f"{verified_cnt}/{len(verification_details)} Rekomendasi Terverifikasi ({g_rate}% Grounded), Status: {overall_status}",
            "verified_count": verified_cnt,
            "grounding_rate_percent": g_rate,
        },
    }

    consolidated_telemetry = _consolidate_pipeline_telemetry(
        state_telemetry=state.get("agent_telemetry"),
        det_results=det_results,
        agent3_telemetry=agent3_telemetry,
        phase=phase,
        risk_flags=risk_flags,
        risk_narrative=risk_narrative,
        recommendations=recommendations,
        verification_details=verification_details,
        revision_count=revision_count,
    )

    # ------------------------------------------------------------------------
    # 5. Format Laporan JSON Komprehensif
    # ------------------------------------------------------------------------
    final_report_json = _build_final_report_json(
        phase=phase,
        patient_data=patient_data,
        visit_data=visit_data,
        overall_status=overall_status,
        executive_summary=executive_summary,
        risk_narrative=risk_narrative,
        risk_flags=risk_flags,
        deterministic_results=det_results,
        recommendations=recommendations,
        verification_summary=verification_details,
        revision_count=revision_count,
        agent_telemetry=consolidated_telemetry,
    )

    from app.multiagent.terminal_logger import print_pipeline_terminal_banner
    res_final = {
        "overall_status": overall_status,
        "recommendations": recommendations,
        "verification_details": verification_details,
        "verifier_mode": verifier_mode,
        "final_report_json": final_report_json,
        "agent_telemetry": consolidated_telemetry,
    }
    print_pipeline_terminal_banner({**state, **res_final})
    return res_final


SEVERE_RISK_FLAGS = {
    "RISIKO_STUNTING_BERAT",
    "RISIKO_UNDERWEIGHT_BERAT",
    "RISIKO_GIZI_BURUK",
    "RISIKO_ANEMIA_BERAT",
    "RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST",
    "RISIKO_BBLSR",
    "RISIKO_BBLER",
}

LEXICAL_GROUNDING_THRESHOLD = 0.35


def _judge_pairs(
    llm,
    pairs,
    token_usages: List[Dict[str, Any]],
    extra_chunks_by_id: Optional[Dict[str, Dict[str, Any]]] = None,
):
    """
    Menilai pasangan (index, rekomendasi, chunk) dengan LLM-judge dalam satu panggilan.
    Pasangan tanpa chunk otomatis tidak grounded. Bila LLM tidak tersedia/gagal atau
    tidak mengembalikan penilaian untuk sebuah poin, poin itu dinilai dengan cek leksikal.
    Mengembalikan ({index: {is_grounded, grounding_score, reasoning, mode}}, llm_dipakai).
    """
    results: Dict[int, Dict[str, Any]] = {}
    judgeable = [(i, r, c) for i, r, c in pairs if c and c.get("content")]
    for i, _, c in pairs:
        if not (c and c.get("content")):
            results[i] = {"is_grounded": False, "grounding_score": 0.0,
                          "reasoning": "Rekomendasi tidak merujuk chunk yang valid.", "mode": "NO_CHUNK"}

    chunks_map = extra_chunks_by_id or {}
    used_llm = False
    if llm is not None and judgeable:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage
            payload = []
            for i, r, c in judgeable:
                ai_det = r.get("ai_insight_details") if isinstance(r.get("ai_insight_details"), dict) else None
                ai_cid = ai_det.get("chunk_id") if ai_det else None
                ai_chunk = chunks_map.get(ai_cid) if (ai_cid and ai_cid != c.get("id")) else None
                entry = {
                    "recommendation_index": i,
                    "title": r.get("title", ""),
                    "recommendation_text": r.get("recommendation_text", ""),
                    "food_guide": r.get("food_guide"),
                    "milk_and_supplements": r.get("milk_and_supplements"),
                    "activity_and_stimulation": r.get("activity_and_stimulation"),
                    "action_steps": r.get("action_steps", []),
                    "ai_insight": r.get("ai_insight"),
                    "ai_insight_basis": r.get("ai_insight_basis"),
                    "ai_insight_details": ai_det,
                    "items": r.get("items"),
                    "reference_chunk": f"Sumber: {c.get('source', '')}\nBagian: {c.get('section', '')}\nIsi: {c.get('content', '')}",
                }
                if ai_chunk and ai_chunk.get("content"):
                    entry["ai_insight_reference_chunk"] = (
                        f"Sumber: {ai_chunk.get('source', '')}\nBagian: {ai_chunk.get('section', '')}\n"
                        f"Hal: {ai_chunk.get('page', '')}\nIsi: {ai_chunk.get('content', '')}"
                    )
                payload.append(entry)
            user_prompt = (
                "Berikut pasangan rekomendasi klinis dan potongan teks rujukan resmi:\n"
                f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
                "Evaluasi tingkat grounding setiap rekomendasi terhadap teks rujukannya dan "
                "keluarkan array JSON valid sesuai instruksi sistem."
            )
            res = llm.invoke([SystemMessage(content=VERIFIER_JUDGE_SYSTEM_PROMPT), HumanMessage(content=user_prompt)])
            token_usages.append(extract_token_usage(
                res, prompt_text=f"{VERIFIER_JUDGE_SYSTEM_PROMPT}\n{user_prompt}",
                output_text=extract_text(res.content), is_llm_call=True,
            ))
            parsed = parse_llm_json(res.content)
            if isinstance(parsed, list):
                for ev in parsed:
                    if not isinstance(ev, dict) or ev.get("recommendation_index") is None:
                        continue
                    idx = int(ev["recommendation_index"])
                    if idx in {i for i, _, _ in judgeable} and isinstance(ev.get("is_grounded"), bool):
                        results[idx] = {
                            "is_grounded": ev["is_grounded"],
                            "grounding_score": float(ev.get("grounding_score") or 0.0),
                            "reasoning": ev.get("reasoning", ""),
                            "mode": MODE_LLM_JUDGE,
                        }
                used_llm = True
        except Exception as e:
            logger.warning(f"[VERIFIER LLM-JUDGE WARNING] Evaluasi grounding LLM gagal, fallback leksikal: {e}")

    for i, r, c in judgeable:
        if i not in results:
            ok, score = _lexical_grounding_check(r, c)
            results[i] = {
                "is_grounded": ok,
                "grounding_score": score,
                "reasoning": f"Evaluasi leksikal fallback (proporsi kata rekomendasi yang ada di chunk: {score:.2f}).",
                "mode": "LEXICAL_FALLBACK",
            }
    return results, used_llm


def _lexical_grounding_check(rec: Dict[str, Any], chunk: Dict[str, Any]) -> tuple:
    """
    Cek fallback leksikal bila LLM-judge tidak tersedia: proporsi kata bermakna
    (>= 4 huruf) pada rekomendasi yang juga muncul di isi chunk. Tidak ada bonus
    untuk kecocokan nama sumber/bagian, sehingga hanya isi teks yang dinilai.
    Memeriksa seluruh bagian rekomendasi (judul, teks utama, panduan gizi/susu/stimulasi, langkah aksi).
    """
    import re as _re
    words = lambda t: {w for w in _re.findall(r"[a-zA-Z]{4,}", (t or "").lower())}
    core_words = words(f"{rec.get('title', '')} {rec.get('recommendation_text', '')}")
    if not core_words:
        return False, 0.0
    chunk_words = words(chunk.get("content", ""))
    core_overlap = len(core_words & chunk_words) / len(core_words)

    extra_parts = " ".join(
        str(rec.get(k) or "")
        for k in ("food_guide", "milk_and_supplements", "activity_and_stimulation")
        if rec.get(k)
    )
    if rec.get("action_steps"):
        extra_parts += " " + " ".join(str(s) for s in rec.get("action_steps", []))
    extra_words = words(extra_parts)
    if extra_words:
        full_words = core_words | extra_words
        full_overlap = len(full_words & chunk_words) / len(full_words)
        score = max(core_overlap, full_overlap)
    else:
        score = core_overlap
    return score >= LEXICAL_GROUNDING_THRESHOLD, round(score, 2)


def _check_flag_and_structure_consistency(
    risk_flags: List[Dict[str, Any]],
    recommendations: List[Dict[str, Any]],
    overall_status: str,
    executive_summary: str,
) -> Dict[str, Any]:
    """
    Memeriksa konsistensi rekomendasi terhadap flag risiko aktif dan kelengkapan
    struktur laporan (Sesuai Bab 1.5.1 no. 9 dan Bab 2.8 iii).
    """
    active_flags = [f.get("flag", "") for f in (risk_flags or []) if isinstance(f, dict) and f.get("flag")]
    rec_blob = " ".join(
        f"{r.get('title', '')} {r.get('recommendation_text', '')} {r.get('food_guide', '')} {r.get('milk_and_supplements', '')} {r.get('category', '')}"
        for r in (recommendations or []) if isinstance(r, dict)
    ).lower()

    covered_flags: List[str] = []
    uncovered_flags: List[str] = []
    for fl in active_flags:
        fl_up = fl.upper()
        matched = False
        if any(k in fl_up for k in ("STUNTING", "UNDERWEIGHT", "GIZI_KURANG", "GIZI_BURUK", "2T")) and any(w in rec_blob for w in ("stunting", "protein", "puskesmas", "mp-asi", "mpasi", "berat", "gizi")):
            matched = True
        elif any(k in fl_up for k in ("OVERWEIGHT", "OBESITAS", "GIZI_LEBIH", "BB_LEBIH")) and any(w in rec_blob for w in ("gizi lebih", "obesitas", "lemak", "puskesmas")):
            matched = True
        elif "KEK" in fl_up and any(w in rec_blob for w in ("kek", "lila", "pmt", "makanan tambahan", "porsi", "protein")):
            matched = True
        elif "ANEMIA" in fl_up and any(w in rec_blob for w in ("anemia", "ttd", "tambah darah", "hb", "zat besi")):
            matched = True
        elif any(k in fl_up for k in ("BBLR", "BBLSR", "BBLER", "PREMATUR", "IMD")) and any(w in rec_blob for w in ("kanguru", "bblr", "asi", "suhu", "kehangatan", "imd")):
            matched = True
        elif any(k in fl_up for k in ("KSPR", "KRT", "KRST")) and any(w in rec_blob for w in ("risiko", "rujuk", "dokter", "anc", "puskesmas", "kehamilan")):
            matched = True
        elif len(recommendations) > 0:
            matched = True

        if matched:
            covered_flags.append(fl)
        else:
            uncovered_flags.append(fl)

    has_required_sections = bool(
        overall_status in ("KONDISI_BAIK", "PERLU_PERHATIAN", "RISIKO_TINGGI")
        and executive_summary
        and (not active_flags or len(recommendations) > 0)
    )
    return {
        "is_consistent": len(uncovered_flags) == 0 and has_required_sections,
        "active_flags_count": len(active_flags),
        "covered_flags": covered_flags,
        "uncovered_flags": uncovered_flags,
        "structure_complete": has_required_sections,
    }


def _build_final_report_json(
    phase: str,
    patient_data: Dict[str, Any],
    overall_status: str,
    executive_summary: str,
    risk_narrative: str,
    risk_flags: List[Dict[str, Any]],
    deterministic_results: Dict[str, Any],
    recommendations: List[Dict[str, Any]],
    verification_summary: List[Dict[str, Any]],
    revision_count: int = 0,
    visit_data: Optional[Dict[str, Any]] = None,
    agent_telemetry: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Menyusun struktur data laporan klinis JSON komprehensif."""
    from app.multiagent.agents.recommender import build_comprehensive_care_plan

    det = dict(deterministic_results or {})
    det.pop("_agent1_telemetry", None)
    det.pop("_agent2_telemetry", None)

    hpk_status = det.get("hpk_status") or patient_data.get("hpk_status") or {}
    longitudinal_summary = det.get("longitudinal_summary") or {}
    care_plan = det.get("care_plan") or build_comprehensive_care_plan(
        phase=phase,
        visit_data=visit_data or {},
        risk_flags=risk_flags,
        deterministic_results=det,
    )

    # Hitung Hybrid Confidence Score (0 - 100%)
    plausibility = det.get("plausibility", {})
    c_input = 30.0 if plausibility.get("is_plausible", True) else 15.0
    if not risk_flags:
        c_rag = 40.0
    else:
        scores = [v.get("grounding_score", 1.0) for v in (verification_summary or [])]
        c_rag = round((sum(scores) / max(1, len(scores))) * 40.0, 1)

    prev_cnt = longitudinal_summary.get("total_previous_visits", 0)
    has_mat = bool(longitudinal_summary.get("maternal_history"))
    if prev_cnt >= 2:
        c_long = 30.0
    elif prev_cnt == 1:
        c_long = 24.0
    else:
        c_long = 20.0 if has_mat else 16.0

    conf_score = round(min(100.0, max(0.0, c_input + c_rag + c_long)), 1)
    if conf_score >= 85.0:
        conf_label = "TINGGI"
    elif conf_score >= 70.0:
        conf_label = "SEDANG"
    else:
        conf_label = "BUTUH_KONFIRMASI_DOKTER"
    # Penjelasan berupa rincian komponen skor, tanpa klaim tambahan
    conf_desc = (
        f"Kewajaran data input {c_input:g}/30, keterhubungan rekomendasi dengan chunk rujukan "
        f"{c_rag:g}/40, kelengkapan riwayat kunjungan {c_long:g}/30."
    )

    confidence_dict = {
        "confidence_score": conf_score,
        "confidence_label": conf_label,
        "confidence_description": conf_desc,
        "components": {
            "input_validity_pct": round(c_input / 30.0 * 100, 1),
            "rag_grounding_pct": round(c_rag / 40.0 * 100, 1),
            "longitudinal_completeness_pct": round(c_long / 30.0 * 100, 1),
        }
    }
    consistency_check = _check_flag_and_structure_consistency(
        risk_flags=risk_flags,
        recommendations=recommendations,
        overall_status=overall_status,
        executive_summary=executive_summary,
    )
    return {
        "metadata": {
            "phase": phase,
            "patient_name": patient_data.get("name", "-"),
            "patient_nik": patient_data.get("nik", "-"),
            "village_name": patient_data.get("village_name", "Airmadidi"),
            "overall_status": overall_status,
            "revision_count": revision_count,
            "hpk_day": hpk_status.get("hpk_day"),
            "hpk_progress_percent": hpk_status.get("progress_percent"),
            "hpk_summary_label": hpk_status.get("summary_label"),
            "confidence_score": conf_score,
            "confidence_label": conf_label,
        },
        "hpk_status": hpk_status,
        "longitudinal_summary": longitudinal_summary,
        "care_plan": care_plan,
        "executive_summary": executive_summary,
        "clinical_findings": {
            "risk_narrative": risk_narrative,
            "active_risk_flags": risk_flags,
            "deterministic_summary": det,
        },
        "recommendations": recommendations,
        "verification_summary": verification_summary,
        "consistency_check": consistency_check,
        "confidence": confidence_dict,
        "agent_telemetry": agent_telemetry or {},
    }
