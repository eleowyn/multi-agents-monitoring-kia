import json
import os
from typing import Dict, Any, Optional

# Path to data tables
DATA_TABLES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data_tables")
)


def _load_table(filename: str) -> Dict[str, Dict[str, float]]:
    filepath = os.path.join(DATA_TABLES_DIR, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Tabel baku WHO tidak ditemukan di {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


_lhfa_boys = _load_table("who_lhfa_boys.json")
_lhfa_girls = _load_table("who_lhfa_girls.json")
_wfa_boys = _load_table("who_wfa_boys.json")
_wfa_girls = _load_table("who_wfa_girls.json")
_wfl_boys = _load_table("who_wfl_boys.json")
_wfl_girls = _load_table("who_wfl_girls.json")


def _find_nearest_wfl(length_cm: float, table: Dict[str, Dict[str, float]]) -> Dict[str, float]:
    lengths = sorted([float(k) for k in table.keys()])
    # Clamping
    if length_cm <= lengths[0]:
        return table[str(lengths[0])]
    if length_cm >= lengths[-1]:
        return table[str(lengths[-1])]
    
    # Linear interpolation between nearest two points
    lower = max([l for l in lengths if l <= length_cm])
    upper = min([l for l in lengths if l >= length_cm])
    if lower == upper:
        return table[str(lower)]
    
    val_low = table[str(lower)]
    val_up = table[str(upper)]
    fraction = (length_cm - lower) / (upper - lower)
    
    interp_m = val_low["m"] + fraction * (val_up["m"] - val_low["m"])
    interp_sd = val_low["sd"] + fraction * (val_up["sd"] - val_low["sd"])
    return {"m": interp_m, "sd": interp_sd}


def calculate_who_zscore(
    gender: str, # "L" (Laki-laki) atau "P" (Perempuan)
    age_in_months: int,
    weight_kg: Optional[float] = None,
    length_cm: Optional[float] = None
) -> Dict[str, Any]:
    """
    Menghitung Z-score WHO linear berdasarkan Peraturan Menteri Kesehatan
    No. 2 Tahun 2020 & WHO Child Growth Standards 2006.
    
    Formula deterministik linear:
    Z = (x - mean) / sd
    """
    gender_upper = gender.upper()
    if gender_upper not in ["L", "P"]:
        raise ValueError("Gender harus 'L' (Laki-laki) atau 'P' (Perempuan)")
    
    if age_in_months < 0 or age_in_months > 24:
        raise ValueError("Usia Baduta harus antara 0 sampai 24 bulan")

    age_key = str(age_in_months)
    lhfa_table = _lhfa_boys if gender_upper == "L" else _lhfa_girls
    wfa_table = _wfa_boys if gender_upper == "L" else _wfa_girls
    wfl_table = _wfl_boys if gender_upper == "L" else _wfl_girls

    result: Dict[str, Any] = {
        "gender": gender_upper,
        "age_in_months": age_in_months,
        "indicators": {},
        "risk_flags": []
    }

    # 1. PB/U (Panjang/Tinggi Badan menurut Umur) -> Deteksi Stunting
    if length_cm is not None:
        ref_lhfa = lhfa_table.get(age_key)
        if ref_lhfa:
            z_lhfa = round((length_cm - ref_lhfa["m"]) / ref_lhfa["sd"], 2)
            if z_lhfa < -3.0:
                cat_lhfa = "SANGAT_PENDEK" # Severely Stunted
                flag_lhfa = "RISIKO_STUNTING_BERAT"
            elif z_lhfa < -2.0:
                cat_lhfa = "PENDEK" # Stunted
                flag_lhfa = "RISIKO_STUNTING"
            elif z_lhfa <= 3.0:
                cat_lhfa = "NORMAL"
                flag_lhfa = None
            else:
                cat_lhfa = "TINGGI"
                flag_lhfa = None

            result["indicators"]["PB_U"] = {
                "value_cm": length_cm,
                "median_cm": ref_lhfa["m"],
                "sd": ref_lhfa["sd"],
                "z_score": z_lhfa,
                "category": cat_lhfa
            }
            if flag_lhfa:
                result["risk_flags"].append({
                    "indicator": "PB_U",
                    "flag": flag_lhfa,
                    "z_score": z_lhfa,
                    "detail": f"Panjang/Tinggi badan {length_cm} cm pada usia {age_in_months} bulan (Z-score: {z_lhfa}) masuk kategori {cat_lhfa}."
                })

    # 2. BB/U (Berat Badan menurut Umur) -> Deteksi Underweight
    if weight_kg is not None:
        ref_wfa = wfa_table.get(age_key)
        if ref_wfa:
            z_wfa = round((weight_kg - ref_wfa["m"]) / ref_wfa["sd"], 2)
            if z_wfa < -3.0:
                cat_wfa = "BB_SANGAT_KURANG"
                flag_wfa = "RISIKO_UNDERWEIGHT_BERAT"
            elif z_wfa < -2.0:
                cat_wfa = "BB_KURANG"
                flag_wfa = "RISIKO_UNDERWEIGHT"
            elif z_wfa <= 1.0:
                cat_wfa = "BB_NORMAL"
                flag_wfa = None
            else:
                cat_wfa = "RISIKO_BB_LEBIH"
                flag_wfa = "RISIKO_OVERWEIGHT"

            result["indicators"]["BB_U"] = {
                "value_kg": weight_kg,
                "median_kg": ref_wfa["m"],
                "sd": ref_wfa["sd"],
                "z_score": z_wfa,
                "category": cat_wfa
            }
            if flag_wfa:
                result["risk_flags"].append({
                    "indicator": "BB_U",
                    "flag": flag_wfa,
                    "z_score": z_wfa,
                    "detail": f"Berat badan {weight_kg} kg pada usia {age_in_months} bulan (Z-score: {z_wfa}) masuk kategori {cat_wfa}."
                })

    # 3. BB/PB (Berat Badan menurut Panjang Badan) -> Deteksi Wasting / Malnutrisi Akut
    if weight_kg is not None and length_cm is not None:
        ref_wfl = _find_nearest_wfl(length_cm, wfl_table)
        z_wfl = round((weight_kg - ref_wfl["m"]) / ref_wfl["sd"], 2)
        if z_wfl < -3.0:
            cat_wfl = "GIZI_BURUK" # Severely Wasted
            flag_wfl = "RISIKO_GIZI_BURUK"
        elif z_wfl < -2.0:
            cat_wfl = "GIZI_KURANG" # Wasted
            flag_wfl = "RISIKO_GIZI_KURANG"
        elif z_wfl <= 1.0:
            cat_wfl = "GIZI_BAIK"
            flag_wfl = None
        elif z_wfl <= 2.0:
            cat_wfl = "BERISIKO_GIZI_LEBIH"
            flag_wfl = None
        elif z_wfl <= 3.0:
            cat_wfl = "GIZI_LEBIH"
            flag_wfl = "RISIKO_GIZI_LEBIH"
        else:
            cat_wfl = "OBESITAS"
            flag_wfl = "RISIKO_OBESITAS"

        result["indicators"]["BB_PB"] = {
            "weight_kg": weight_kg,
            "length_cm": length_cm,
            "median_kg": round(ref_wfl["m"], 2),
            "sd": round(ref_wfl["sd"], 2),
            "z_score": z_wfl,
            "category": cat_wfl
        }
        if flag_wfl:
            result["risk_flags"].append({
                "indicator": "BB_PB",
                "flag": flag_wfl,
                "z_score": z_wfl,
                "detail": f"Status gizi menurut BB/PB (Z-score: {z_wfl}) masuk kategori {cat_wfl}."
            })

    return result

