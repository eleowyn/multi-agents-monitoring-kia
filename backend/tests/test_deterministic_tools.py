import pytest
import sys
import os

# Menambahkan root folder backend ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.multiagent.tools.who_zscore import calculate_who_zscore
from app.multiagent.tools.kspr import calculate_kspr
from app.multiagent.tools.anemia import classify_maternal_anemia
from app.multiagent.tools.anthropometry_check import check_kek_lila, check_bblr_and_gestation


# ==============================================================================
# 1. PENGUJIAN DETERMINISTIK: WHO Z-SCORE (PERMENKES NO 2 TAHUN 2020)
# ==============================================================================

def test_who_zscore_normal_boy():
    """Anak laki-laki 12 bulan dengan panjang badan dan berat badan rata-rata."""
    result = calculate_who_zscore(gender="L", age_in_months=12, weight_kg=9.6, length_cm=75.7)
    
    assert result["gender"] == "L"
    assert result["age_in_months"] == 12
    assert result["indicators"]["PB_U"]["category"] == "NORMAL"
    assert result["indicators"]["PB_U"]["z_score"] == 0.0
    assert result["indicators"]["BB_U"]["category"] == "BB_NORMAL"
    assert result["indicators"]["BB_U"]["z_score"] == 0.0
    assert len(result["risk_flags"]) == 0


def test_who_zscore_stunting_detection():
    """Anak perempuan 24 bulan dengan tinggi badan pendek (Stunting: Z < -2.0)."""
    # Untuk perempuan 24 bulan: Median = 86.4, SD = 2.86. Panjang 80.0 cm -> Z = (80 - 86.4) / 2.86 = -2.24
    result = calculate_who_zscore(gender="P", age_in_months=24, length_cm=80.0)
    
    assert result["indicators"]["PB_U"]["category"] == "PENDEK"
    assert result["indicators"]["PB_U"]["z_score"] < -2.0
    assert any(flag["flag"] == "RISIKO_STUNTING" for flag in result["risk_flags"])


def test_who_zscore_severe_stunting():
    """Anak laki-laki 18 bulan dengan Z-score < -3.0 (Severely Stunted)."""
    # Untuk laki-laki 18 bulan: Median = 82.3, SD = 2.70. Panjang 72.0 cm -> Z = (72 - 82.3) / 2.70 = -3.81
    result = calculate_who_zscore(gender="L", age_in_months=18, length_cm=72.0)
    
    assert result["indicators"]["PB_U"]["category"] == "SANGAT_PENDEK"
    assert result["indicators"]["PB_U"]["z_score"] < -3.0
    assert any(flag["flag"] == "RISIKO_STUNTING_BERAT" for flag in result["risk_flags"])


def test_who_zscore_underweight_and_wasting():
    """Anak laki-laki 6 bulan dengan gizi buruk (Wasted / BB/PB Z < -3.0)."""
    # 6 bulan L: BB 5.0 kg (Median 7.9, SD 0.86), Panjang 67.6 cm
    result = calculate_who_zscore(gender="L", age_in_months=6, weight_kg=5.0, length_cm=67.6)
    
    assert result["indicators"]["BB_U"]["category"] == "BB_SANGAT_KURANG"
    assert result["indicators"]["BB_PB"]["category"] == "GIZI_BURUK"
    assert any(flag["flag"] == "RISIKO_GIZI_BURUK" for flag in result["risk_flags"])


def test_who_zscore_invalid_inputs():
    """Memastikan penanganan input tidak valid."""
    with pytest.raises(ValueError):
        calculate_who_zscore(gender="X", age_in_months=10) # Gender salah
    with pytest.raises(ValueError):
        calculate_who_zscore(gender="L", age_in_months=30) # Usia > 24 bulan


# ==============================================================================
# 2. PENGUJIAN DETERMINISTIK: SKORING KSPR (POEDJI ROCHJATI)
# ==============================================================================

def test_kspr_low_risk_krr():
    """Ibu hamil tanpa faktor risiko memiliki skor awal 2 (KRR - Hijau)."""
    result = calculate_kspr(selected_risk_keys=[], maternal_age=25, maternal_height_cm=155)
    
    assert result["total_score"] == 2
    assert result["category"] == "KRR"
    assert result["color"] == "GREEN"
    assert len(result["risk_flags"]) == 0


