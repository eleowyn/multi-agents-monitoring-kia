import json
import re
import time
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from langchain_core.tools import tool

from app.multiagent.state import AgentState
from app.multiagent.tools.who_zscore import calculate_who_zscore
from app.multiagent.tools.kspr import calculate_kspr
from app.multiagent.tools.anemia import classify_maternal_anemia
from app.multiagent.tools.anthropometry_check import check_kek_lila, check_bblr_and_gestation
from app.multiagent.tools.hpk_tracker import calculate_1000_hpk_status, check_visit_plausibility
from app.multiagent.prompts.risk_detector_prompt import RISK_DETECTOR_SYSTEM_PROMPT
from app.multiagent.llm_utils import (
    get_chat_llm,
    extract_text,
    extract_token_usage,
    merge_token_usage,
    MODE_LLM,
    MODE_FALLBACK,
)

BBLR_THRESHOLD_GRAM = 2500
MAX_REACT_STEPS = 1


def risk_detection_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 1: Deteksi Risiko 1.000 HPK (Hybrid ReAct Function Calling + Deterministic Guard)

    1. Menjalankan pemeriksaan plausibilitas data, kalkulasi garis waktu 1.000 HPK,
       kalkulator medis deterministik baku (Z-score WHO, KSPR, Anemia Hb, KEK LiLA, BBLR),
       serta pemantauan longitudinal lintas 3 fase (Ibu Hamil -> Bayi Baru Lahir -> Baduta).
    2. Menyediakan @tool resmi yang di-bind ke LLM melalui paradigma ReAct (Reasoning + Acting)
       dan Function Calling untuk penalaran klinis lintas kunjungan.
    3. Guard anti-halusinasi memastikan seluruh angka dan flag risiko 100% deterministik.
    """
    t0 = time.perf_counter()
    spawned_at = datetime.now().isoformat(timespec="milliseconds")

    flags, det_results, rule_points = _stage1_deterministic(state)

    narrative, mode, token_usage, react_tools = _stage2_react_narrative(state, flags, det_results, rule_points)

    if state.get("kader_feedback"):
        narrative = f"{narrative} [CATATAN KADER SEBELUMNYA]: {state['kader_feedback']}"

    t1 = time.perf_counter()
    terminated_at = datetime.now().isoformat(timespec="milliseconds")
    lifetime_ms = round(max(0.5, (t1 - t0) * 1000.0), 2)

    phase = state.get("phase", "BADUTA")
    det_tools = ["calculate_1000_hpk_status", "check_visit_plausibility"]
    if phase == "IBU_HAMIL":
        det_tools.extend(["check_kek_lila", "classify_maternal_anemia", "calculate_kspr", "detect_maternal_longitudinal_trend"])
    elif phase == "BAYI_BARU_LAHIR":
        det_tools.extend(["check_bblr_and_gestation", "carryover_maternal_risk"])
    else:
        det_tools.extend(["calculate_who_zscore (BB/U, TB/U, BB/TB)", "detect_weight_faltering (2T)"])

    all_tools = det_tools + [t for t in react_tools if t not in det_tools]

    agent1_telemetry = {
        "agent_id": "agent_1",
        "agent_name": "Agent 1: Deteksi Risiko Deterministik & ReAct",
        "execution_order": 1,
        "execution_pattern": "SEQUENTIAL_STEP_1 (Entry Point)",
        "lifecycle_state": "TERMINATED (Selesai Tugas, Selesai Hidup / Ephemeral)",
        "spawned_at": spawned_at,
        "terminated_at": terminated_at,
        "lifetime_ms": lifetime_ms,
        "mode": mode,
        "complexity_rank": "Paling Penting (Keselamatan Jiwa / Clinical Safety Gatekeeper)",
        "complexity_reason": (
            "Gerbang skrining keselamatan awal ibu & anak (Stunting Berat, Gizi Buruk, BBLR, KEK, Anemia, KSPR Risiko Tinggi). "
            "Stage 1 dikunci 100% deterministik baku WHO/Permenkes agar bebas false-negative."
        ),
        "tools_invoked": all_tools,
        "token_usage": token_usage,
        "task_proof": {
            "input_summary": f"Fase {phase}, Riwayat Longitudinal ({len(state.get('longitudinal_history') or [])} kunjungan)",
            "output_summary": f"{len(flags)} Flag Risiko Aktif ({', '.join(f.get('flag', '') for f in flags) or 'Tidak Ada Risiko'}), requires_rag={len(flags) > 0}",
            "is_grounded_numeric_guard": True,
        },
    }
    det_results["_agent1_telemetry"] = agent1_telemetry
    existing_telemetry = dict(state.get("agent_telemetry") or {})
    existing_telemetry["agent_1"] = agent1_telemetry

    return {
        "risk_flags": flags,
        "risk_narrative": narrative,
        "deterministic_results": det_results,
        "requires_rag": len(flags) > 0,
        "narrative_mode": mode,
        "agent_telemetry": existing_telemetry,
    }


# ----------------------------------------------------------------------------
# STAGE 1: Kalkulasi Deterministik Baku & Pemantauan Longitudinal 1.000 HPK
# ----------------------------------------------------------------------------
def _stage1_deterministic(state: AgentState) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[str]]:
    phase = state.get("phase", "BADUTA")
    visit_data = state.get("visit_data", {}) or {}
    patient_data = state.get("patient_data", {}) or {}
    maternal_history = state.get("maternal_history") or {}
    longitudinal = state.get("longitudinal_history", []) or []

    risk_flags: List[Dict[str, Any]] = []
    det_results: Dict[str, Any] = {}
    points: List[str] = []

    # 0. Posisi Garis Waktu 1.000 HPK & Plausibilitas Pengukuran
    hpk_status = (
        visit_data.get("hpk_status")
        or patient_data.get("hpk_status")
        or calculate_1000_hpk_status(
            phase=phase,
            patient_type=patient_data.get("patient_type"),
            birth_date=patient_data.get("birth_date"),
            visit_date=visit_data.get("visit_date"),
            gestational_age_weeks=visit_data.get("gestational_age_weeks"),
            trimester=visit_data.get("trimester"),
            age_in_months=visit_data.get("age_in_months"),
        )
    )
    det_results["hpk_status"] = hpk_status
    det_results["plausibility"] = check_visit_plausibility(phase, visit_data)
    points.append(f"Status 1.000 HPK: {hpk_status['summary_label']}.")

    # ----------------- 1. FASE IBU HAMIL -----------------
    if phase == "IBU_HAMIL":
        lila = visit_data.get("lila_cm")
        if lila is not None:
            res_kek = check_kek_lila(float(lila))
            det_results["lila_kek"] = res_kek
            risk_flags.extend(res_kek["risk_flags"])
            if res_kek["is_kek"]:
                points.append(f"Ibu hamil terindikasi KEK dengan ukuran LiLA {lila} cm.")
            else:
                points.append(f"Ukuran LiLA ibu normal ({lila} cm).")

        hb = visit_data.get("hb_level")
        trimester = visit_data.get("trimester") or 1
        if hb is not None:
            res_anemia = classify_maternal_anemia(float(hb), trimester=int(trimester))
            det_results["anemia"] = res_anemia
            risk_flags.extend(res_anemia["risk_flags"])
            if res_anemia["status"] != "NORMAL":
                points.append(f"Kadar Hb {hb} g/dL pada Trimester {trimester} tergolong {res_anemia['severity_label']}.")
            else:
                points.append(f"Kadar Hb normal ({hb} g/dL).")

        m_age = visit_data.get("maternal_age")
        m_height = visit_data.get("maternal_height_cm")
        sys_bp = visit_data.get("systolic_bp")
        dia_bp = visit_data.get("diastolic_bp")
        res_kspr = calculate_kspr(
            selected_risk_keys=visit_data.get("kspr_answers", []) or [],
            maternal_age=int(m_age) if m_age is not None else None,
            maternal_height_cm=float(m_height) if m_height else None,
            systolic_bp=int(sys_bp) if sys_bp else None,
            diastolic_bp=int(dia_bp) if dia_bp else None,
        )
        det_results["kspr"] = res_kspr
        risk_flags.extend(res_kspr["risk_flags"])
        points.append(f"Skoring KSPR menghasilkan Skor {res_kspr['total_score']} ({res_kspr['category_label']}).")

        # Evaluasi Longitudinal Kunjungan ANC Ibu Hamil
        mat_trend = detect_maternal_longitudinal_trend(longitudinal, visit_data)
        det_results["maternal_trend"] = mat_trend
        if mat_trend.get("is_weight_dropping"):
            risk_flags.append({
                "indicator": "LONGITUDINAL_MATERNAL_WEIGHT",
                "flag": "BB_IBU_HAMIL_TURUN",
                "detail": mat_trend["detail"],
            })
        if mat_trend.get("is_persistent_kek"):
            risk_flags.append({
                "indicator": "LONGITUDINAL_MATERNAL_KEK",
                "flag": "KEK_PERSISTEN_ANTAR_KUNJUNGAN",
                "detail": "Kondisi KEK ibu hamil bersifat persisten (LiLA < 23,5 cm pada kunjungan sebelumnya dan saat ini).",
            })
        if mat_trend.get("is_persistent_anemia"):
            risk_flags.append({
                "indicator": "LONGITUDINAL_MATERNAL_ANEMIA",
                "flag": "ANEMIA_PERSISTEN_ANTAR_KUNJUNGAN",
                "detail": "Kondisi Anemia ibu hamil bersifat persisten (Hb < 11,0 g/dL pada kunjungan sebelumnya dan saat ini).",
            })
        if mat_trend.get("detail"):
            points.append(mat_trend["detail"])

    # ----------------- 2. FASE BAYI BARU LAHIR -----------------
    elif phase == "BAYI_BARU_LAHIR":
        birth_weight = visit_data.get("birth_weight_gram")
        gest_age = visit_data.get("gestational_age_at_birth_weeks")
        if birth_weight is not None:
            res_bblr = check_bblr_and_gestation(
                birth_weight_gram=float(birth_weight),
                gestational_age_weeks=int(gest_age) if gest_age else None,
            )
            det_results["bblr"] = res_bblr
            risk_flags.extend(res_bblr["risk_flags"])
            points.append(f"Bayi lahir dengan berat {birth_weight} gram ({res_bblr['weight_label']}).")

        _append_maternal_carryover_flags(maternal_history, risk_flags, points, phase_label="bayi baru lahir")

    # ----------------- 3. FASE BADUTA (1 - 24 BULAN) -----------------
    elif phase == "BADUTA":
        age_months = visit_data.get("age_in_months")
        if age_months is None:
            age_months = 12
        weight = visit_data.get("child_weight_kg")
        length = visit_data.get("child_length_cm")
        gender = patient_data.get("gender") or "L"

        res_zscore = calculate_who_zscore(
            gender=gender,
            age_in_months=int(age_months),
            weight_kg=float(weight) if weight else None,
            length_cm=float(length) if length else None,
        )
        det_results["who_zscore"] = res_zscore
        risk_flags.extend(res_zscore["risk_flags"])

        ind = res_zscore.get("indicators", {})
        pb_u, bb_u, bb_pb = ind.get("PB_U", {}), ind.get("BB_U", {}), ind.get("BB_PB", {})
        points.append(
            f"Evaluasi antropometri Baduta usia {age_months} bulan: "
            f"PB/U Z={pb_u.get('z_score', '-')} ({pb_u.get('category', '-')}), "
            f"BB/U Z={bb_u.get('z_score', '-')} ({bb_u.get('category', '-')}), "
            f"BB/PB Z={bb_pb.get('z_score', '-')} ({bb_pb.get('category', '-')})."
        )

        birth_weight = maternal_history.get("birth_weight_gram")
        if birth_weight is not None and birth_weight < BBLR_THRESHOLD_GRAM:
            risk_flags.append({
                "indicator": "LONGITUDINAL_BBLR",
                "flag": "RIWAYAT_BBLR_ANAK",
                "detail": f"Anak memiliki riwayat lahir BBLR ({birth_weight} gram) yang memperberat risiko keterlambatan pertumbuhan.",
            })
            points.append(f"Riwayat kelahiran menunjukkan kondisi BBLR ({birth_weight} gram).")

        _append_maternal_carryover_flags(maternal_history, risk_flags, points, phase_label="anak")

        faltering = detect_weight_faltering(longitudinal, visit_data)
        det_results["weight_trend"] = faltering
        if faltering["is_faltering"]:
            risk_flags.append({
                "indicator": "LONGITUDINAL_WEIGHT_TREND",
                "flag": "BB_TIDAK_NAIK_2T",
                "detail": faltering["detail"],
            })
            points.append(faltering["detail"])

        z_trend = compute_zscore_longitudinal_delta(longitudinal, res_zscore, gender)
        if z_trend:
            det_results["zscore_trend"] = z_trend
            if z_trend.get("summary"):
                points.append(z_trend["summary"])

    det_results["longitudinal_summary"] = build_visit_comparison_summary(
        phase=phase,
        longitudinal=longitudinal,
        visit_data=visit_data,
        maternal_history=maternal_history,
        hpk_status=hpk_status,
    )

    return risk_flags, det_results, points


def _append_maternal_carryover_flags(
    maternal_history: Dict[str, Any],
    risk_flags: List[Dict[str, Any]],
    points: List[str],
    phase_label: str = "anak",
) -> None:
    """Menurunkan faktor risiko kehamilan ibu (KEK, Anemia, KSPR) ke evaluasi anak secara otomatis."""
    if not maternal_history:
        return

    if maternal_history.get("is_kek"):
        min_lila = maternal_history.get("min_maternal_lila_cm")
        lila_info = f" (LiLA terendah {min_lila} cm)" if min_lila else ""
        risk_flags.append({
            "indicator": "LONGITUDINAL_MATERNAL_KEK",
            "flag": "RIWAYAT_IBU_KEK",
            "detail": f"Ibu memiliki riwayat KEK saat hamil{lila_info} yang meningkatkan kerentanan stunting pada {phase_label}.",
        })
        points.append(f"Terdapat riwayat maternal KEK pada masa kehamilan{lila_info}.")

    if maternal_history.get("is_anemia"):
        min_hb = maternal_history.get("min_maternal_hb")
        hb_info = f" (Hb terendah {min_hb} g/dL)" if min_hb else ""
        risk_flags.append({
            "indicator": "LONGITUDINAL_MATERNAL_ANEMIA",
            "flag": "RIWAYAT_IBU_ANEMIA",
            "detail": f"Ibu memiliki riwayat anemia saat hamil{hb_info} yang berdampak pada cadangan zat besi dan pertumbuhan {phase_label}.",
        })
        points.append(f"Terdapat riwayat maternal Anemia saat kehamilan{hb_info}.")

    if maternal_history.get("is_high_risk_kspr"):
        kspr_cat = maternal_history.get("kspr_category", "KRT")
        kspr_score = maternal_history.get("max_kspr_score", 6)
        risk_flags.append({
            "indicator": "LONGITUDINAL_MATERNAL_KSPR",
            "flag": "RIWAYAT_KEHAMILAN_RISIKO_TINGGI",
            "detail": f"Ibu memiliki riwayat kehamilan risiko tinggi ({kspr_cat}, Skor KSPR {kspr_score}) yang memerlukan pemantauan intensif pada {phase_label}.",
        })
        points.append(f"Terdapat riwayat obstetri kehamilan risiko tinggi ({kspr_cat}, Skor {kspr_score}).")


def detect_maternal_longitudinal_trend(
    longitudinal: List[Dict[str, Any]], visit_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Mendeteksi tren antar-kunjungan ANC pada Ibu Hamil (berat badan turun, KEK/Anemia persisten)."""
    anc_visits = [h for h in longitudinal if h.get("phase") == "IBU_HAMIL" or h.get("lila_cm") is not None or h.get("maternal_weight_kg") is not None]
    result: Dict[str, Any] = {
        "previous_visits_count": len(anc_visits),
        "is_weight_dropping": False,
        "is_persistent_kek": False,
        "is_persistent_anemia": False,
        "detail": "",
    }
    if not anc_visits:
        return result

    prev = anc_visits[-1]
    notes: List[str] = []

    curr_w = visit_data.get("maternal_weight_kg")
    prev_w = prev.get("maternal_weight_kg")
    if curr_w is not None and prev_w is not None:
        delta_w = round(float(curr_w) - float(prev_w), 2)
        result["weight_delta_kg"] = delta_w
        if float(curr_w) < float(prev_w):
            result["is_weight_dropping"] = True
            notes.append(
                f"Berat badan ibu hamil turun dibanding kunjungan ANC sebelumnya: {prev_w} kg ({prev.get('visit_date')}) -> {curr_w} kg ({visit_data.get('visit_date')})."
            )

    curr_lila = visit_data.get("lila_cm")
    prev_lila = prev.get("lila_cm")
    if curr_lila is not None and prev_lila is not None:
        result["lila_delta_cm"] = round(float(curr_lila) - float(prev_lila), 2)
        if float(curr_lila) < 23.5 and float(prev_lila) < 23.5:
            result["is_persistent_kek"] = True
            notes.append(f"Kondisi KEK ibu hamil bersifat persisten dari kunjungan sebelumnya (LiLA {prev_lila} cm -> {curr_lila} cm).")

    curr_hb = visit_data.get("hb_level")
    prev_hb = prev.get("hb_level")
    if curr_hb is not None and prev_hb is not None:
        result["hb_delta"] = round(float(curr_hb) - float(prev_hb), 2)
        if float(curr_hb) < 11.0 and float(prev_hb) < 11.0:
            result["is_persistent_anemia"] = True
            notes.append(f"Anemia ibu hamil belum teratasi sejak kunjungan sebelumnya (Hb {prev_hb} g/dL -> {curr_hb} g/dL).")

    result["detail"] = " ".join(notes)
    return result


