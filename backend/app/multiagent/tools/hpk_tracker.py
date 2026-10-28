"""
Kalkulator Deterministik Garis Waktu 1.000 Hari Pertama Kehidupan (HPK)
dan Pengecekan Plausibilitas Data Pengukuran Antropometri/Klinis.

Konsep Baku 1.000 HPK (Kemenkes RI & WHO):
- Fase 1 (Kehamilan): 270 hari (Hari ke-1 s.d. Hari ke-270)
- Fase 2 (Bayi Baru Lahir / Neonatal 0-28 hari): 28 hari (Hari ke-271 s.d. Hari ke-298)
- Fase 3 (Baduta 1-24 bulan): 702 hari (Hari ke-299 s.d. Hari ke-1.000)
Total = 1.000 Hari Periode Emas Pencegahan Stunting.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional


def _parse_date(val: Any) -> Optional[date]:
    if not val:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    try:
        return date.fromisoformat(str(val)[:10])
    except Exception:
        return None


def calculate_1000_hpk_status(
    phase: Optional[str] = None,
    patient_type: Optional[str] = None,
    birth_date: Any = None,
    visit_date: Any = None,
    gestational_age_weeks: Optional[int] = None,
    trimester: Optional[int] = None,
    age_in_months: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Menghitung posisi pasien pada garis waktu 1.000 Hari Pertama Kehidupan (HPK)
    secara deterministik.
    """
    b_date = _parse_date(birth_date)
    v_date = _parse_date(visit_date) or date.today()
    norm_phase = str(phase or "").upper()
    norm_type = str(patient_type or "").upper()

    is_mother = norm_phase == "IBU_HAMIL" or (not norm_phase and norm_type == "MOTHER")

    if is_mother:
        if gestational_age_weeks is not None and int(gestational_age_weeks) > 0:
            weeks = min(42, max(1, int(gestational_age_weeks)))
            pregnancy_days = min(270, weeks * 7)
            inferred_trimester = trimester or (1 if weeks <= 12 else (2 if weeks <= 27 else 3))
        elif trimester is not None and int(trimester) in (1, 2, 3):
            inferred_trimester = int(trimester)
            weeks = {1: 10, 2: 20, 3: 34}[inferred_trimester]
            pregnancy_days = {1: 70, 2: 140, 3: 238}[inferred_trimester]
        else:
            inferred_trimester = 2
            weeks = 20
            pregnancy_days = 140

        hpk_day = pregnancy_days
        hpk_day_clamped = min(1000, max(1, hpk_day))
        progress_percent = round((hpk_day_clamped / 1000.0) * 100, 1)
        pregnancy_percent = round((pregnancy_days / 270.0) * 100, 1)
        remaining_days = max(0, 1000 - hpk_day_clamped)

        return {
            "hpk_day": hpk_day_clamped,
            "raw_hpk_day": hpk_day,
            "total_hpk_days": 1000,
            "pregnancy_days_elapsed": pregnancy_days,
            "child_age_days": 0,
            "child_age_months": 0,
            "gestational_age_weeks": weeks,
            "trimester": inferred_trimester,
            "progress_percent": progress_percent,
            "phase_progress_percent": pregnancy_percent,
            "remaining_days": remaining_days,
            "is_within_1000_hpk": True,
            "phase_code": "IBU_HAMIL",
            "phase_segment": "FASE_1_KEHAMILAN",
            "phase_label": f"Fase 1: Ibu Hamil (Trimester {inferred_trimester} • {weeks} Minggu)",
            "golden_period_status": "DALAM_PERIODE_EMAS_1000_HPK",
            "target_milestone": (
                "Kunjungan ANC berkala (min. 6x), LiLA >= 23,5 cm (bebas KEK), "
                "Hb >= 11 g/dL, konsumsi Tablet Tambah Darah (TTD) min. 90 tablet."
            ),
            "summary_label": (
                f"Hari ke-{hpk_day_clamped} dari 1.000 HPK ({progress_percent}%) • "
                f"Masa Kehamilan (Sisa {remaining_days} hari periode emas)"
            ),
        }

    # Pasien Anak (BAYI_BARU_LAHIR atau BADUTA)
    exact_days: Optional[int] = None
    if b_date and v_date and v_date >= b_date:
        exact_days = (v_date - b_date).days

    if norm_phase == "BAYI_BARU_LAHIR":
        if exact_days is not None and 0 <= exact_days <= 28:
            child_age_days = exact_days
        else:
            child_age_days = 7
        child_age_months = 0
    elif age_in_months is not None:
        child_age_months = max(0, int(age_in_months))
        if exact_days is not None and abs(exact_days - (child_age_months * 30)) <= 35:
            child_age_days = max(1, exact_days)
        else:
            child_age_days = max(1, int(round(child_age_months * 30.4375)))
    elif exact_days is not None:
        child_age_days = exact_days
        child_age_months = child_age_days // 30
    else:
        child_age_months = 12
        child_age_days = 365

    hpk_day = 270 + child_age_days
    hpk_day_clamped = min(1000, max(271, hpk_day))
    progress_percent = round((hpk_day_clamped / 1000.0) * 100, 1)
    remaining_days = max(0, 1000 - hpk_day)
    is_within = hpk_day <= 1000

    if norm_phase == "BAYI_BARU_LAHIR" or child_age_days <= 28:
        phase_code = "BAYI_BARU_LAHIR"
        phase_segment = "FASE_2_BAYI_BARU_LAHIR"
        phase_label = f"Fase 2: Bayi Baru Lahir ({child_age_days} Hari)"
        phase_progress = round((min(28, max(1, child_age_days)) / 28.0) * 100, 1)
        milestone = (
            "Inisiasi Menyusu Dini (IMD), ASI Eksklusif, Kunjungan Neonatal (KN1-KN3), "
            "pemantauan suhu & kenaikan berat badan pasca lahir."
        )
    else:
        phase_code = "BADUTA"
        phase_segment = "FASE_3_BADUTA"
        phase_progress = round((min(730, max(29, child_age_days)) / 730.0) * 100, 1)
        if child_age_months < 6:
            phase_label = f"Fase 3: Baduta 1-24 Bulan ({child_age_months} Bulan • Masa ASI Eksklusif)"
            milestone = (
                "ASI Eksklusif penuh (0-6 bulan), penimbangan BB & pengukuran PB bulanan "
                "di Posyandu (KMS), serta imunisasi dasar lengkap."
            )
        else:
            if child_age_months >= 24 or child_age_days >= 730 or hpk_day >= 1000:
                phase_label = f"Fase 3: Baduta 1–24 Bulan ({child_age_months} Bulan • Kelulusan 1.000 HPK)"
                milestone = (
                    "Milestone Hari ke-1.000 (Kelulusan 1.000 HPK): Evaluasi akhir status stunting/gizi, "
                    "transisi menyapih bertahap penuh kasih (weaning with love), makanan keluarga balita 2–5 tahun, dan KPSP 24 bulan."
                )
            else:
                phase_label = f"Fase 3: Baduta 1-24 Bulan ({child_age_months} Bulan • Masa MP-ASI)"
                milestone = (
                    "Pemberian MP-ASI adekuat kaya protein hewani + ASI lanjutan hingga 2 tahun, "
                    "kapsul Vitamin A, dan pemantauan kurva Z-Score WHO."
                )

    is_graduation = (child_age_months is not None and child_age_months >= 24) or (child_age_days is not None and child_age_days >= 730) or (hpk_day >= 1000)
    status_str = "LULUS_1000_HPK" if is_graduation else ("DALAM_PERIODE_EMAS_1000_HPK" if is_within else "LULUS_1000_HPK")
    if is_graduation:
        summary_label = f"Hari ke-{hpk_day_clamped} dari 1.000 HPK (100% Selesai) • Milestone Kelulusan Periode Emas"
    elif is_within:
        summary_label = (
            f"Hari ke-{hpk_day_clamped} dari 1.000 HPK ({progress_percent}%) • "
            f"Sisa {remaining_days} hari periode emas"
        )
    else:
        summary_label = (
            f"Hari ke-{hpk_day} (100% Periode Emas 1.000 HPK Selesai • Pemantauan Lanjutan Balita)"
        )

    return {
        "hpk_day": hpk_day_clamped,
        "raw_hpk_day": hpk_day,
        "total_hpk_days": 1000,
        "pregnancy_days_elapsed": 270,
        "child_age_days": child_age_days,
        "child_age_months": child_age_months,
        "gestational_age_weeks": None,
        "trimester": None,
        "progress_percent": progress_percent,
        "phase_progress_percent": phase_progress,
        "remaining_days": remaining_days,
        "is_within_1000_hpk": is_within,
        "is_graduation_milestone": is_graduation,
        "graduation_badge": "🎓 Kelulusan Periode Emas 1.000 HPK (Usia 24 Bulan)" if is_graduation else None,
        "phase_code": phase_code,
        "phase_segment": phase_segment,
        "phase_label": phase_label,
        "golden_period_status": status_str,
        "target_milestone": milestone,
        "summary_label": summary_label,
    }


