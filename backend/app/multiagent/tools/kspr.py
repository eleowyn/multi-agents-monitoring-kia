from typing import List, Dict, Any, Optional

KSPR_ITEMS = {
    # Kelompok I: Ada Potensi Bahaya (Skor 4)
    "muda_hamil_1": {"label": "Terlalu muda, hamil I umur <= 16 tahun", "score": 4, "group": "I"},
    "tua_hamil_1": {"label": "Terlalu tua, hamil I umur >= 35 tahun", "score": 4, "group": "I"},
    "lambat_hamil_1": {"label": "Terlalu lambat hamil I, kawin >= 4 tahun", "score": 4, "group": "I"},
    "tua_hamil_lanjut": {"label": "Terlalu tua, umur >= 35 tahun", "score": 4, "group": "I"},
    "cepat_hamil_lagi": {"label": "Terlalu cepat hamil lagi (< 2 tahun)", "score": 4, "group": "I"},
    "lama_hamil_lagi": {"label": "Terlalu lama hamil lagi (>= 10 tahun)", "score": 4, "group": "I"},
    "banyak_anak": {"label": "Terlalu banyak anak (4 atau lebih)", "score": 4, "group": "I"},
    "tinggi_badan_rendah": {"label": "Terlalu pendek (tinggi badan <= 145 cm)", "score": 4, "group": "I"},
    "riwayat_keguguran": {"label": "Pernah gagal kehamilan (keguguran/lahir mati)", "score": 4, "group": "I"},
    "riwayat_persalinan_tindakan": {"label": "Pernah melahirkan dengan vakum/tarikan/kuret/manual plasenta", "score": 4, "group": "I"},
    "riwayat_operasi_sesar": {"label": "Pernah melahirkan dengan operasi sesar (SC)", "score": 8, "group": "I"},

    # Kelompok II: Ada Bahaya (Skor 4)
    "penyakit_anemia": {"label": "Ibu hamil kurang darah / Anemia", "score": 4, "group": "II"},
    "penyakit_malaria": {"label": "Penyakit Malaria", "score": 4, "group": "II"},
    "penyakit_tb": {"label": "Penyakit TBC Paru", "score": 4, "group": "II"},
    "penyakit_jantung": {"label": "Payah Jantung", "score": 4, "group": "II"},
    "penyakit_diabetes": {"label": "Kencing Manis / Diabetes Melitus", "score": 4, "group": "II"},
    "penyakit_menular_seksual": {"label": "Penyakit Menular Seksual (PMS/IMS)", "score": 4, "group": "II"},
    "preeklampsia_bengkak_tensi": {"label": "Bengkak pada muka/tungkai dan Tekanan Darah Tinggi", "score": 4, "group": "II"},
    "hamil_kembar": {"label": "Hamil Kembar (Gemelli)", "score": 4, "group": "II"},
    "hamil_lebih_bulan": {"label": "Hamil Lebih Bulan / Serotinus (>= 42 minggu)", "score": 4, "group": "II"},
    "kelainan_letak": {"label": "Letak Sungsang / Letak Lintang", "score": 8, "group": "II"},

    # Kelompok III: Ada Gawat Darurat (Skor 8)
    "perdarahan_antepartum": {"label": "Perdarahan sebelum bayi lahir (hamil tua)", "score": 8, "group": "III"},
    "eklampsia_kejang": {"label": "Kejang-kejang pada kehamilan / Eklampsia", "score": 8, "group": "III"}
}


def calculate_kspr(
    selected_risk_keys: Optional[List[str]] = None,
    maternal_age: Optional[int] = None,
    maternal_height_cm: Optional[float] = None,
    systolic_bp: Optional[int] = None,
    diastolic_bp: Optional[int] = None
) -> Dict[str, Any]:
    """
    Menghitung skor risiko kehamilan Kartu Skor Poedji Rochjati (KSPR)
    secara deterministik baku.
    
    Skor Awal Ibu Hamil = 2
    """
    base_score = 2
    total_score = base_score
    active_risks = []
    keys_set = set(selected_risk_keys or [])

    # Otomatisasi deteksi usia & tinggi badan jika diinput
    if maternal_age is not None:
        if maternal_age <= 16:
            keys_set.add("muda_hamil_1")
        elif maternal_age >= 35:
            keys_set.add("tua_hamil_lanjut")

    if maternal_height_cm is not None and maternal_height_cm <= 145.0:
        keys_set.add("tinggi_badan_rendah")

    if systolic_bp is not None and diastolic_bp is not None:
        if systolic_bp >= 140 or diastolic_bp >= 90:
            keys_set.add("preeklampsia_bengkak_tensi")

    for key in keys_set:
        if key in KSPR_ITEMS:
            item = KSPR_ITEMS[key]
            total_score += item["score"]
            active_risks.append({
                "key": key,
                "label": item["label"],
                "score": item["score"],
                "group": item["group"]
            })

    # Klasifikasi Kategori Risiko KSPR
    if total_score == 2:
        category = "KRR"
        category_label = "Kehamilan Risiko Rendah"
        flag = None
        color = "GREEN"
    elif 6 <= total_score <= 10:
        category = "KRT"
        category_label = "Kehamilan Risiko Tinggi"
        flag = "RISIKO_KEHAMILAN_TINGGI_KRT"
        color = "YELLOW"
    else: # total_score >= 12
        category = "KRST"
        category_label = "Kehamilan Risiko Sangat Tinggi"
        flag = "RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST"
        color = "RED"

    result = {
        "base_score": base_score,
        "total_score": total_score,
        "category": category,
        "category_label": category_label,
        "color": color,
        "active_risks": active_risks,
        "risk_flags": []
    }

    if flag:
        result["risk_flags"].append({
            "indicator": "KSPR",
            "flag": flag,
            "score": total_score,
            "detail": f"Ibu hamil memiliki Skor KSPR {total_score} ({category_label}) dengan {len(active_risks)} faktor risiko terdeteksi."
        })

    return result

