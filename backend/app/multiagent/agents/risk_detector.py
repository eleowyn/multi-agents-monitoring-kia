from typing import Dict, Any, List
from app.multiagent.state import AgentState
from app.multiagent.tools.who_zscore import calculate_who_zscore
from app.multiagent.tools.kspr import calculate_kspr
from app.multiagent.tools.anemia import classify_maternal_anemia
from app.multiagent.tools.anthropometry_check import check_kek_lila, check_bblr_and_gestation


def risk_detection_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 1: Deteksi Risiko (Deterministic Calculation + Longitudinal Context)
    
    1. Memanggil tools kalkulator deterministik sesuai fase (Hamil, Bayi Lahir, Baduta).
    2. Menghubungkan riwayat longitudinal (misal: riwayat KEK ibu saat hamil ke anak).
    3. Menghasilkan daftar flag risiko aktif dan narasi klinis.
    4. Menentukan routing kondisional: requires_rag (True jika ada flag risiko).
    """
    phase = state.get("phase", "BADUTA")
    visit_data = state.get("visit_data", {})
    patient_data = state.get("patient_data", {})
    maternal_history = state.get("maternal_history")
    
    risk_flags: List[Dict[str, Any]] = []
    det_results: Dict[str, Any] = {}
    narrative_points: List[str] = []

    # ----------------- 1. FASE IBU HAMIL -----------------
    if phase == "IBU_HAMIL":
        # a. Cek LiLA (KEK)
        lila = visit_data.get("lila_cm")
        if lila is not None:
            res_kek = check_kek_lila(float(lila))
            det_results["lila_kek"] = res_kek
            risk_flags.extend(res_kek["risk_flags"])
            if res_kek["is_kek"]:
                narrative_points.append(f"Ibu hamil terindikasi KEK dengan ukuran LiLA {lila} cm.")
            else:
                narrative_points.append(f"Ukuran LiLA ibu normal ({lila} cm).")

        # b. Cek Kadar Hemoglobin (Anemia)
        hb = visit_data.get("hb_level")
        trimester = visit_data.get("trimester", 1)
        if hb is not None:
            res_anemia = classify_maternal_anemia(float(hb), trimester=int(trimester))
            det_results["anemia"] = res_anemia
            risk_flags.extend(res_anemia["risk_flags"])
            if res_anemia["status"] != "NORMAL":
                narrative_points.append(f"Kadar Hb {hb} g/dL pada Trimester {trimester} tergolong {res_anemia['severity_label']}.")
            else:
                narrative_points.append(f"Kadar Hb normal ({hb} g/dL).")

        # c. Skoring KSPR Poedji Rochjati
        kspr_answers = visit_data.get("kspr_answers", [])
        m_age = visit_data.get("maternal_age")
        m_height = visit_data.get("maternal_height_cm")
        sys_bp = visit_data.get("systolic_bp")
        dia_bp = visit_data.get("diastolic_bp")
        
        res_kspr = calculate_kspr(
            selected_risk_keys=kspr_answers,
            maternal_age=int(m_age) if m_age else None,
            maternal_height_cm=float(m_height) if m_height else None,
            systolic_bp=int(sys_bp) if sys_bp else None,
            diastolic_bp=int(dia_bp) if dia_bp else None
        )
        det_results["kspr"] = res_kspr
        risk_flags.extend(res_kspr["risk_flags"])
        narrative_points.append(f"Skoring KSPR menghasilkan Skor {res_kspr['total_score']} ({res_kspr['category_label']}).")

    # ----------------- 2. FASE BAYI BARU LAHIR -----------------
    elif phase == "BAYI_BARU_LAHIR":
        birth_weight = visit_data.get("birth_weight_gram")
        gest_age = visit_data.get("gestational_age_at_birth_weeks")
        
        if birth_weight is not None:
            res_bblr = check_bblr_and_gestation(
                birth_weight_gram=float(birth_weight),
                gestational_age_weeks=int(gest_age) if gest_age else None
            )
            det_results["bblr"] = res_bblr
            risk_flags.extend(res_bblr["risk_flags"])
            narrative_points.append(f"Bayi lahir dengan berat {birth_weight} gram ({res_bblr['weight_label']}).")

        # Tarik konteks riwayat maternal
        if maternal_history and maternal_history.get("is_kek"):
            risk_flags.append({
                "indicator": "LONGITUDINAL_MATERNAL_KEK",
                "flag": "RIWAYAT_IBU_KEK",
                "detail": "Ibu memiliki riwayat KEK saat hamil yang meningkatkan kerentanan pertumbuhan bayi."
            })
            narrative_points.append("Terdapat riwayat maternal KEK pada masa kehamilan.")

    # ----------------- 3. FASE BADUTA (6 - 24 BULAN) -----------------
    elif phase == "BADUTA":
        gender = patient_data.get("gender", "L")
        age_months = visit_data.get("age_in_months", 12)
        weight = visit_data.get("child_weight_kg")
        length = visit_data.get("child_length_cm")
        
        res_zscore = calculate_who_zscore(
            gender=gender,
            age_in_months=int(age_months),
            weight_kg=float(weight) if weight else None,
            length_cm=float(length) if length else None
        )
        det_results["who_zscore"] = res_zscore
        risk_flags.extend(res_zscore["risk_flags"])
        
        pb_u = res_zscore["indicators"].get("PB_U", {})
        bb_u = res_zscore["indicators"].get("BB_U", {})
        bb_pb = res_zscore["indicators"].get("BB_PB", {})
        
        narrative_points.append(
            f"Evaluasi antropometri Baduta usia {age_months} bulan: "
            f"PB/U Z={pb_u.get('z_score', '-')} ({pb_u.get('category', '-')}), "
            f"BB/U Z={bb_u.get('z_score', '-')} ({bb_u.get('category', '-')}), "
            f"BB/PB Z={bb_pb.get('z_score', '-')} ({bb_pb.get('category', '-')})."
        )
        
        # Cek riwayat BBLR saat lahir
        if maternal_history and maternal_history.get("birth_weight_gram", 3000) < 2500:
            risk_flags.append({
                "indicator": "LONGITUDINAL_BBLR",
                "flag": "RIWAYAT_BBLR_ANAK",
                "detail": "Anak memiliki riwayat lahir BBLR yang memperberat risiko keterlambatan pertumbuhan."
            })
            narrative_points.append("Riwayat kelahiran menunjukkan kondisi BBLR.")

    # Cek umpan balik perbaikan dari kader jika ini adalah iterasi pengulangan
    if state.get("kader_feedback"):
        narrative_points.append(f"[CATATAN KADER SEBELUMNYA]: {state['kader_feedback']}")

    # Susun teks narasi klinis
    risk_narrative = " ".join(narrative_points)
    requires_rag = len(risk_flags) > 0

    return {
        "risk_flags": risk_flags,
        "risk_narrative": risk_narrative,
        "deterministic_results": det_results,
        "requires_rag": requires_rag
    }

