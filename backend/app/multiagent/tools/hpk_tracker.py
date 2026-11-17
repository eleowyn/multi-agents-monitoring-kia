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


def _months_between(birth: date, on: date) -> int:
    """Umur dalam bulan penuh (kalender) dari tanggal lahir sampai tanggal tertentu."""
    months = (on.year - birth.year) * 12 + (on.month - birth.month)
    if on.day < birth.day:
        months -= 1
    return max(0, months)


def _no_data_status(phase_code: str, message: str) -> Dict[str, Any]:
    """Status bila data belum cukup: tidak ada angka hari HPK yang dikarang."""
    return {
        "hpk_day": None,
        "raw_hpk_day": None,
        "total_hpk_days": 1000,
        "data_available": False,
        "progress_percent": 0,
        "phase_progress_percent": 0,
        "remaining_days": None,
        "is_within_1000_hpk": None,
        "is_graduation_milestone": False,
        "phase_code": phase_code,
        "phase_segment": None,
        "phase_label": message,
        "golden_period_status": "BELUM_ADA_DATA",
        "target_milestone": None,
        "summary_label": message,
        "warnings": [],
    }


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
    Menghitung posisi pasien pada garis waktu 1.000 HPK secara deterministik.
    - Ibu hamil: hari ke = minggu kehamilan x 7 (maks. 270).
    - Anak: hari ke = 270 + umur dalam hari sejak lahir (maks. 1.000).
    Bila data tidak cukup, hpk_day = None (tidak diasumsikan).
    """
    b_date = _parse_date(birth_date)
    v_date = _parse_date(visit_date) or date.today()
    norm_phase = str(phase or "").upper()
    norm_type = str(patient_type or "").upper()

    is_mother = norm_phase == "IBU_HAMIL" or (not norm_phase and norm_type == "MOTHER")

    if is_mother:
        warnings: List[str] = []
        estimated = False
        if gestational_age_weeks is not None and int(gestational_age_weeks) > 0:
            weeks = min(42, max(1, int(gestational_age_weeks)))
            inferred_trimester = int(trimester) if trimester in (1, 2, 3) else (1 if weeks <= 12 else (2 if weeks <= 27 else 3))
        elif trimester is not None and int(trimester) in (1, 2, 3):
            # Hanya trimester yang diisi: titik tengah trimester, ditandai sebagai perkiraan
            inferred_trimester = int(trimester)
            weeks = {1: 7, 2: 20, 3: 34}[inferred_trimester]
            estimated = True
            warnings.append("Usia kehamilan (minggu) tidak diisi; posisi HPK diperkirakan dari titik tengah trimester.")
        else:
            return _no_data_status("IBU_HAMIL", "Usia kehamilan belum diisi")

        pregnancy_days = min(270, weeks * 7)
        hpk_day = max(1, pregnancy_days)
        progress_percent = round((hpk_day / 1000.0) * 100, 1)
        remaining_days = 1000 - hpk_day
        est_note = " (perkiraan dari trimester)" if estimated else ""

        return {
            "hpk_day": hpk_day,
            "raw_hpk_day": hpk_day,
            "total_hpk_days": 1000,
            "data_available": True,
            "is_estimated": estimated,
            "pregnancy_days_elapsed": pregnancy_days,
            "child_age_days": 0,
            "child_age_months": 0,
            "gestational_age_weeks": weeks,
            "trimester": inferred_trimester,
            "progress_percent": progress_percent,
            "phase_progress_percent": round((pregnancy_days / 270.0) * 100, 1),
            "remaining_days": remaining_days,
            "is_within_1000_hpk": True,
            "is_graduation_milestone": False,
            "phase_code": "IBU_HAMIL",
            "phase_segment": "FASE_1_KEHAMILAN",
            "phase_label": f"Fase 1: Ibu Hamil (Trimester {inferred_trimester} • {weeks} Minggu){est_note}",
            "golden_period_status": "DALAM_PERIODE_EMAS_1000_HPK",
            "target_milestone": (
                "Kunjungan ANC berkala (min. 6x), LiLA >= 23,5 cm (bebas KEK), "
                "Hb >= 11 g/dL, konsumsi Tablet Tambah Darah (TTD) min. 90 tablet."
            ),
            "summary_label": (
                f"Hari ke-{hpk_day} dari 1.000 HPK ({progress_percent}%){est_note} • "
                f"Masa Kehamilan (Sisa {remaining_days} hari periode emas)"
            ),
            "warnings": warnings,
        }

    # Pasien Anak (BAYI_BARU_LAHIR atau BADUTA): umur dihitung dari tanggal lahir
    warnings = []
    if b_date and v_date >= b_date:
        child_age_days = (v_date - b_date).days
        child_age_months = _months_between(b_date, v_date)
        if age_in_months is not None and abs(int(age_in_months) - child_age_months) >= 1:
            warnings.append(
                f"Isian usia {age_in_months} bulan berbeda dengan usia menurut tanggal lahir "
                f"({child_age_months} bulan); dipakai usia menurut tanggal lahir."
            )
    elif b_date and v_date < b_date:
        return _no_data_status("ANAK", "Tanggal kunjungan sebelum tanggal lahir")
    elif age_in_months is not None:
        child_age_months = max(0, int(age_in_months))
        child_age_days = int(round(child_age_months * 30.4375))
        warnings.append("Tanggal lahir tidak tersedia; posisi HPK dihitung dari isian usia (bulan).")
    else:
        return _no_data_status("ANAK", "Tanggal lahir dan usia anak belum tersedia")

    hpk_day = 270 + child_age_days
    hpk_day_clamped = min(1000, max(271, hpk_day))
    progress_percent = round((hpk_day_clamped / 1000.0) * 100, 1)
    remaining_days = max(0, 1000 - hpk_day)
    is_within = hpk_day <= 1000
    is_graduation = child_age_months >= 24 or hpk_day >= 1000

    if child_age_days <= 28:
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
        phase_progress = round(((min(730, child_age_days) - 28) / 702.0) * 100, 1)
        if is_graduation:
            phase_label = f"Fase 3: Baduta 1-24 Bulan ({child_age_months} Bulan • Kelulusan 1.000 HPK)"
            milestone = (
                "Milestone Hari ke-1.000 (Kelulusan 1.000 HPK): Evaluasi akhir status stunting/gizi, "
                "transisi menyapih bertahap penuh kasih (weaning with love), makanan keluarga balita 2–5 tahun, dan KPSP 24 bulan."
            )
        elif child_age_months < 6:
            phase_label = f"Fase 3: Baduta 1-24 Bulan ({child_age_months} Bulan • Masa ASI Eksklusif)"
            milestone = (
                "ASI Eksklusif penuh (0-6 bulan), penimbangan BB & pengukuran PB bulanan "
                "di Posyandu (KMS), serta imunisasi dasar lengkap."
            )
        else:
            phase_label = f"Fase 3: Baduta 1-24 Bulan ({child_age_months} Bulan • Masa MP-ASI)"
            milestone = (
                "Pemberian MP-ASI adekuat kaya protein hewani + ASI lanjutan hingga 2 tahun, "
                "kapsul Vitamin A, dan pemantauan kurva Z-Score WHO."
            )

    if norm_phase == "BAYI_BARU_LAHIR" and child_age_days > 28:
        warnings.append(f"Kunjungan dicatat sebagai Bayi Baru Lahir, padahal usia anak {child_age_days} hari (> 28 hari).")

    if is_graduation:
        status_str = "LULUS_1000_HPK"
        summary_label = f"Hari ke-{hpk_day_clamped} dari 1.000 HPK (100% Selesai) • Milestone Kelulusan Periode Emas"
    else:
        status_str = "DALAM_PERIODE_EMAS_1000_HPK"
        summary_label = (
            f"Hari ke-{hpk_day_clamped} dari 1.000 HPK ({progress_percent}%) • "
            f"Sisa {remaining_days} hari periode emas"
        )

    return {
        "hpk_day": hpk_day_clamped,
        "raw_hpk_day": hpk_day,
        "total_hpk_days": 1000,
        "data_available": True,
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
        "graduation_badge": "Kelulusan Periode Emas 1.000 HPK (Usia 24 Bulan)" if is_graduation else None,
        "phase_code": phase_code,
        "phase_segment": phase_segment,
        "phase_label": phase_label,
        "golden_period_status": status_str,
        "target_milestone": milestone,
        "summary_label": summary_label,
        "warnings": warnings,
    }


def pregnancy_completed_status(child_name: str, child_birth_date: Any) -> Dict[str, Any]:
    """Status 1.000 HPK ibu yang sudah melahirkan: fase kehamilan selesai, dilanjutkan pada anak."""
    return {
        "hpk_day": 270,
        "raw_hpk_day": 270,
        "total_hpk_days": 1000,
        "data_available": True,
        "pregnancy_days_elapsed": 270,
        "progress_percent": 27.0,
        "phase_progress_percent": 100.0,
        "remaining_days": None,
        "is_within_1000_hpk": True,
        "is_graduation_milestone": False,
        "phase_code": "KEHAMILAN_SELESAI",
        "phase_segment": "FASE_1_SELESAI",
        "phase_label": f"Kehamilan selesai • Pemantauan dilanjutkan pada anak {child_name}",
        "golden_period_status": "KEHAMILAN_SELESAI",
        "target_milestone": None,
        "summary_label": (
            f"Fase kehamilan selesai (lahir {child_birth_date}) • "
            f"Pemantauan 1.000 HPK dilanjutkan pada anak {child_name}"
        ),
        "warnings": [],
    }


def check_visit_plausibility(phase: str, visit_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Memeriksa kewajaran biologis (plausibilitas) dan kelengkapan pengukuran minimal
    sebelum kalkulasi risiko dijalankan (Sesuai Bab 1.5.1 No. 6, Bab 4.2.2 & Lampiran 1 No. 20).
    Jika data tidak lengkap atau di luar batas wajar biologis, Agent 1 memicu Early Exit.
    """
    warnings: List[str] = []
    norm_phase = str(phase or "BADUTA").upper()

    if norm_phase == "IBU_HAMIL":
        # 1. Pengecekan kelengkapan minimal: harus ada minimal 1 parameter fisik/antropometri terisi
        has_measurement = any(
            visit_data.get(k) is not None
            for k in ["lila_cm", "hb_level", "maternal_weight_kg", "maternal_height_cm", "systolic_bp", "diastolic_bp", "fundal_height_cm"]
        )
        if not has_measurement:
            warnings.append(
                "Data pemeriksaan klinis ibu hamil belum diisi sama sekali (LiLA, Berat Badan, Tinggi Badan, Hb, atau Tekanan Darah). "
                "Harap isi minimal salah satu pengukuran fisik sebelum memproses kunjungan."
            )

        # 2. Pengecekan rentang wajar biologis
        gest = visit_data.get("gestational_age_weeks")
        if gest is not None and not (1 <= int(gest) <= 45):
            warnings.append(f"Usia kehamilan ({gest} minggu) di luar rentang wajar gestasi manusia (1-45 minggu).")
        trimester = visit_data.get("trimester")
        if trimester is not None and not (1 <= int(trimester) <= 3):
            warnings.append(f"Trimester kehamilan ({trimester}) tidak valid (harus 1, 2, atau 3).")
        lila = visit_data.get("lila_cm")
        if lila is not None and not (12.0 <= float(lila) <= 50.0):
            warnings.append(f"Nilai LiLA ({lila} cm) di luar rentang biologis wajar (12-50 cm); periksa ulang pengukuran.")
        hb = visit_data.get("hb_level")
        if hb is not None and not (4.0 <= float(hb) <= 20.0):
            warnings.append(f"Nilai Hb ({hb} g/dL) di luar rentang wajar (4-20 g/dL); periksa ulang alat ukur Hb.")
        mw = visit_data.get("maternal_weight_kg")
        if mw is not None and not (30.0 <= float(mw) <= 160.0):
            warnings.append(f"Berat badan ibu ({mw} kg) di luar rentang wajar (30-160 kg).")
        mh = visit_data.get("maternal_height_cm")
        if mh is not None and not (120.0 <= float(mh) <= 210.0):
            warnings.append(f"Tinggi badan ibu ({mh} cm) di luar rentang wajar (120-210 cm).")
        sys_bp = visit_data.get("systolic_bp")
        if sys_bp is not None and not (60 <= int(sys_bp) <= 250):
            warnings.append(f"Tekanan darah sistolik ({sys_bp} mmHg) di luar rentang wajar (60-250 mmHg).")
        dia_bp = visit_data.get("diastolic_bp")
        if dia_bp is not None and not (40 <= int(dia_bp) <= 150):
            warnings.append(f"Tekanan darah diastolik ({dia_bp} mmHg) di luar rentang wajar (40-150 mmHg).")

    elif norm_phase == "BAYI_BARU_LAHIR":
        # 1. Pengecekan kelengkapan minimal
        has_measurement = any(
            visit_data.get(k) is not None
            for k in ["birth_weight_gram", "birth_length_cm", "head_circumference_cm"]
        )
        if not has_measurement:
            warnings.append(
                "Data pemeriksaan fisik bayi baru lahir belum diisi sama sekali (Berat Lahir, Panjang Lahir, atau Lingkar Kepala). "
                "Harap isi minimal salah satu pengukuran sebelum memproses kunjungan."
            )

        # 2. Pengecekan rentang wajar biologis
        bw = visit_data.get("birth_weight_gram")
        if bw is not None and not (500.0 <= float(bw) <= 6000.0):
            warnings.append(f"Berat lahir ({bw} g) di luar rentang wajar neonatus (500-6000 g).")
        bl = visit_data.get("birth_length_cm")
        if bl is not None and not (30.0 <= float(bl) <= 65.0):
            warnings.append(f"Panjang lahir ({bl} cm) di luar rentang wajar neonatus (30-65 cm).")
        hc = visit_data.get("head_circumference_cm")
        if hc is not None and not (25.0 <= float(hc) <= 45.0):
            warnings.append(f"Lingkar kepala lahir ({hc} cm) di luar rentang wajar (25-45 cm).")
        ga = visit_data.get("gestational_age_at_birth_weeks")
        if ga is not None and not (20 <= int(ga) <= 45):
            warnings.append(f"Usia gestasi saat lahir ({ga} minggu) di luar rentang wajar (20-45 minggu).")

    elif norm_phase == "BADUTA":
        # 1. Pengecekan kelengkapan minimal
        has_measurement = any(
            visit_data.get(k) is not None
            for k in ["child_weight_kg", "child_length_cm", "child_head_circumference_cm"]
        )
        if not has_measurement:
            warnings.append(
                "Data pengukuran antropometri baduta belum diisi sama sekali (Berat Badan atau Panjang/Tinggi Badan). "
                "Harap isi minimal salah satu pengukuran antropometri sebelum memproses kunjungan."
            )

        # 2. Pengecekan rentang wajar biologis
        cw = visit_data.get("child_weight_kg")
        if cw is not None and not (1.5 <= float(cw) <= 25.0):
            warnings.append(f"Berat badan baduta ({cw} kg) di luar rentang wajar (1,5-25 kg).")
        cl = visit_data.get("child_length_cm")
        if cl is not None and not (40.0 <= float(cl) <= 110.0):
            warnings.append(f"Panjang/tinggi badan baduta ({cl} cm) di luar rentang wajar (40-110 cm).")
        chc = visit_data.get("child_head_circumference_cm")
        if chc is not None and not (30.0 <= float(chc) <= 60.0):
            warnings.append(f"Lingkar kepala baduta ({chc} cm) di luar rentang wajar (30-60 cm).")

    return {
        "is_plausible": len(warnings) == 0,
        "warnings": warnings,
        "checked_phase": norm_phase,
    }
