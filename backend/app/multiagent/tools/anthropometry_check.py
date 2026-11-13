from typing import Dict, Any, Optional


def check_kek_lila(lila_cm: float) -> Dict[str, Any]:
    """
    Deteksi Kekurangan Energi Kronis (KEK) pada Ibu Hamil berdasarkan Lingkar Lengan Atas (LiLA).
    Ambang batas Kemenkes RI: LiLA < 23.5 cm = KEK (Kekurangan Energi Kronis).
    """
    if lila_cm <= 10.0 or lila_cm >= 60.0:
        raise ValueError(f"Nilai LiLA {lila_cm} cm di luar rentang fisiologis masuk akal.")

    is_kek = lila_cm < 23.5
    status = "KEK" if is_kek else "NORMAL"
    status_label = "Kekurangan Energi Kronis (KEK)" if is_kek else "Normal / Non-KEK"
    
    result = {
        "lila_cm": lila_cm,
        "cutoff_cm": 23.5,
        "is_kek": is_kek,
        "status": status,
        "status_label": status_label,
        "risk_flags": []
    }

    if is_kek:
        result["risk_flags"].append({
            "indicator": "LILA_KEK",
            "flag": "RISIKO_KEK_MATERNAL",
            "lila_cm": lila_cm,
            "detail": f"Lingkar Lengan Atas (LiLA) {lila_cm} cm (< 23.5 cm) mengindikasikan ibu hamil mengalami Kekurangan Energi Kronis (KEK)."
        })

    return result


def check_bblr_and_gestation(
    birth_weight_gram: float,
    gestational_age_weeks: Optional[int] = None
) -> Dict[str, Any]:
    """
    Deteksi Berat Badan Lahir Rendah (BBLR) dan Prematuritas pada Bayi Baru Lahir.
    - BBLR: Berat Lahir < 2500 gram
    - BBLSR: Berat Lahir < 1500 gram (Sangat Rendah)
    - BBLER: Berat Lahir < 1000 gram (Ekstrem Rendah)
    - Prematur: Gestasi < 37 minggu
    """
    if birth_weight_gram <= 300 or birth_weight_gram >= 7000:
        raise ValueError(f"Berat lahir {birth_weight_gram} gram di luar rentang masuk akal.")

    risk_flags = []
    
    # Kategori BBLR
    if birth_weight_gram < 1000:
        weight_status = "BBLER"
        weight_label = "Berat Badan Lahir Ekstrem Rendah (BBLER)"
        risk_flags.append({
            "indicator": "BERAT_LAHIR",
            "flag": "RISIKO_BBLER",
            "birth_weight_gram": birth_weight_gram,
            "detail": f"Berat lahir {birth_weight_gram} gram (< 1000 g) tergolong BBLER."
        })
    elif birth_weight_gram < 1500:
        weight_status = "BBLSR"
        weight_label = "Berat Badan Lahir Sangat Rendah (BBLSR)"
        risk_flags.append({
            "indicator": "BERAT_LAHIR",
            "flag": "RISIKO_BBLSR",
            "birth_weight_gram": birth_weight_gram,
            "detail": f"Berat lahir {birth_weight_gram} gram (< 1500 g) tergolong BBLSR."
        })
    elif birth_weight_gram < 2500:
        weight_status = "BBLR"
        weight_label = "Berat Badan Lahir Rendah (BBLR)"
        risk_flags.append({
            "indicator": "BERAT_LAHIR",
            "flag": "RISIKO_BBLR",
            "birth_weight_gram": birth_weight_gram,
            "detail": f"Berat lahir {birth_weight_gram} gram (< 2500 g) tergolong BBLR (faktor risiko kuat stunting)."
        })
    elif birth_weight_gram > 4000:
        weight_status = "MAKROSOMIA"
        weight_label = "Makrosomia / Bayi Besar"
        risk_flags.append({
            "indicator": "BERAT_LAHIR",
            "flag": "RISIKO_MAKROSOMIA",
            "birth_weight_gram": birth_weight_gram,
            "detail": f"Berat lahir {birth_weight_gram} gram (> 4000 g) tergolong Makrosomia."
        })
    else:
        weight_status = "BBN"
        weight_label = "Berat Badan Lahir Normal (BBN)"

    # Cek Prematur
    is_preterm = False
    if gestational_age_weeks is not None:
        if gestational_age_weeks < 37:
            is_preterm = True
            risk_flags.append({
                "indicator": "USIA_GESTASI",
                "flag": "RISIKO_PREMATUR",
                "gestational_age_weeks": gestational_age_weeks,
                "detail": f"Lahir pada usia kehamilan {gestational_age_weeks} minggu (< 37 minggu) tergolong Prematur."
            })

    return {
        "birth_weight_gram": birth_weight_gram,
        "weight_status": weight_status,
        "weight_label": weight_label,
        "gestational_age_weeks": gestational_age_weeks,
        "is_preterm": is_preterm,
        "risk_flags": risk_flags
    }