def compute_zscore_longitudinal_delta(
    longitudinal: List[Dict[str, Any]], current_zscore: Dict[str, Any], gender: str
) -> Optional[Dict[str, Any]]:
    """Menghitung perubahan (delta) Z-score PB/U dan BB/U dibanding kunjungan Baduta sebelumnya."""
    baduta_visits = [
        h for h in longitudinal
        if h.get("child_length_cm") is not None or h.get("child_weight_kg") is not None
    ]
    if not baduta_visits:
        return None

    prev = baduta_visits[-1]
    prev_age = prev.get("age_in_months")
    if prev_age is None:
        return None

    try:
        prev_z = calculate_who_zscore(
            gender=gender or "L",
            age_in_months=int(prev_age),
            weight_kg=float(prev["child_weight_kg"]) if prev.get("child_weight_kg") else None,
            length_cm=float(prev["child_length_cm"]) if prev.get("child_length_cm") else None,
        )
    except Exception:
        return None

    curr_ind = current_zscore.get("indicators", {})
    prev_ind = prev_z.get("indicators", {})

    curr_pbu = curr_ind.get("PB_U", {}).get("z_score")
    prev_pbu = prev_ind.get("PB_U", {}).get("z_score")
    curr_bbu = curr_ind.get("BB_U", {}).get("z_score")
    prev_bbu = prev_ind.get("BB_U", {}).get("z_score")

    delta_pbu = round(curr_pbu - prev_pbu, 2) if (curr_pbu is not None and prev_pbu is not None) else None
    delta_bbu = round(curr_bbu - prev_bbu, 2) if (curr_bbu is not None and prev_bbu is not None) else None

    parts = []
    if delta_pbu is not None:
        sign = "+" if delta_pbu > 0 else ""
        parts.append(f"PB/U Z-score {prev_pbu} -> {curr_pbu} ({sign}{delta_pbu} SD)")
    if delta_bbu is not None:
        sign = "+" if delta_bbu > 0 else ""
        parts.append(f"BB/U Z-score {prev_bbu} -> {curr_bbu} ({sign}{delta_bbu} SD)")

    return {
        "previous_visit_date": prev.get("visit_date"),
        "previous_age_months": prev_age,
        "prev_pb_u_z": prev_pbu,
        "curr_pb_u_z": curr_pbu,
        "delta_pb_u_z": delta_pbu,
        "prev_bb_u_z": prev_bbu,
        "curr_bb_u_z": curr_bbu,
        "delta_bb_u_z": delta_bbu,
        "summary": f"Progres Z-score sejak kunjungan {prev.get('visit_date')}: " + ", ".join(parts) + "." if parts else "",
    }


