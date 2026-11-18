import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.audit_log import AuditLog
from app.multiagent.prompts.evaluator_prompt import EVALUATOR_SYSTEM_PROMPT
from app.multiagent.rag.retriever import retrieve_kia_guidelines
from app.multiagent.llm_utils import (
    parse_llm_json,
    get_chat_llm,
    extract_text,
    extract_token_usage,
)


def _deterministic_sop_audit(
    agent_key: str,
    output_obj: Any,
    agent_tel: Dict[str, Any],
) -> tuple[bool, str]:
    """
    Verifikasi kepatuhan SOP berbasis aturan deterministik untuk Agent 1, Agent 2, dan Agent 3.
    Menjamin setiap eksekusi teraudit secara objektif meskipun koneksi API LLM sedang offline.
    """
    tools = agent_tel.get("tools_invoked") or []
    wb = agent_tel.get("work_breakdown") or {}

    if agent_key == "agent_1":
        if isinstance(output_obj, dict):
            flags = output_obj.get("risk_flags")
            narrative = str(output_obj.get("narrative") or "").strip()
            plaus = (wb.get("plausibility") or {}).get("is_plausible", True)
            if isinstance(flags, list) and len(narrative) > 5 and plaus:
                return (
                    True,
                    f"Kepatuhan SOP Agent 1 terverifikasi: kalkulator deterministik ({', '.join(tools[:4]) or 'WHO Z-Score/KSPR/1000 HPK'}) "
                    f"berjalan normal, menghasilkan {len(flags)} flag risiko dan narasi klinis baku.",
                )
        return False, "Output Agent 1 tidak memuat struktur risk_flags atau narasi klinis yang lengkap."

    if agent_key == "agent_2":
        if isinstance(output_obj, dict) and output_obj.get("care_plan_status") == "PREVENTIVE_1000_HPK_READY":
            return (
                True,
                "Kepatuhan SOP Agent 2 terverifikasi: pasien sehat (0 flag risiko), Conditional Router melewati RAG "
                "dan menyusun Care Plan preventif 1.000 HPK.",
            )
        if isinstance(output_obj, list) and len(output_obj) > 0:
            valid_recs = [
                r for r in output_obj
                if isinstance(r, dict)
                and r.get("title")
                and r.get("recommendation_text")
                and r.get("food_guide")
                and r.get("milk_and_supplements")
                and r.get("activity_and_stimulation")
            ]
            cited_pages = []
            chunk_ids = []
            for r in valid_recs:
                cit = r.get("citation") or {}
                if cit.get("chunk_id"):
                    chunk_ids.append(str(cit["chunk_id"]))
                for sc_id in (cit.get("supporting_chunk_ids") or []):
                    if str(sc_id) not in chunk_ids:
                        chunk_ids.append(str(sc_id))
                pg_list = cit.get("additional_pages") or ([cit.get("page")] if cit.get("page") else [])
                for pg in pg_list:
                    if pg and str(pg) not in cited_pages:
                        cited_pages.append(str(pg))
            if len(valid_recs) == len(output_obj):
                page_info = f"Halaman {', '.join(cited_pages)}" if cited_pages else "Aturan Standar KIA"
                chunk_info = f"{len(chunk_ids)} chunk ({', '.join(chunk_ids[:4])})" if chunk_ids else "Care Plan Baku"
                return (
                    True,
                    f"Kepatuhan SOP Agent 2 terverifikasi: {len(valid_recs)} rekomendasi gizi & klinis lengkap "
                    f"(makanan, ASI/suplemen, stimulasi) tersusun dari {chunk_info} pada {page_info}.",
                )
        return False, "Output Agent 2 belum memuat struktur panduan gizi, suplemen, dan aktivitas yang lengkap."

    if agent_key == "agent_3":
        if isinstance(output_obj, dict):
            status_val = output_obj.get("overall_status")
            verifs = output_obj.get("verification") or []
            if status_val in ("KONDISI_BAIK", "PERLU_PERHATIAN", "RISIKO_TINGGI"):
                if not verifs and status_val == "KONDISI_BAIK":
                    return (
                        True,
                        "Kepatuhan SOP Agent 3 terverifikasi: Single-Pass Integrator mengemas laporan akhir "
                        "status KONDISI_BAIK secara konsisten.",
                    )
                verified_cnt = sum(
                    1 for v in verifs
                    if isinstance(v, dict) and v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY")
                )
                if verifs and verified_cnt == 0:
                    return (
                        False,
                        f"Deviasi SOP Agent 3: dari {len(verifs)} rekomendasi berisiko, 0 rekomendasi terverifikasi terhadap rujukan.",
                    )
                return (
                    True,
                    f"Kepatuhan SOP Agent 3 terverifikasi: {verified_cnt}/{len(verifs)} butir rekomendasi telah "
                    f"melalui pemeriksaan keterhubungan rujukan (grounding) dengan status akhir {status_val}.",
                )
        return False, "Output Agent 3 tidak memuat status akhir atau rincian verifikasi laporan yang valid."

    return True, "Fungsi agent berjalan sesuai spesifikasi pipeline."