# Batas -2 SD dan +2 SD lingkar kepala saat lahir, tabel Buku KIA 2024 (Permenkes No. 2 Tahun 2020)
HC_BIRTH_LIMITS = {"L": (32.0, 37.9), "P": (31.4, 36.3)}


def check_head_circumference(head_circ_cm: float, age_in_months: int = 0, gender: Optional[str] = None) -> Dict[str, Any]:
    """
    Evaluasi lingkar kepala saat lahir menurut tabel Buku KIA 2024 (Permenkes No. 2/2020):
    mikrosefali < -2 SD, normal -2 SD s.d. +2 SD, makrosefali > +2 SD (batas berbeda untuk laki-laki dan perempuan).
    Tanpa jenis kelamin, lingkar kepala tidak diklasifikasikan.
    """
    if head_circ_cm <= 15.0 or head_circ_cm >= 65.0:
        raise ValueError(f"Nilai lingkar kepala {head_circ_cm} cm di luar rentang fisiologis masuk akal.")

    risk_flags = []
    g = str(gender or "").upper()[:1]
    g = {"M": "L", "F": "P"}.get(g, g)
    if g not in HC_BIRTH_LIMITS:
        return {
            "head_circumference_cm": head_circ_cm,
            "status": "TIDAK_DINILAI",
            "status_label": "Tidak dinilai: jenis kelamin belum tercatat",
            "risk_flags": [],
        }
    low, high = HC_BIRTH_LIMITS[g]
    status = "NORMAL"
    label = f"Normal ({low} - {high} cm)"

    if head_circ_cm < low:
        status = "MIKROSEFALI"
        label = f"Mikrosefali (< {low} cm, < -2 SD)"
        risk_flags.append({
            "indicator": "LINGKAR_KEPALA",
            "flag": "MIKROSEFALI",
            "head_circumference_cm": head_circ_cm,
            "detail": f"Lingkar kepala saat lahir {head_circ_cm} cm (< {low} cm, di bawah -2 SD Buku KIA) mengindikasikan mikrosefali; rujuk ke tenaga kesehatan Puskesmas."
        })
    elif head_circ_cm > high:
        status = "MAKROSEFALI"
        label = f"Makrosefali (> {high} cm, > +2 SD)"
        risk_flags.append({
            "indicator": "LINGKAR_KEPALA",
            "flag": "MAKROSEFALI",
            "head_circumference_cm": head_circ_cm,
            "detail": f"Lingkar kepala saat lahir {head_circ_cm} cm (> {high} cm, di atas +2 SD Buku KIA) mengindikasikan makrosefali; rujuk ke tenaga kesehatan Puskesmas."
        })

    return {
        "head_circumference_cm": head_circ_cm,
        "status": status,
        "status_label": label,
        "risk_flags": risk_flags
    }