def check_visit_plausibility(phase: str, visit_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Memeriksa kewajaran biologis (plausibilitas) nilai input antropometri dan klinis
    sebelum kalkulasi risiko dijalankan (Sesuai Bab 2.3.4 & Lampiran 1 No. 20).
    """
    warnings: List[str] = []
    norm_phase = str(phase or "BADUTA").upper()

    if norm_phase == "IBU_HAMIL":
        lila = visit_data.get("lila_cm")
        if lila is not None and not (12.0 <= float(lila) <= 50.0):
            warnings.append(f"Nilai LiLA ({lila} cm) di luar rentang biologis wajar (12-50 cm); periksa ulang pengukuran.")
        hb = visit_data.get("hb_level")
        if hb is not None and not (4.0 <= float(hb) <= 20.0):
            warnings.append(f"Nilai Hb ({hb} g/dL) di luar rentang wajar (4-20 g/dL); periksa ulang alat ukur Hb.")
        mw = visit_data.get("maternal_weight_kg")
        if mw is not None and not (30.0 <= float(mw) <= 160.0):
            warnings.append(f"Berat badan ibu ({mw} kg) di luar rentang wajar (30-160 kg).")

    elif norm_phase == "BAYI_BARU_LAHIR":
        bw = visit_data.get("birth_weight_gram")
        if bw is not None and not (500.0 <= float(bw) <= 6000.0):
            warnings.append(f"Berat lahir ({bw} g) di luar rentang wajar neonatus (500-6000 g).")
        bl = visit_data.get("birth_length_cm")
        if bl is not None and not (30.0 <= float(bl) <= 65.0):
            warnings.append(f"Panjang lahir ({bl} cm) di luar rentang wajar neonatus (30-65 cm).")

    elif norm_phase == "BADUTA":
        cw = visit_data.get("child_weight_kg")
        if cw is not None and not (1.5 <= float(cw) <= 25.0):
            warnings.append(f"Berat badan baduta ({cw} kg) di luar rentang wajar (1,5-25 kg).")
        cl = visit_data.get("child_length_cm")
        if cl is not None and not (40.0 <= float(cl) <= 110.0):
            warnings.append(f"Panjang/tinggi badan baduta ({cl} cm) di luar rentang wajar (40-110 cm).")

    return {
        "is_plausible": len(warnings) == 0,
        "warnings": warnings,
        "checked_phase": norm_phase,
    }

