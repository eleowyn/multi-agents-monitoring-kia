import json
import re
from typing import Dict, Any, List, Optional, Tuple

from app.multiagent.state import AgentState
from app.multiagent.tools.who_zscore import calculate_who_zscore
from app.multiagent.tools.kspr import calculate_kspr
from app.multiagent.tools.anemia import classify_maternal_anemia
from app.multiagent.tools.anthropometry_check import check_kek_lila, check_bblr_and_gestation
from app.multiagent.prompts.risk_detector_prompt import RISK_DETECTOR_SYSTEM_PROMPT
from app.multiagent.llm_utils import get_chat_llm, extract_text, MODE_LLM, MODE_FALLBACK

BBLR_THRESHOLD_GRAM = 2500


def risk_detection_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 1: Deteksi Risiko (Hybrid Two-Stage)

    Stage 1 - Kalkulasi deterministik (tanpa LLM):
        Z-score WHO, KSPR, anemia Hb, KEK LiLA, BBLR, serta analisis longitudinal
        (berat badan tidak naik 2 kali berturut-turut / "2T"). Seluruh angka dan
        flag risiko HANYA berasal dari tahap ini.
    Stage 2 - Penalaran klinis LLM:
        Gemini menerima hasil Stage 1 + riwayat longitudinal & maternal + catatan
        kader, lalu menyusun narasi klinis. LLM tidak boleh mengubah flag/angka;
        narasi yang memuat angka di luar konteks ditolak (fallback ke narasi aturan).
    """
    flags, det_results, rule_points = _stage1_deterministic(state)

    narrative, mode = _stage2_llm_narrative(state, flags, det_results, rule_points)

    if state.get("kader_feedback"):
        narrative = f"{narrative} [CATATAN KADER SEBELUMNYA]: {state['kader_feedback']}"

    return {
        "risk_flags": flags,
        "risk_narrative": narrative,
        "deterministic_results": det_results,
        "requires_rag": len(flags) > 0,
        "narrative_mode": mode,
    }


# ----------------------------------------------------------------------------
# STAGE 1: Deterministik
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

        if maternal_history.get("is_kek"):
            risk_flags.append({
                "indicator": "LONGITUDINAL_MATERNAL_KEK",
                "flag": "RIWAYAT_IBU_KEK",
                "detail": "Ibu memiliki riwayat KEK saat hamil yang meningkatkan kerentanan pertumbuhan bayi.",
            })
            points.append("Terdapat riwayat maternal KEK pada masa kehamilan.")

    # ----------------- 3. FASE BADUTA (6 - 24 BULAN) -----------------
    elif phase == "BADUTA":
        age_months = visit_data.get("age_in_months")
        if age_months is None:
            age_months = 12
        weight = visit_data.get("child_weight_kg")
        length = visit_data.get("child_length_cm")

        res_zscore = calculate_who_zscore(
            gender=patient_data.get("gender") or "L",
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

        if maternal_history.get("is_kek"):
            risk_flags.append({
                "indicator": "LONGITUDINAL_MATERNAL_KEK",
                "flag": "RIWAYAT_IBU_KEK",
                "detail": "Ibu memiliki riwayat KEK saat hamil yang meningkatkan kerentanan stunting pada anak.",
            })
            points.append("Terdapat riwayat maternal KEK pada masa kehamilan.")

        faltering = detect_weight_faltering(longitudinal, visit_data)
        det_results["weight_trend"] = faltering
        if faltering["is_faltering"]:
            risk_flags.append({
                "indicator": "LONGITUDINAL_WEIGHT_TREND",
                "flag": "BB_TIDAK_NAIK_2T",
                "detail": faltering["detail"],
            })
            points.append(faltering["detail"])

    return risk_flags, det_results, points


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
# STAGE 2: Penalaran klinis LLM
# ----------------------------------------------------------------------------
_NUMBER_RE = re.compile(r"-?\d+(?:[.,]\d+)?")


def _numbers_in(text: str) -> set:
    return {n.replace(",", ".").lstrip("-") for n in _NUMBER_RE.findall(text)}


def _numbers_are_grounded(narrative: str, context: str) -> bool:
    """
    Guard anti-halusinasi angka: setiap angka desimal atau angka >= 100 pada narasi
    LLM wajib muncul di konteks Stage 1. Bilangan bulat kecil (usia bulan, trimester,
    "2 kali") diabaikan agar tidak terlalu ketat.
    """
    cleaned = re.sub(r"1\.000\s*(HPK|hari|Hari)", "", narrative)
    allowed = _numbers_in(context)
    for num in _numbers_in(cleaned):
        is_decimal = "." in num
        if (is_decimal or float(num) >= 100) and num not in allowed:
            try:
                # toleransi format: "22.0" == "22"
                if any(abs(float(num) - float(a)) < 1e-9 for a in allowed):
                    continue
            except ValueError:
                pass
            return False
    return True


def _stage2_llm_narrative(
    state: AgentState,
    flags: List[Dict[str, Any]],
    det_results: Dict[str, Any],
    rule_points: List[str],
) -> Tuple[str, str]:
    rule_narrative = " ".join(rule_points) or "Tidak ada parameter klinis yang dapat dievaluasi."

    llm = get_chat_llm(temperature=0.1)
    if llm is None:
        return rule_narrative, MODE_FALLBACK

    context = {
        "fase": state.get("phase"),
        "hasil_kalkulasi_deterministik": det_results,
        "flag_risiko_aktif": flags,
        "ringkasan_temuan_aturan": rule_narrative,
        "riwayat_kunjungan_sebelumnya": state.get("longitudinal_history", []),
        "riwayat_maternal": state.get("maternal_history"),
        "catatan_kader": state.get("kader_feedback"),
    }
    context_str = json.dumps(context, ensure_ascii=False, default=str)

    user_prompt = (
        "Berikut hasil Stage 1 (kalkulasi deterministik) dan konteks longitudinal pasien:\n"
        f"{context_str}\n\n"
        "Susun narasi klinis 3-5 kalimat dalam Bahasa Indonesia untuk kader Posyandu:\n"
        "1. Ringkas temuan utama beserta angka yang ADA pada data di atas.\n"
        "2. Hubungkan dengan riwayat kunjungan sebelumnya dan riwayat ibu bila relevan.\n"
        "3. Jangan menambah diagnosis, flag, atau angka yang tidak ada pada data.\n"
        "Keluarkan HANYA teks narasi tanpa judul, poin, atau format markdown."
    )

    try:
        from langchain_core.messages import SystemMessage, HumanMessage
        response = llm.invoke([
            SystemMessage(content=RISK_DETECTOR_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt),
        ])
        narrative = extract_text(response.content).strip()
    except Exception as e:
        print(f"[RISK DETECTOR LLM WARNING] Fallback ke narasi aturan: {e}")
        return rule_narrative, MODE_FALLBACK

    if not narrative:
        return rule_narrative, MODE_FALLBACK
    if not _numbers_are_grounded(narrative, context_str):
        print("[RISK DETECTOR GUARD] Narasi LLM memuat angka di luar hasil Stage 1; gunakan narasi aturan.")
        return rule_narrative, MODE_FALLBACK
    return narrative, MODE_LLM