def _evaluate_single_agent_worker(task_spec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Worker thread independen yang berjalan secara PARALEL (concurrent) di dalam
    ThreadPoolExecutor(max_workers=3) untuk mengaudit 1 agent spesifik.
    """
    t0 = time.perf_counter()
    eval_started_at = datetime.now().isoformat(timespec="milliseconds")
    worker_thread = threading.current_thread().name

    agent_key = task_spec["agent_key"]
    agent_name = task_spec["name"]
    instruction = task_spec["instruction"]
    output_obj = task_spec["output"]
    reference = task_spec["reference"]
    agent_tel = task_spec.get("telemetry") or {}

    output_str = json.dumps(output_obj, ensure_ascii=False, default=str)
    is_compliant: Optional[bool] = None
    notes = ""
    eval_token_usage = extract_token_usage(None, prompt_text=instruction, output_text=output_str, is_llm_call=False)

    llm = get_chat_llm(temperature=0.0, max_tokens=300)
    if llm is not None:
        try:
            from langchain_core.messages import SystemMessage, HumanMessage

            prompt = (
                f"Audit kepatuhan peran secara independen untuk {agent_name}.\n"
                f"Instruksi: {instruction}\n"
                f"Output Agent:\n{output_str[:6000]}\n\n"
                f"Rujukan:\n{reference[:6000]}\n\n"
                'Keluarkan HANYA JSON valid: {"is_compliant": true, "notes": "Alasan singkat 1 kalimat"}'
            )
            res = llm.invoke([
                SystemMessage(content=EVALUATOR_SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ])
            eval_token_usage = extract_token_usage(
                res,
                prompt_text=f"{EVALUATOR_SYSTEM_PROMPT}\n{prompt}",
                output_text=extract_text(res.content),
                is_llm_call=True,
            )
            parsed = parse_llm_json(res.content)
            if isinstance(parsed, dict) and isinstance(parsed.get("is_compliant"), bool):
                is_compliant = parsed["is_compliant"]
                notes = str(parsed.get("notes") or "").strip()
                if not notes:
                    notes = (
                        f"Output {agent_name} sesuai instruksi dan rujukan."
                        if is_compliant
                        else f"Terdapat deviasi pada output {agent_name} terhadap instruksi atau rujukan."
                    )
            else:
                is_compliant = None
                notes = "Tidak dievaluasi: respons LLM evaluator tidak memuat status boolean yang valid."
        except Exception as e:
            is_compliant = None
            notes = f"Tidak dievaluasi: evaluator LLM gagal dieksekusi ({type(e).__name__})."
    else:
        is_compliant = None
        notes = "Tidak dievaluasi: evaluator LLM tidak tersedia."

    t1 = time.perf_counter()
    eval_finished_at = datetime.now().isoformat(timespec="milliseconds")
    eval_duration_ms = round(max(0.5, (t1 - t0) * 1000.0), 2)

    main_tok = agent_tel.get("token_usage") or {}
    main_in = main_tok.get("input_tokens", 0)
    main_out = main_tok.get("output_tokens", 0)
    main_tot = main_tok.get("total_tokens", 0)
    main_life = agent_tel.get("lifetime_ms", 0.0)
    main_spawn = agent_tel.get("spawned_at", "-")
    main_term = agent_tel.get("terminated_at", "-")
    seq_order = agent_tel.get("execution_order", 1)
    comp_rank = agent_tel.get("complexity_rank", "-")

    telemetry_footer = (
        f" [TELEMETRI SEQUENTIAL STEP #{seq_order}: {main_spawn} -> {main_term} (Durasi {main_life} ms, TERMINATED) | "
        f"Token Agent: {main_tot} (In: {main_in}, Out: {main_out}) | "
        f"AUDIT PARALEL ({worker_thread}): {eval_started_at} -> {eval_finished_at} ({eval_duration_ms} ms, "
        f"Token Audit: {eval_token_usage.get('total_tokens', 0)}) | Klasifikasi: {comp_rank}]"
    )

    return {
        "agent_key": agent_key,
        "agent_name": agent_name,
        "instruction": instruction,
        "output_str": output_str,
        "reference": reference,
        "is_compliant": is_compliant,
        "evaluation_notes": f"{notes}{telemetry_footer}",
        "parallel_trace": {
            "worker_thread": worker_thread,
            "eval_started_at": eval_started_at,
            "eval_finished_at": eval_finished_at,
            "eval_duration_ms": eval_duration_ms,
            "eval_token_usage": eval_token_usage,
        },
    }


def log_multiagent_parallel_evaluations(
    report_id: int,
    initial_state: Dict[str, Any],
    final_state: Dict[str, Any],
    db: Optional[Session] = None,
):
    """
    Mengeksekusi evaluasi independen per-agent (Agent 1, Agent 2, Agent 3) secara
    PARALEL menggunakan ThreadPoolExecutor(max_workers=3) sesuai Bab 1.5 Poin 13 & Bab 2.8.
    Membuktikan secara nyata perbedaan antara:
    - Alur Utama: SEQUENTIAL (Step 1 -> Step 2 -> Step 3)
    - Alur Audit Evaluator: PARALLEL (3 thread berjalan serentak mengevaluasi masing-masing agent)
    """
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    try:
        phase = initial_state.get("phase", "BADUTA")
        patient_name = initial_state.get("patient_data", {}).get("name", "Pasien")

        risk_flags = final_state.get("risk_flags", [])
        risk_narrative = final_state.get("risk_narrative", "")
        recommendations = final_state.get("recommendations", [])
        requires_rag = final_state.get("requires_rag", False)
        verif_details = final_state.get("verification_details", [])
        overall_status = final_state.get("overall_status", "KONDISI_BAIK")

        report_json = final_state.get("final_report_json") or {}
        pipeline_tel = (
            final_state.get("agent_telemetry")
            or report_json.get("agent_telemetry")
            or {}
        )
        agents_tel = pipeline_tel.get("agents") or {}

        from app.multiagent.agents.recommender import flag_search_query

        flag_names = [f.get("flag", "") for f in risk_flags if isinstance(f, dict) and f.get("flag")]
        retrieved_chunks = final_state.get("retrieved_chunks") or []
        if not retrieved_chunks and requires_rag and recommendations:
            for f in risk_flags[:3]:
                if isinstance(f, dict):
                    q = flag_search_query(f.get("flag", ""), f.get("detail", ""))
                    for ch in retrieve_kia_guidelines(q, n_results=2):
                        if ch.get("id") not in {c.get("id") for c in retrieved_chunks}:
                            retrieved_chunks.append(ch)
        ref_text = "\n\n".join([
            f"[ID: {c.get('id')}] Sumber: {c.get('source')} | Bagian: {c.get('section')} | Hal: {c.get('page')}\n{c.get('content', '')}"
            for c in retrieved_chunks
        ])

        compact_recs = [
            {
                "title": r.get("title"),
                "category": r.get("category"),
                "recommendation_text": r.get("recommendation_text"),
                "items": r.get("items"),
                "food_guide": r.get("food_guide"),
                "milk_and_supplements": r.get("milk_and_supplements"),
                "activity_and_stimulation": r.get("activity_and_stimulation"),
                "action_steps": r.get("action_steps"),
                "evidence_status": r.get("evidence_status"),
                "evidence_quote": r.get("evidence_quote"),
                "citation": {
                    k: (r.get("citation") or {}).get(k)
                    for k in ("chunk_id", "source", "section", "page")
                } if isinstance(r.get("citation"), dict) else None,
            }
            for r in recommendations if isinstance(r, dict)
        ]

        compact_verifs = [
            {
                "recommendation_index": v.get("recommendation_index"),
                "title": v.get("title"),
                "chunk_id": v.get("chunk_id"),
                "citation_source": v.get("citation_source"),
                "citation_page": v.get("citation_page"),
                "verification_status": v.get("verification_status"),
                "grounding_score": v.get("grounding_score"),
                "notes": v.get("notes"),
            }
            for v in verif_details if isinstance(v, dict)
        ]

        tasks: List[Dict[str, Any]] = [
            {
                "agent_key": "agent_1",
                "name": "Agent 1 (Deteksi Risiko Deterministik)",
                "instruction": f"Kalkulasi parameter klinis ({phase}) untuk {patient_name} & deteksi flag risiko.",
                "output": {"risk_flags": risk_flags, "narrative": risk_narrative},
                "reference": "Standar Antropometri Permenkes No. 2/2020 & KSPR Poedji Rochjati",
                "telemetry": agents_tel.get("agent_1") or {},
            },
            {
                "agent_key": "agent_2",
                "name": "Agent 2 (Rekomendasi Klinis RAG)",
                "instruction": (
                    f"Sintesis rekomendasi klinis tersitasi berbasis RAG untuk flag: {', '.join(flag_names)}"
                    if (requires_rag and recommendations)
                    else f"Penyusunan Care Plan preventif 1.000 HPK ({phase}) tanpa flag risiko aktif."
                ),
                "output": compact_recs if compact_recs else {"care_plan_status": "PREVENTIVE_1000_HPK_READY"},
                "reference": ref_text or "Buku KIA 2024 & PNPK Tata Laksana Stunting",
                "telemetry": agents_tel.get("agent_2") or {},
            },
            {
                "agent_key": "agent_3",
                "name": "Agent 3 (Verifikasi & Grounding Laporan)",
                "instruction": f"Verifikasi keterhubungan sitasi terhadap chunk rujukan, konsistensi flag aktif ({', '.join(flag_names) or 'Kondisi Baik'}), dan integrasikan final report JSON (Status: {overall_status}).",
                "output": {
                    "overall_status": overall_status,
                    "consistency_check": report_json.get("consistency_check"),
                    "verification": compact_verifs,
                },
                "reference": (ref_text + "\n\nAturan Verifikasi Agent 3: Menilai keterhubungan setiap rekomendasi dengan chunk rujukan (VERIFIED / AUTO_GROUNDED_SECONDARY / UNVERIFIED), memastikan setiap flag aktif ditangani, dan menetapkan overall_status laporan.").strip(),
                "telemetry": agents_tel.get("agent_3") or {},
            },
        ]

        # Eksekusi PARALEL sesungguhnya menggunakan 3 worker threads konkuren
        with ThreadPoolExecutor(max_workers=3, thread_name_prefix="ParallelEval") as executor:
            parallel_results = list(executor.map(_evaluate_single_agent_worker, tasks))

        for res_item in parallel_results:
            db.add(
                AuditLog(
                    report_id=report_id,
                    agent_name=res_item["agent_name"],
                    input_instruction=res_item["instruction"][:2000],
                    agent_output=res_item["output_str"][:8000],
                    reference_context=res_item["reference"][:6000],
                    is_compliant=res_item["is_compliant"],
                    evaluation_notes=res_item["evaluation_notes"],
                )
            )

        db.commit()
    finally:
        if own_session:
            db.close()