def build_visit_comparison_summary(
    phase: str,
    longitudinal: List[Dict[str, Any]],
    visit_data: Dict[str, Any],
    maternal_history: Dict[str, Any],
    hpk_status: Dict[str, Any],
) -> Dict[str, Any]:
    """Menyusun ringkasan komparasi kunjungan sebelumnya vs saat ini untuk laporan web & PDF."""
    prev = longitudinal[-1] if longitudinal else None
    comparison_items: List[Dict[str, Any]] = []

    if prev:
        if phase == "IBU_HAMIL":
            if prev.get("maternal_weight_kg") is not None or visit_data.get("maternal_weight_kg") is not None:
                p_val = prev.get("maternal_weight_kg")
                c_val = visit_data.get("maternal_weight_kg")
                diff = round(float(c_val) - float(p_val), 1) if (p_val is not None and c_val is not None) else None
                comparison_items.append({
                    "metric": "Berat Badan Ibu",
                    "unit": "kg",
                    "previous": p_val,
                    "current": c_val,
                    "delta": f"{'+' if diff and diff > 0 else ''}{diff} kg" if diff is not None else "-",
                    "status": "MEMBAIK" if (diff is not None and diff > 0) else ("MENURUN" if (diff is not None and diff < 0) else "STABIL"),
                })
            if prev.get("lila_cm") is not None or visit_data.get("lila_cm") is not None:
                p_val = prev.get("lila_cm")
                c_val = visit_data.get("lila_cm")
                diff = round(float(c_val) - float(p_val), 1) if (p_val is not None and c_val is not None) else None
                comparison_items.append({
                    "metric": "Lingkar Lengan Atas (LiLA)",
                    "unit": "cm",
                    "previous": p_val,
                    "current": c_val,
                    "delta": f"{'+' if diff and diff > 0 else ''}{diff} cm" if diff is not None else "-",
                    "status": "NORMAL" if (c_val and float(c_val) >= 23.5) else "KEK (< 23,5 cm)",
                })
            if prev.get("hb_level") is not None or visit_data.get("hb_level") is not None:
                p_val = prev.get("hb_level")
                c_val = visit_data.get("hb_level")
                diff = round(float(c_val) - float(p_val), 1) if (p_val is not None and c_val is not None) else None
                comparison_items.append({
                    "metric": "Hemoglobin (Hb)",
                    "unit": "g/dL",
                    "previous": p_val,
                    "current": c_val,
                    "delta": f"{'+' if diff and diff > 0 else ''}{diff} g/dL" if diff is not None else "-",
                    "status": "NORMAL" if (c_val and float(c_val) >= 11.0) else "ANEMIA",
                })
        else:
            p_w = prev.get("child_weight_kg") or (round(float(prev["birth_weight_gram"]) / 1000.0, 2) if prev.get("birth_weight_gram") else None)
            c_w = visit_data.get("child_weight_kg") or (round(float(visit_data["birth_weight_gram"]) / 1000.0, 2) if visit_data.get("birth_weight_gram") else None)
            if p_w is not None or c_w is not None:
                diff = round(float(c_w) - float(p_w), 2) if (p_w is not None and c_w is not None) else None
                comparison_items.append({
                    "metric": "Berat Badan Anak",
                    "unit": "kg",
                    "previous": p_w,
                    "current": c_w,
                    "delta": f"{'+' if diff and diff > 0 else ''}{diff} kg" if diff is not None else "-",
                    "status": "NAIK" if (diff is not None and diff > 0) else ("TIDAK NAIK / TURUN" if (diff is not None and diff <= 0) else "-"),
                })
            p_l = prev.get("child_length_cm") or prev.get("birth_length_cm")
            c_l = visit_data.get("child_length_cm") or visit_data.get("birth_length_cm")
            if p_l is not None or c_l is not None:
                diff = round(float(c_l) - float(p_l), 1) if (p_l is not None and c_l is not None) else None
                comparison_items.append({
                    "metric": "Panjang/Tinggi Badan",
                    "unit": "cm",
                    "previous": p_l,
                    "current": c_l,
                    "delta": f"{'+' if diff and diff > 0 else ''}{diff} cm" if diff is not None else "-",
                    "status": "BERTAMBAH" if (diff is not None and diff > 0) else "STAGNAN",
                })

    return {
        "total_previous_visits": len(longitudinal),
        "previous_visit_date": prev.get("visit_date") if prev else None,
        "previous_phase": prev.get("phase") if prev else None,
        "comparison_items": comparison_items,
        "maternal_history": maternal_history or None,
        "hpk_status": hpk_status,
    }


