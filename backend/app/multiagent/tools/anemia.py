from typing import Dict, Any


def classify_maternal_anemia(
    hb_level: float,
    trimester: int = 1
) -> Dict[str, Any]:
    """
    Klasifikasi Anemia Ibu Hamil deterministik berdasarkan ambang batas
    Kemenkes RI & WHO per Trimester kehamilan.
    """
    if hb_level <= 0 or hb_level > 25.0:
        raise ValueError(f"Kadar Hb {hb_level} g/dL di luar rentang fisiologis masuk akal.")

    if trimester not in [1, 2, 3]:
        raise ValueError("Trimester harus bernilai 1, 2, atau 3.")

    cutoff_normal = 10.5 if trimester == 2 else 11.0
    cutoff_ringan = 9.5 if trimester == 2 else 10.0

    if hb_level >= cutoff_normal:
        status = "NORMAL"
        severity_label = "Tidak Anemia"
        flag = None
    elif hb_level >= cutoff_ringan:
        status = "ANEMIA_RINGAN"
        severity_label = "Anemia Ringan"
        flag = "RISIKO_ANEMIA_RINGAN"
    elif hb_level >= 7.0:
        status = "ANEMIA_SEDANG"
        severity_label = "Anemia Sedang"
        flag = "RISIKO_ANEMIA_SEDANG"
    else:
        status = "ANEMIA_BERAT"
        severity_label = "Anemia Berat"
        flag = "RISIKO_ANEMIA_BERAT"

    result = {
        "hb_level": hb_level,
        "trimester": trimester,
        "cutoff_normal": cutoff_normal,
        "status": status,
        "severity_label": severity_label,
        "risk_flags": []
    }

    if flag:
        result["risk_flags"].append({
            "indicator": "HEMOGLOBIN",
            "flag": flag,
            "hb_level": hb_level,
            "trimester": trimester,
            "detail": f"Kadar Hb {hb_level} g/dL pada Trimester {trimester} (ambang normal {cutoff_normal} g/dL) tergolong {severity_label}."
        })

    return result