def test_kspr_high_risk_krt_by_age_and_height():
    """Ibu hamil usia muda (15 th) dan tinggi badan <= 145 cm (Skor: 2 + 4 + 4 = 10 -> KRT)."""
    result = calculate_kspr(maternal_age=15, maternal_height_cm=142)
    
    assert result["total_score"] == 10 # 2 (awal) + 4 (muda) + 4 (pendek)
    assert result["category"] == "KRT"
    assert result["color"] == "YELLOW"
    assert any(flag["flag"] == "RISIKO_KEHAMILAN_TINGGI_KRT" for flag in result["risk_flags"])


def test_kspr_very_high_risk_krst():
    """Ibu hamil dengan riwayat SC (skor 8) + Hipertensi (skor 4) -> Total 14 (KRST - Merah)."""
    result = calculate_kspr(
        selected_risk_keys=["riwayat_operasi_sesar"],
        systolic_bp=150,
        diastolic_bp=95
    )
    
    # 2 (awal) + 8 (SC) + 4 (Preeklampsia/Tensi tinggi) = 14
    assert result["total_score"] == 14
    assert result["category"] == "KRST"
    assert result["color"] == "RED"
    assert any(flag["flag"] == "RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST" for flag in result["risk_flags"])


# ==============================================================================
# 3. PENGUJIAN DETERMINISTIK: ANEMIA IBU HAMIL (KEMENKES / WHO)
# ==============================================================================

def test_maternal_anemia_trimester_1_normal():
    result = classify_maternal_anemia(hb_level=12.0, trimester=1)
    assert result["status"] == "NORMAL"
    assert len(result["risk_flags"]) == 0


def test_maternal_anemia_trimester_1_mild():
    result = classify_maternal_anemia(hb_level=10.2, trimester=1)
    assert result["status"] == "ANEMIA_RINGAN"
    assert any(f["flag"] == "RISIKO_ANEMIA_RINGAN" for f in result["risk_flags"])


def test_maternal_anemia_trimester_2_cutoff():
    """Trimester 2 memiliki batas normal lebih rendah (10.5 g/dL akibat hemodilusi)."""
    # Hb 10.6 pada trimester 2 adalah NORMAL
    res_t2 = classify_maternal_anemia(hb_level=10.6, trimester=2)
    assert res_t2["status"] == "NORMAL"

    # Hb 10.2 pada trimester 2 adalah ANEMIA RINGAN (9.5 - 10.4)
    res_t2_mild = classify_maternal_anemia(hb_level=10.2, trimester=2)
    assert res_t2_mild["status"] == "ANEMIA_RINGAN"


def test_maternal_anemia_severe():
    result = classify_maternal_anemia(hb_level=6.5, trimester=3)
    assert result["status"] == "ANEMIA_BERAT"
    assert any(f["flag"] == "RISIKO_ANEMIA_BERAT" for f in result["risk_flags"])


# ==============================================================================
# 4. PENGUJIAN DETERMINISTIK: LiLA KEK & BBLR / PREMATUR
# ==============================================================================

def test_lila_kek_detection():
    """LiLA < 23.5 cm mengindikasikan KEK."""
    res_kek = check_kek_lila(lila_cm=22.0)
    assert res_kek["is_kek"] is True
    assert res_kek["status"] == "KEK"
    assert any(f["flag"] == "RISIKO_KEK_MATERNAL" for f in res_kek["risk_flags"])

    res_normal = check_kek_lila(lila_cm=25.0)
    assert res_normal["is_kek"] is False
    assert res_normal["status"] == "NORMAL"
    assert len(res_normal["risk_flags"]) == 0


def test_bblr_and_preterm():
    """Bayi lahir 2100 gram usia kehamilan 35 minggu -> BBLR & Prematur."""
    result = check_bblr_and_gestation(birth_weight_gram=2100, gestational_age_weeks=35)
    
    assert result["weight_status"] == "BBLR"
    assert result["is_preterm"] is True
    assert any(f["flag"] == "RISIKO_BBLR" for f in result["risk_flags"])
    assert any(f["flag"] == "RISIKO_PREMATUR" for f in result["risk_flags"])