def detect_weight_faltering(longitudinal: List[Dict[str, Any]], visit_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mendeteksi berat badan anak tidak naik 2 kali berturut-turut ("2T" pada KMS).

    Berdasarkan 3 pengukuran berat terakhir (2 kunjungan sebelumnya + saat ini):
    2T jika berat saat ini <= sebelumnya DAN sebelumnya <= sebelumnya lagi.
    Jika data berat belum cukup, digunakan catatan tren KMS kader ("TIDAK_NAIK"
    pada kunjungan ini dan kunjungan sebelumnya).
    """
    series = [
        (h.get("visit_date"), h.get("child_weight_kg"))
        for h in longitudinal
        if h.get("child_weight_kg") is not None
    ]
    current_w = visit_data.get("child_weight_kg")
    if current_w is not None:
        series.append((visit_data.get("visit_date"), current_w))

    result: Dict[str, Any] = {
        "is_faltering": False,
        "method": "INSUFFICIENT_DATA",
        "weights_kg": [w for _, w in series[-3:]],
        "detail": "",
    }

    if len(series) >= 3:
        (d1, w1), (d2, w2), (d3, w3) = series[-3:]
        result["method"] = "WEIGHT_SERIES"
        if w3 <= w2 and w2 <= w1:
            result["is_faltering"] = True
            result["detail"] = (
                f"Berat badan tidak naik 2 kali berturut-turut (2T): "
                f"{w1} kg ({d1}) -> {w2} kg ({d2}) -> {w3} kg ({d3})."
            )
        return result

    prev_trend = longitudinal[-1].get("weight_trend_kms") if longitudinal else None
    if visit_data.get("weight_trend_kms") == "TIDAK_NAIK" and prev_trend == "TIDAK_NAIK":
        result.update({
            "is_faltering": True,
            "method": "KMS_TREND",
            "detail": "Catatan KMS menunjukkan berat badan tidak naik pada 2 kunjungan berturut-turut (2T).",
        })
    return result


# ----------------------------------------------------------------------------
# STAGE 2: Siklus ReAct (Reasoning + Acting) & Function Calling LLM + Guard
# ----------------------------------------------------------------------------
_NUMBER_RE = re.compile(r"-?\d+(?:[.,]\d+)?")


def _numbers_in(text: str) -> set:
    return {n.replace(",", ".").lstrip("-") for n in _NUMBER_RE.findall(text)}


def _numbers_are_grounded(narrative: str, context: str) -> bool:
    """
    Guard anti-halusinasi angka: setiap angka desimal atau angka >= 100 pada narasi
    LLM wajib muncul di konteks Stage 1.
    """
    cleaned = re.sub(r"1\.?000\s*(HPK|hari|Hari)", "", narrative)
    allowed = _numbers_in(context)
    for num in _numbers_in(cleaned):
        is_decimal = "." in num
        if (is_decimal or float(num) >= 100) and num not in allowed:
            try:
                if any(abs(float(num) - float(a)) < 1e-9 for a in allowed):
                    continue
            except ValueError:
                pass
            return False
    return True


def _stage2_react_narrative(
    state: AgentState,
    flags: List[Dict[str, Any]],
    det_results: Dict[str, Any],
    rule_points: List[str],
) -> Tuple[str, str, Dict[str, Any], List[str]]:
    rule_narrative = " ".join(rule_points) or "Tidak ada parameter klinis yang dapat dievaluasi."
    react_tools_called: List[str] = []

    llm = get_chat_llm(temperature=0.1, max_tokens=500)
    if llm is None:
        return (
            rule_narrative,
            MODE_FALLBACK,
            extract_token_usage(None, prompt_text=rule_narrative, output_text=rule_narrative, is_llm_call=False),
            react_tools_called,
        )

    visit_data = state.get("visit_data", {}) or {}
    phase = state.get("phase", "BADUTA")

    # Definisi Tools Deterministik untuk ReAct & Function Calling Agent 1 (Bab 2.3.4 & 2.3.5)
    @tool
    def check_data_plausibility() -> str:
        """Memeriksa plausibilitas biologis data input antropometri & klinis pasien saat ini."""
        return json.dumps(det_results.get("plausibility", check_visit_plausibility(phase, visit_data)), ensure_ascii=False)

    @tool
    def get_longitudinal_and_maternal_history() -> str:
        """Menarik riwayat kunjungan longitudinal pasien, posisi 1.000 HPK, serta riwayat risiko ibu hamil (KEK, Anemia, KSPR, BBLR)."""
        return json.dumps({
            "hpk_status": det_results.get("hpk_status"),
            "longitudinal_history": state.get("longitudinal_history", []),
            "maternal_history": state.get("maternal_history"),
            "longitudinal_summary": det_results.get("longitudinal_summary"),
        }, ensure_ascii=False, default=str)

    @tool
    def run_clinical_calculators() -> str:
        """Menjalankan kalkulator deterministik baku sesuai fase (WHO Z-score, KSPR Poedji Rochjati, LiLA KEK, Anemia Hb, BBLR)."""
        return json.dumps({
            "deterministic_results": det_results,
            "active_risk_flags": flags,
        }, ensure_ascii=False, default=str)

    tools = [check_data_plausibility, get_longitudinal_and_maternal_history, run_clinical_calculators]
    tool_map = {t.name: t for t in tools}

    context = {
        "fase": phase,
        "status_1000_hpk": det_results.get("hpk_status"),
        "plausibilitas_data": det_results.get("plausibility"),
        "hasil_kalkulasi_deterministik": det_results,
        "flag_risiko_aktif": flags,
        "ringkasan_temuan_aturan": rule_narrative,
        "riwayat_kunjungan_sebelumnya": state.get("longitudinal_history", []),
        "riwayat_maternal": state.get("maternal_history"),
        "catatan_kader": state.get("kader_feedback"),
    }
    context_str = json.dumps(context, ensure_ascii=False, default=str)

    user_prompt = (
        "Berikut hasil pemeriksaan deterministik dan konteks longitudinal 1.000 HPK pasien:\n"
        f"{context_str}\n\n"
        "Anda dapat memanggil tool `check_data_plausibility`, `get_longitudinal_and_maternal_history`, atau "
        "`run_clinical_calculators` bila memerlukan inspeksi tambahan, atau langsung menyusun narasi klinis ringkas "
        "2-3 kalimat dalam Bahasa Indonesia untuk kader Posyandu:\n"
        "1. Sebutkan posisi pasien pada periode 1.000 HPK serta temuan utama beserta angka yang ADA pada data.\n"
        "2. Hubungkan dengan riwayat kunjungan sebelumnya dan riwayat kehamilan ibu bila relevan.\n"
        "3. Jangan menambah diagnosis, flag, atau angka yang tidak ada pada data.\n"
        "Keluarkan HANYA teks narasi tanpa judul, poin, atau format markdown."
    )

    token_usages: List[Dict[str, Any]] = []
    full_prompt_text = f"{RISK_DETECTOR_SYSTEM_PROMPT}\n{user_prompt}"

    try:
        from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
        llm_with_tools = llm.bind_tools(tools)
        messages = [
            SystemMessage(content=RISK_DETECTOR_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ]

        step = 0
        narrative = ""
        while step < MAX_REACT_STEPS:
            step += 1
            ai_msg = llm_with_tools.invoke(messages)
            messages.append(ai_msg)
            token_usages.append(
                extract_token_usage(ai_msg, prompt_text=full_prompt_text, output_text=extract_text(ai_msg.content), is_llm_call=True)
            )
            tool_calls = getattr(ai_msg, "tool_calls", None) or []
            if not tool_calls:
                narrative = extract_text(ai_msg.content).strip()
                break

            for tc in tool_calls:
                fn_name = tc.get("name")
                fn_args = tc.get("args", {})
                call_id = tc.get("id") or f"call_{step}"
                if fn_name:
                    react_tools_called.append(f"ReAct Tool: {fn_name}")
                target = tool_map.get(fn_name)
                obs = target.invoke(fn_args) if target else "{}"
                messages.append(ToolMessage(content=str(obs), tool_call_id=call_id))

        if not narrative:
            final_msg = llm.invoke(messages)
            narrative = extract_text(final_msg.content).strip()
            token_usages.append(
                extract_token_usage(final_msg, prompt_text=full_prompt_text, output_text=narrative, is_llm_call=True)
            )
    except Exception as e:
        print(f"[RISK DETECTOR LLM WARNING] Fallback ke narasi aturan: {e}")
        return (
            rule_narrative,
            MODE_FALLBACK,
            extract_token_usage(None, prompt_text=full_prompt_text, output_text=rule_narrative, is_llm_call=False),
            react_tools_called,
        )

    merged_usage = merge_token_usage(token_usages)
    if not narrative:
        return (
            rule_narrative,
            MODE_FALLBACK,
            extract_token_usage(None, prompt_text=full_prompt_text, output_text=rule_narrative, is_llm_call=False),
            react_tools_called,
        )
    if not _numbers_are_grounded(narrative, context_str):
        print("[RISK DETECTOR GUARD] Narasi LLM memuat angka di luar hasil Stage 1; gunakan narasi aturan.")
        return rule_narrative, MODE_FALLBACK, merged_usage, react_tools_called
    return narrative, MODE_LLM, merged_usage, react_tools_called
