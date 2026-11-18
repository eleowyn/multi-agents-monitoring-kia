import json
import logging
import time
from datetime import datetime
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool

from app.multiagent.state import AgentState
from app.multiagent.rag.retriever import retrieve_clinical_guidelines
from app.multiagent.prompts.recommender_prompt import RECOMMENDER_REACT_SYSTEM_PROMPT
from app.multiagent.llm_utils import (
    parse_llm_json,
    get_chat_llm,
    extract_text,
    extract_token_usage,
    merge_token_usage,
    MODE_FALLBACK,
)
from app.schemas.recommendation import RecommendationItem

logger = logging.getLogger(__name__)

MODE_LLM_REACT = "LLM_REACT"
MAX_REACT_STEPS = 3


GROWTH_DEFICIT_FLAGS = {
    "RISIKO_STUNTING", "RISIKO_STUNTING_BERAT", "RISIKO_UNDERWEIGHT", "RISIKO_UNDERWEIGHT_BERAT",
    "RISIKO_GIZI_KURANG", "RISIKO_GIZI_BURUK", "BB_TIDAK_NAIK_2T",
}
OVERWEIGHT_FLAGS = {"RISIKO_GIZI_LEBIH", "RISIKO_OBESITAS", "RISIKO_OVERWEIGHT", "RISIKO_BB_LEBIH"}


# Istilah pencarian chunk per flag, memakai bahasa yang dipakai Buku KIA / PNPK (bukan nama kode flag)
FLAG_QUERY_TERMS = {
    "RISIKO_KEK_MATERNAL": "ibu hamil kurang energi kronis KEK lingkar lengan atas LiLA kurang dari 23,5 cm porsi makan ibu hamil",
    "KEK_PERSISTEN_ANTAR_KUNJUNGAN": "ibu hamil kurang energi kronis KEK lingkar lengan atas LiLA kurang dari 23,5 cm porsi makan ibu hamil",
    "RISIKO_ANEMIA_RINGAN": "ibu hamil anemia kurang darah minum tablet tambah darah TTD zat besi setiap hari",
    "RISIKO_ANEMIA_SEDANG": "ibu hamil anemia kurang darah minum tablet tambah darah TTD zat besi setiap hari",
    "RISIKO_ANEMIA_BERAT": "ibu hamil anemia berat kurang darah tablet tambah darah rujuk",
    "ANEMIA_PERSISTEN_ANTAR_KUNJUNGAN": "ibu hamil anemia kurang darah minum tablet tambah darah TTD zat besi setiap hari",
    "RISIKO_KEHAMILAN_TINGGI_KRT": "kehamilan risiko tinggi tanda bahaya kehamilan periksa ke dokter",
    "RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST": "kehamilan risiko sangat tinggi tanda bahaya kehamilan rujuk rumah sakit",
    "BB_IBU_HAMIL_TURUN": "kenaikan berat badan ibu hamil porsi makan ibu hamil",
    "RISIKO_BBLR": "bayi berat lahir rendah BBLR perawatan metode kanguru menjaga kehangatan menyusui",
    "RISIKO_BBLSR": "bayi berat lahir rendah BBLR perawatan metode kanguru rujuk",
    "RISIKO_BBLER": "bayi berat lahir rendah BBLR perawatan metode kanguru rujuk",
    "RISIKO_PREMATUR": "bayi prematur kurang bulan perawatan metode kanguru BBLR",
    "IMD_TIDAK_DILAKUKAN": "inisiasi menyusu dini IMD ASI eksklusif bayi baru lahir",
    "RISIKO_STUNTING": "anak pendek stunting panjang badan menurut umur kurang dari -2 SD rujuk puskesmas protein hewani",
    "RISIKO_STUNTING_BERAT": "anak sangat pendek stunting panjang badan menurut umur kurang dari -3 SD rujuk puskesmas",
    "RISIKO_UNDERWEIGHT": "berat badan kurang menurut umur weight faltering rujuk puskesmas makanan protein hewani",
    "RISIKO_UNDERWEIGHT_BERAT": "berat badan sangat kurang menurut umur weight faltering rujuk puskesmas",
    "RISIKO_GIZI_KURANG": "gizi kurang berat badan menurut panjang badan rujuk puskesmas makanan tambahan",
    "RISIKO_GIZI_BURUK": "gizi buruk rujuk puskesmas F75 F100 tata laksana",
    "BB_TIDAK_NAIK_2T": "berat badan tidak naik weight faltering penimbangan setiap bulan rujuk puskesmas",
    "MPASI_KURANG_ADEKUAT": "makanan pendamping ASI MPASI tekstur porsi frekuensi sesuai usia protein hewani",
    "RISIKO_GIZI_LEBIH": "berisiko gizi lebih berat badan menurut panjang badan anak",
    "RISIKO_OBESITAS": "obesitas berat badan menurut panjang badan anak",
    "RISIKO_OVERWEIGHT": "berisiko gizi lebih berat badan menurut panjang badan anak",
    "MIKROSEFALI": "lingkar kepala anak pemeriksaan perkembangan",
    "MAKROSEFALI": "lingkar kepala anak pemeriksaan perkembangan",
}


def flag_search_query(f_name: str, detail: str = "") -> str:
    terms = FLAG_QUERY_TERMS.get(f_name) or f_name.replace("_", " ").lower()
    return f"{terms} {detail}".strip()


def _pnpk_referral_lines(flag_set: set) -> List[str]:
    """Alur rujukan dari posyandu sesuai bagan pencegahan sekunder PNPK Stunting 2022."""
    lines = []
    if flag_set & {"RISIKO_GIZI_BURUK"}:
        lines.append("Gizi buruk terdeteksi: rujuk segera ke Puskesmas untuk tata laksana gizi buruk (PNPK).")
    if flag_set & {"RISIKO_STUNTING", "RISIKO_STUNTING_BERAT"}:
        lines.append("Panjang badan menurut umur < -2 SD: rujuk ke Puskesmas untuk konfirmasi stunting (PNPK).")
    if flag_set & {"RISIKO_UNDERWEIGHT", "RISIKO_UNDERWEIGHT_BERAT", "RISIKO_GIZI_KURANG", "BB_TIDAK_NAIK_2T"}:
        lines.append("Berat badan kurang atau tidak naik (weight faltering): rujuk ke Puskesmas untuk evaluasi (PNPK).")
    return lines


def build_comprehensive_care_plan(
    phase: str,
    visit_data: Optional[Dict[str, Any]] = None,
    risk_flags: Optional[List[Dict[str, Any]]] = None,
    deterministic_results: Optional[Dict[str, Any]] = None,
    maternal_history: Optional[Dict[str, Any]] = None,
    kader_feedback: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Menyusun Paket Panduan Komprehensif 1.000 HPK untuk Laporan Kader & Keluarga Pasien:
    1. Panduan Makanan / MP-ASI, Tekstur, Porsi, Bahan Lokal (Minahasa/Airmadidi) & Jadwal Menu Sehari
    2. Panduan ASI, Susu (Ibu Hamil / Susu Pertumbuhan / PKMK Medis) & Suplementasi (TTD / Vitamin A)
    3. Panduan Aktivitas Fisik, Stimulasi Tumbuh Kembang & Perawatan Harian sesuai Fase & Usia
    4. Tanda Bahaya & Indikasi Rujukan Cepat ke Puskesmas Airmadidi
    """
    v_data = visit_data or {}
    flags = [f.get("flag", "") for f in (risk_flags or []) if isinstance(f, dict)]
    det = deterministic_results or {}
    mat_hist = maternal_history or {}
    norm_phase = str(phase or v_data.get("phase") or "BADUTA").upper()
    has_egg_allergy = bool(kader_feedback and ("telur" in kader_feedback.lower() or "alergi" in kader_feedback.lower()))

    # ═════════════════════════════════════════════════════════════════════════
    # FASE 1: IBU HAMIL (HARI KE-1 S.D. 270 / TRIMESTER 1 - 3)
    # ═════════════════════════════════════════════════════════════════════════
    if norm_phase == "IBU_HAMIL":
        # Trimester dari data kunjungan; tidak ditebak bila kosong
        gest_weeks = v_data.get("gestational_age_weeks")
        trimester = v_data.get("trimester")
        if not trimester and gest_weeks:
            trimester = 1 if int(gest_weeks) <= 12 else (2 if int(gest_weeks) <= 27 else 3)
        trimester = int(trimester) if trimester else None
        tri_label = f"Trimester {trimester}" if trimester else "(trimester belum tercatat)"
        age_or_trimester_label = (
            f"Ibu Hamil {tri_label} ({gest_weeks} Minggu)" if gest_weeks else f"Ibu Hamil {tri_label}"
        )
        lila = v_data.get("lila_cm")
        hb = v_data.get("hb_level")
        is_kek = "RISIKO_KEK_MATERNAL" in flags or "RISIKO_KEK" in flags or "KEK_PERSISTEN_ANTAR_KUNJUNGAN" in flags or (lila is not None and float(lila) < 23.5)
        is_anemia = any("ANEMIA" in fl for fl in flags) or (hb is not None and float(hb) < 11.0)
        is_high_kspr = any("KSPR" in fl or "KRST" in fl or "KRT" in fl for fl in flags)

        protein_source = (
            "ikan tude/cakalang segar, hati ayam, daging ayam/sapi tanpa lemak, serta tahu dan tempe (hindari telur bila alergi)"
            if has_egg_allergy
            else "ikan tude/cakalang segar, telur ayam rebus/dadar (1-2 butir/hari), hati ayam, daging sapi/ayam, serta tahu dan tempe"
        )

        focus = [label for cond, label in ((is_kek, "Risiko KEK"), (is_anemia, "Anemia")) if cond]
        fn_title = (
            f"Panduan Makanan Ibu Hamil {tri_label}: Fokus {' & '.join(focus)}"
            if focus
            else f"Panduan Gizi Seimbang Ibu Hamil {tri_label}"
        )
        # Porsi sehari sesuai tabel "Porsi Makan dan Minum Ibu Hamil" Buku KIA 2024
        portion_t1 = "12 minggu pertama: makanan pokok 5 porsi, protein hewani 4, protein nabati 4, sayur 4, buah 4, minyak 5, gula 2 porsi per hari."
        portion_t23 = "Trimester 2 dan 3: makanan pokok 6 porsi, protein hewani 4, protein nabati 4, sayur 4, buah 4, minyak 5, gula 2 porsi per hari."
        freq_t1 = "Makan porsi lebih kecil tapi sering: 3 kali makanan utama dan 2 kali makanan selingan."
        freq_t23 = "Makan porsi lebih kecil tapi sering: 3 kali makanan utama ditambah 1-2 kali kudapan."
        if trimester == 1:
            fn_texture, fn_freq = portion_t1, freq_t1
        elif trimester in (2, 3):
            fn_texture, fn_freq = portion_t23, freq_t23
        else:
            fn_texture, fn_freq = f"{portion_t1} {portion_t23}", f"{freq_t1} Setelah 12 minggu: {freq_t23[len('Makan porsi lebih kecil tapi sering: '):]}"
        if is_kek:
            fn_freq += (
                f" LiLA {lila} cm (< 23,5 cm, risiko KEK): makan lebih banyak dan lebih sering, "
                "dan konsultasikan pemberian makanan tambahan (PMT) ibu hamil ke bidan/Puskesmas."
            )
        local_ingredients = [
            "Ikan Tude / Cakalang / Malalugis Segar",
            "Hati Ayam & Daging Tanpa Lemak",
            "Telur Ayam (1–2 butir/hari)" if not has_egg_allergy else "Tahu & Tempe Kukus/Bacem",
            "Sayur Daun Kelor, Daun Katuk & Bayam",
            "Kacang Hijau, Ubi Jalar & Alpukat",
            "Jeruk Manis, Jambu Biji & Pepaya (Sumber Vit C)",
        ]
        recommended_foods = [
            f"Sumber Protein Hewani & Zat Besi Heme: {protein_source}.",
            "Sayuran Hijau Lokal Kaya Folat & Zat Besi: Sayur daun kelor, bayam, daun katuk, kangkung, dan brokoli.",
            "Buah Kaya Vitamin C (Mempercepat Penyerapan Zat Besi 2–3x Lipat): Jeruk manis, jambu biji, pepaya, tomat, dan pisang.",
            "Sumber Karbohidrat & Lemak Sehat: Nasi putih/merah, ubi/singkong, kacang hijau, alpukat, dan santan segar matang secukupnya.",
        ]
        daily_menu = [
            {"time": "Pagi (07.00)", "waktu": "Pagi (07.00)", "menu": "Nasi hangat + ikan bakar/telur rebus + tumis sayur daun kelor + 1 gelas Susu Ibu Hamil."},
            {"time": "Selingan Pagi (10.00)", "waktu": "Selingan Pagi (10.00)", "menu": "Bubur kacang hijau santan encer + 1 buah pisang" + (" + biskuit PMT Ibu Hamil (bila diberikan bidan/Puskesmas)." if is_kek else ".")},
            {"time": "Siang (12.30)", "waktu": "Siang (12.30)", "menu": "Nasi + ikan tude/cakalang kuah kuning + tempe/tahu + sayur bening bayam + buah jeruk/pepaya."},
            {"time": "Selingan Sore (16.00)", "waktu": "Selingan Sore (16.00)", "menu": "1 gelas Susu Ibu Hamil + ubi/kentang rebus atau puding kacang hijau."},
            {"time": "Malam (19.00 & 21.00)", "waktu": "Malam (19.00 & 21.00)", "menu": "Nasi + ayam/hati ayam bumbu + sayur. Pukul 21.00 sebelum tidur: 1 tablet TTD dengan air putih/jeruk."},
        ]

        food_and_nutrition = {
            "title": fn_title,
            "headline": fn_title,
            "stage_and_texture": fn_texture,
            "texture_and_consistency": fn_texture,
            "frequency_and_portion": fn_freq,
            "local_ingredients": local_ingredients,
            "recommended_foods": recommended_foods,
            "sample_daily_menu": daily_menu,
        }

        ms_title = "Panduan Susu Ibu Hamil & Suplementasi Tablet Tambah Darah (TTD)"
        if is_anemia:
            ms_primary = (
                f"Hb {hb} g/dL menunjukkan anemia: minum TTD/MMS setiap hari tanpa terlewat dan periksakan ulang Hb ke bidan/Puskesmas. "
                "Dosis TTD saat anemia mengikuti anjuran bidan/dokter."
            )
        elif is_kek:
            ms_primary = "Susu ibu hamil 2 gelas/hari sebagai tambahan energi dan protein untuk menaikkan berat badan dan LiLA, ditambah 1 tablet TTD setiap malam."
        else:
            ms_primary = "Susu ibu hamil atau susu pasteurisasi/UHT rendah gula 1-2 gelas/hari bila tersedia, ditambah 1 tablet TTD setiap malam."
        ms_guidelines = [
            "Minum 1 Tablet Tambah Darah (TTD)/MMS setiap hari selama kehamilan, sebaiknya malam hari sebelum tidur untuk mengurangi rasa mual (Buku KIA).",
            "ATURAN JEDA 2 JAM: Jangan minum TTD bersamaan dengan susu, teh, atau kopi karena kalsium & tanin menghambat penyerapan zat besi.",
            "Minumlah Susu Ibu Hamil pada pagi/sore hari, dan minum TTD pada malam hari bersama air putih atau air jeruk manis.",
        ]
        ms_warning = (
            "Kalsium dan protein dari susu ibu hamil mendukung pembentukan tulang janin dan mencegah preeklamsia, "
            "sedangkan TTD mencegah anemia maternal yang berisiko memicu perdarahan persalinan dan bayi lahir BBLR."
        )

        ttd_val = str(v_data.get("ttd_consumption") or "").upper()
        if ttd_val in ["TIDAK_RUTIN", "BELUM_PERNAH"]:
            ms_guidelines.insert(
                0,
                "PERINGATAN KEPATUHAN TTD: Ibu tercatat belum rutin meminum Tablet Tambah Darah (TTD). Sangat penting meminum minimal 90 tablet selama kehamilan (1 tablet tiap malam sebelum tidur bersama air jeruk/air putih) untuk mencegah anemia berat dan risiko bayi lahir BBLR/Stunting."
            )

        milk_and_supplements = {
            "title": ms_title,
            "headline": ms_title,
            "recommended_type": ms_primary,
            "primary_source": ms_primary,
            "frequency_and_portion": (
                "Susu 2 gelas/hari (pagi dan sore) karena risiko KEK; TTD 1 tablet setiap malam."
                if is_kek
                else "Susu 1 gelas/hari bila tersedia; TTD 1 tablet setiap malam."
            ),
            "clinical_rationale": ms_warning,
            "medical_warning": ms_warning,
            "safety_notes": ms_guidelines,
            "guidelines": ms_guidelines,
        }

        ac_title = f"Panduan Aktivitas Fisik, Istirahat & Stimulasi Janin {tri_label}"
        ac_list = [
            "Jalan kaki santai pagi hari selama 20–30 menit (3–5 kali seminggu) untuk melancarkan sirkulasi darah dan oksigen ke plasenta.",
            (
                "Senam Hamil ringan & latihan pernapasan/relaksasi panggul (khusus Trimester 2 & 3 bila tidak ada perdarahan/kontraksi dini)."
                if not is_high_kspr
                else "Fokus pada istirahat cukup dan batasi aktivitas fisik berat karena skor KSPR menunjukkan kehamilan berisiko."
            ),
            "Stimulasi Janin Harian: Ajak janin berbicara, elus perut ibu dengan lembut, dan perdengarkan suara/musik tenang bersama suami.",
            "Perawatan Payudara & Persiapan IMD (Inisiasi Menyusu Dini) menjelang persalinan.",
        ]
        rest_sleep = (
            "Tidur malam 7–8 jam dan istirahat siang 1 jam dengan posisi miring ke kiri (meningkatkan aliran darah ke plasenta janin). "
            "Hindari mengangkat beban berat (>5 kg) dan paparan asap rokok."
        )

        activity_and_stimulation = {
            "title": ac_title,
            "headline": ac_title,
            "recommended_activities": ac_list,
            "daily_activities": ac_list,
            "rest_and_sleep": rest_sleep,
            "restrictions": [
                "Hindari mengangkat beban berat (>5 kg), membungkuk mendadak, atau berdiri terlalu lama.",
                "Hindari paparan asap rokok (perokok aktif maupun pasif) karena menghambat pertumbuhan janin (IUGR).",
            ],
        }

        danger_signs = [
            "Perdarahan dari jalan lahir (bercak maupun banyak) atau ketuban pecah dini.",
            "Bengkak pada wajah, tangan, dan kaki disertai sakit kepala hebat, pandangan kabur, atau tekanan darah >= 140/90 mmHg (Tanda Preeklamsia).",
            "Muntah terus-menerus dan tidak bisa makan/minum sama sekali, atau demam tinggi.",
            "Gerakan janin berkurang (< 10 kali dalam 12 jam pada Trimester 3).",
        ]

        return {
            "phase": "IBU_HAMIL",
            "age_or_trimester_label": age_or_trimester_label,
            "food_and_nutrition": food_and_nutrition,
            "milk_and_supplements": milk_and_supplements,
            "activity_and_stimulation": activity_and_stimulation,
            "danger_signs": danger_signs,
        }

    # ═════════════════════════════════════════════════════════════════════════
    # FASE 2: BAYI BARU LAHIR / NEONATAL (0 - 28 HARI / HARI KE-271 S.D. 298)
    # ═════════════════════════════════════════════════════════════════════════
    if norm_phase == "BAYI_BARU_LAHIR":
        bw = v_data.get("birth_weight_gram") or mat_hist.get("birth_weight_gram")
        is_bblr = any("BBLR" in fl or "PRETERM" in fl or "PREMATUR" in fl for fl in flags) or (bw is not None and float(bw) < 2500)
        age_or_trimester_label = (
            f"Bayi Baru Lahir / Neonatus 0–28 Hari (Berat Lahir {bw} g)"
            if bw
            else "Bayi Baru Lahir / Neonatus (0–28 Hari)"
        )

        fn_title = "Panduan Nutrisi Bayi Baru Lahir (ASI Eksklusif) & Gizi Ibu Menyusui"
        fn_texture = (
            "Bayi usia 0–28 hari HANYA menerima cairan ASI (Kolostrum & ASI Matang). "
            "Asupan makanan padat gizi diberikan kepada Ibu Menyusui agar produksi ASI melimpah."
        )
        fn_freq = (
            "Bayi: Menyusu on-demand 8–12 kali sehari (tiap 2 jam sekali untuk bayi BBLR). "
            "Ibu Menyusui: 3–4x makan utama tinggi protein hewani + 2x selingan + minum air putih minimal 3 liter/hari."
        )
        local_ingredients = [
            "100% ASI Eksklusif & Kolostrum (Untuk Bayi)",
            "Ikan Tude / Cakalang Kuah Kuning (Booster ASI Ibu)",
            "Sayur Bening Daun Katuk & Daun Kelor",
            "Telur Rebus, Hati Ayam & Kacang Hijau",
            "Buah Pepaya & Jeruk Manis",
        ]
        daily_menu = [
            {"time": "Setiap 2–3 Jam (Bayi)", "waktu": "Setiap 2–3 Jam (Bayi)", "menu": "Susui bayi pada kedua payudara bergantian (15–20 menit) hingga mendapat hindmilk (ASI akhir yang kaya lemak penambah berat badan)."},
            {"time": "Pagi & Siang (Ibu Menyusui)", "waktu": "Pagi & Siang (Ibu Menyusui)", "menu": "Nasi + ikan cakalang/tude + telur/tempe + sayur daun katuk/kelor + buah pepaya/jeruk."},
            {"time": "Sore & Malam (Ibu Menyusui)", "waktu": "Sore & Malam (Ibu Menyusui)", "menu": "Bubur kacang hijau / susu ibu menyusui + makan malam bergizi seimbang + air putih hangat."},
        ]

        food_and_nutrition = {
            "title": fn_title,
            "headline": fn_title,
            "stage_and_texture": fn_texture,
            "texture_and_consistency": fn_texture,
            "frequency_and_portion": fn_freq,
            "local_ingredients": local_ingredients,
            "recommended_foods": [
                "Untuk Bayi: 100% ASI Eksklusif (Kolostrum kuning kental wajib diberikan karena kaya antibodi IgA).",
                "Untuk Ibu Menyusui (Booster ASI Lokal): Ikan tude/cakalang kuah, telur rebus, hati ayam, sayur bening daun katuk & daun kelor, kacang hijau, dan buah pepaya.",
            ],
            "sample_daily_menu": daily_menu,
        }

        ms_title = "Panduan ASI Eksklusif Neonatal & Suplementasi Ibu Nifas"
        ms_primary = (
            "ASI Eksklusif penuh tanpa tambahan air putih, madu, air gula, atau susu formula "
            "(kecuali terdapat indikasi medis khusus yang diresepkan Dokter Puskesmas/RS)."
        )
        ms_guidelines = [
            "Susui setiap 2 jam sekali (bangunkan bayi bila tidur lebih dari 2–3 jam, terutama pada bayi BBLR < 2.500 g). Pastikan BAK minimal 6x/hari.",
            "DILARANG memberikan madu, air putih, teh, atau pisang kerok pada bayi baru lahir karena berisiko infeksi saluran cerna dan botulisme.",
            "Pastikan bayi telah mendapatkan injeksi Vitamin K1, salep mata antibiotik, dan imunisasi Hepatitis B-0 (HB0).",
            "Ibu nifas wajib mengonsumsi 2 kapsul Vitamin A dosis tinggi (200.000 IU): 1 kapsul segera setelah melahirkan dan 1 kapsul lagi 24 jam kemudian.",
        ]
        ms_warning = (
            "ASI mengandung faktor pertumbuhan epidermal, asam lemak AA/DHA, dan antibodi yang melindungi neonatus dari hipotermia, sepsis, dan diare."
        )

        milk_and_supplements = {
            "title": ms_title,
            "headline": ms_title,
            "recommended_type": ms_primary,
            "primary_source": ms_primary,
            "frequency_and_portion": "Menyusu 8–12 kali sehari (tiap 2 jam untuk bayi BBLR).",
            "clinical_rationale": ms_warning,
            "medical_warning": ms_warning,
            "safety_notes": ms_guidelines,
            "guidelines": ms_guidelines,
        }

        ac_title = (
            "Perawatan Metode Kanguru (PMK), Kehangatan & Stimulasi Neonatal"
            if is_bblr
            else "Perawatan Neonatal Esensial (KN1–KN3) & Stimulasi Dini Bayi Baru Lahir"
        )
        ac_list = [
            (
                "Perawatan Metode Kanguru (PMK / Skin-to-Skin Contact): Dekap bayi langsung di dada ibu/ayah (kulit ke kulit) "
                "minimal 1–2 jam per sesi atau terus-menerus untuk menjaga suhu tubuh 36,5–37,5°C dan mempercepat kenaikan berat badan BBLR."
                if is_bblr
                else "Jaga kehangatan tubuh bayi (pakaikan topi, kaos kaki, selimut bersih) dan lakukan kontak kulit-ke-kulit saat menyusui."
            ),
            "Perawatan Tali Pusat Terbuka & Kering: Biarkan tali pusat terbuka dan kering, jangan dibubuhi ramuan/bedak/alkohol; cukup bersihkan dengan air matang bila kotor.",
            "Jemur bayi di bawah sinar matahari pagi (pukul 07.00–07.30) selama 10–15 menit dengan mata terlindung.",
            "Stimulasi Sensorik & Kasih Sayang: Tatap mata bayi saat menyusui, ajak berbicara lembut, dan usap punggung bayi.",
        ]
        rest_sleep = (
            "Bayi baru lahir tidur 16–18 jam sehari dengan posisi telentang di alas rata dan bersih; bangunkan setiap 2–3 jam untuk menyusu."
        )

        activity_and_stimulation = {
            "title": ac_title,
            "headline": ac_title,
            "recommended_activities": ac_list,
            "daily_activities": ac_list,
            "rest_and_sleep": rest_sleep,
            "restrictions": [
                "Tunda memandikan bayi minimal 6 jam setelah lahir (atau sampai suhu dan berat badan stabil > 2.500 g pada bayi BBLR).",
                "Jauhkan bayi dari asap rokok, asap dapur, dan orang yang sedang batuk/pilek.",
            ],
        }

        danger_signs = [
            "Bayi tidak mau menyusu, hisapan lemah, atau memuntahkan semua yang diminum.",
            "Suhu tubuh dingin (< 36,5°C / hipotermia) atau demam tinggi (>= 37,5°C).",
            "Napas cepat (>= 60 kali/menit), tarikan dinding dada ke dalam yang kuat, atau merintih.",
            "Kulit/mata bayi tampak kuning (ikterus) dalam 24 jam pertama atau menjalar hingga telapak tangan/kaki.",
            "Tali pusat kemerahan meluas ke kulit perut, berbau busuk, atau keluar nanah/darah.",
        ]

        return {
            "phase": "BAYI_BARU_LAHIR",
            "age_or_trimester_label": age_or_trimester_label,
            "food_and_nutrition": food_and_nutrition,
            "milk_and_supplements": milk_and_supplements,
            "activity_and_stimulation": activity_and_stimulation,
            "danger_signs": danger_signs,
        }

    # ═════════════════════════════════════════════════════════════════════════
    # FASE 3: BADUTA (USIA 1 - 24 BULAN / HARI KE-299 S.D. 1.000)
    # ═════════════════════════════════════════════════════════════════════════
    raw_age = v_data.get("age_in_months") if v_data.get("age_in_months") is not None else det.get("age_in_months")
    if raw_age is None:
        # Tanpa umur, tekstur/porsi/frekuensi MP-ASI tidak dapat ditentukan (tidak ditebak)
        note = "Usia anak belum tercatat. Tekstur, porsi, dan frekuensi MP-ASI bergantung usia (Buku KIA); lengkapi tanggal lahir anak."
        return {
            "phase": "BADUTA",
            "age_or_trimester_label": "Anak Baduta (usia belum tercatat)",
            "food_and_nutrition": {"title": "Panduan MP-ASI belum dapat disusun", "headline": "Panduan MP-ASI belum dapat disusun", "stage_and_texture": note, "texture_and_consistency": note},
            "milk_and_supplements": {},
            "activity_and_stimulation": {},
            "danger_signs": [],
        }
    age_months = int(raw_age)
    age_or_trimester_label = f"Anak Baduta Usia {age_months} Bulan"
    flag_set = set(flags)
    # Hanya masalah pertumbuhan anak saat ini; riwayat ibu KEK/BBLR tidak dihitung sebagai gagal tumbuh
    growth_deficit = flag_set & GROWTH_DEFICIT_FLAGS
    has_growth_risk = bool(growth_deficit)
    has_overweight = bool(flag_set & OVERWEIGHT_FLAGS)
    referral_lines = _pnpk_referral_lines(flag_set)

    if age_months < 6:
        fn_title = f"Panduan ASI Eksklusif (Usia {age_months} Bulan) & Gizi Ibu Menyusui"
        fn_texture = "Usia < 6 Bulan: Belum diberikan MP-ASI padat. Seluruh kebutuhan nutrisi bayi dipenuhi dari ASI Eksklusif."
        fn_freq = "Susui 8–12 kali sehari semalam sesuai keinginan bayi (on-demand) hingga payudara terasa kosong."
        local_ingredients = [
            "100% ASI Eksklusif untuk Bayi (Tanpa MP-ASI Dini)",
            "Ikan Tude / Cakalang & Telur Ayam (Untuk Ibu Menyusui)",
            "Sayur Daun Katuk & Daun Kelor (Pelancar ASI)",
            "Kacang Hijau, Tahu, Tempe & Buah Segar",
        ]
        daily_menu = [
            {"time": "Sepanjang Hari (Bayi)", "waktu": "Sepanjang Hari (Bayi)", "menu": "ASI Eksklusif setiap 2–3 jam (pagi, siang, sore, dan malam hari) tanpa tambahan air/makanan lain."},
            {"time": "Menu Ibu Menyusui", "waktu": "Menu Ibu Menyusui", "menu": "3x makan utama tinggi protein hewani (ikan tude/cakalang, telur, hati ayam) + 2x selingan + 12–14 gelas air putih."},
        ]
        food_and_nutrition = {
            "title": fn_title,
            "headline": fn_title,
            "stage_and_texture": fn_texture,
            "texture_and_consistency": fn_texture,
            "frequency_and_portion": fn_freq,
            "local_ingredients": local_ingredients,
            "recommended_foods": [
                "Bayi (1–5 Bulan): HANYA ASI Eksklusif tanpa air putih, pisang, bubur, atau susu formula.",
                "Ibu Menyusui: Konsumsi 2 porsi lauk protein hewani setiap makan (ikan tude/cakalang, telur, ayam/hati ayam) + sayur daun katuk/kelor agar kandungan lemak dan protein ASI tinggi.",
            ],
            "sample_daily_menu": daily_menu,
        }

        ms_title = "Panduan Pemberian ASI Eksklusif Optimal (Usia 1–5 Bulan)"
        ms_primary = "ASI Eksklusif 100% (Fore-milk pelepas dahaga & Hind-milk kental di akhir sesi menyusu untuk menaikkan berat badan bayi)."
        ms_guidelines = [
            "Susui minimal 8–12 kali dalam 24 jam dengan durasi 15–20 menit per payudara hingga payudara terasa lunak/kosong.",
            "Jangan memberikan MP-ASI dini sebelum usia genap 6 bulan karena enzim pencernaan belum matang dan memicu diare.",
            "Bila grafik BB pada KMS mendatar/tidak naik (T), perbaiki posisi & pelekatan menyusui serta rujuk ke Konselor ASI Puskesmas Airmadidi.",
            *referral_lines,
        ]
        ms_warning = (
            "Enzim pencernaan amilase dan lipase bayi usia < 6 bulan belum matang sempurna untuk mencerna makanan padat. "
            "Kenaikan berat badan minimal (KBM) harus dipantau setiap bulan pada grafik KMS Buku KIA."
        )
        milk_and_supplements = {
            "title": ms_title,
            "headline": ms_title,
            "recommended_type": ms_primary,
            "primary_source": ms_primary,
            "frequency_and_portion": "Minimal 8–12 kali dalam 24 jam, durasi 15–20 menit per payudara.",
            "clinical_rationale": ms_warning,
            "medical_warning": ms_warning,
            "safety_notes": ms_guidelines,
            "guidelines": ms_guidelines,
        }
    else:
        if age_months <= 8:
            stage_str = "Usia 6–8 Bulan: Bubur saring kental (puree/mashed) yang tidak mudah jatuh saat sendok dimiringkan."
            freq_str = "2–3x makan utama MP-ASI + 1–2x selingan padat gizi + ASI dilanjutkan. Porsi: bertahap dari 2–3 sdm hingga 1/2 mangkuk ukuran 250 mL (125 mL) per kali makan. Energi dari MP-ASI 200 kkal/hari."
        elif age_months <= 11:
            stage_str = "Usia 9–11 Bulan: Makanan cincang halus/kasar (minced/chopped) dan finger food yang mudah digenggam anak."
            freq_str = "3–4x makan utama MP-ASI + 1–2x selingan tinggi protein + ASI. Porsi: 1/2 sampai 3/4 mangkuk ukuran 250 mL (125–200 mL) per kali makan. Energi dari MP-ASI 300 kkal/hari."
        elif age_months >= 24:
            stage_str = "Usia 24 Bulan (Milestone Hari ke-1.000): Makanan keluarga balita 2–5 tahun utuh padat gizi (Isi Piringku Balita)."
            freq_str = "3x makan utama keluarga + 2x selingan padat gizi + proses menyapih bertahap (weaning with love). Porsi: 1 mangkuk penuh ukuran 250 mL."
        else:
            stage_str = "Usia 12–23 Bulan: Makanan keluarga yang diiris/dihaluskan seperlunya (tekstur lunak-padat)."
            freq_str = "3–4x makan utama keluarga + 1–2x selingan + ASI hingga 2 tahun. Porsi: 3/4 sampai 1 mangkuk penuh ukuran 250 mL. Energi dari MP-ASI 550 kkal/hari."

        protein_rec = (
            "Wajib Protein Hewani Non-Telur Setiap Makan: Ikan tude/cakalang segar (bebas duri), hati ayam, daging ayam/sapi cincang halus (minimal 2 jenis protein hewani sehari)."
            if has_egg_allergy
            else "Wajib Protein Hewani Ganda Setiap Hari: 1 butir telur ayam/puyuh + ikan tude/cakalang segar (bebas duri), hati ayam, atau daging ayam/sapi cincang."
        )

        if has_growth_risk:
            fn_title = f"Panduan MP-ASI Kejar Tumbuh Tinggi Protein Hewani (Usia {age_months} Bulan)"
        elif has_overweight:
            fn_title = f"Panduan MP-ASI Gizi Seimbang, Gizi Lebih Terdeteksi (Usia {age_months} Bulan)"
        else:
            fn_title = f"Panduan MP-ASI Adekuat Kaya Protein Hewani (Usia {age_months} Bulan)"
        if has_growth_risk:
            fat_line = "Tambahan lemak di tiap porsi MP-ASI untuk mengejar berat badan: 1 sendok teh minyak kelapa, santan matang, atau mentega."
        elif has_overweight:
            fat_line = (
                "Gizi lebih terdeteksi: jangan menambah porsi atau lemak tambahan. Dokumen rujukan tidak memuat anjuran gizi "
                "khusus gizi lebih, konsultasikan ke tenaga kesehatan Puskesmas."
            )
        else:
            fat_line = "Lemak secukupnya dari pengolahan makanan: 1 sendok teh minyak kelapa atau santan matang per porsi."
        local_ingredients = [
            "Ikan Tude / Cakalang / Mujair Segar (Bebas Duri)",
            "Hati Ayam & Daging Ayam/Sapi Cincang",
            "Telur Ayam / Telur Puyuh" if not has_egg_allergy else "Tahu & Tempe Lembut",
            "1 sdt Minyak Kelapa / Santan Matang / Mentega (Lemak Tambahan)",
            "Sayur Daun Kelor Muda, Bayam, Wortel & Labu Kuning",
            "Alpukat, Pisang & Pepaya Matang",
        ]
        daily_menu = [
            {"time": "Pagi (07.30)", "waktu": "Pagi (07.30)", "menu": "Bubur/Nasi Tim Hati Ayam & Telur (atau Daging Ayam) + wortel + 1 sdt minyak kelapa/mentega."},
            {"time": "Selingan Pagi (10.00)", "waktu": "Selingan Pagi (10.00)", "menu": "Puree alpukat / pisang + biskuit/puding susu padat gizi + ASI."},
            {"time": "Siang (12.30)", "waktu": "Siang (12.30)", "menu": "Bubur/Nasi Tim Ikan Cakalang/Tude kuah kuning (tanpa duri) + tahu lembut + daun kelor muda + santan/minyak."},
            {"time": "Selingan Sore (15.30)", "waktu": "Selingan Sore (15.30)", "menu": "Perkedel kentang daging/ikan kukus lembut atau puding telur-susu + ASI/Susu sesuai anjuran."},
            {"time": "Malam (18.30)", "waktu": "Malam (18.30)", "menu": "Bubur/Nasi Tim Daging Ayam/Ikan + labu kuning + 1 sdt lemak tambahan + ASI sebelum tidur."},
        ]

        food_and_nutrition = {
            "title": fn_title,
            "headline": fn_title,
            "stage_and_texture": stage_str,
            "texture_and_consistency": stage_str,
            "frequency_and_portion": freq_str,
            "local_ingredients": local_ingredients,
            "recommended_foods": [
                protein_rec,
                fat_line,
                "Sumber Karbohidrat Padat Energi: Beras putih/merah, kentang, atau ubi jalar.",
                "Sayur & Buah (Porsi Kecil Sebagai Pengenalan, Jangan Sampai Menggantikan Porsi Protein): Wortel, bayam, daun kelor muda, labu kuning, alpukat, pisang, pepaya.",
            ],
            "sample_daily_menu": daily_menu,
        }

        is_graduation_milestone = (age_months >= 24) or bool(det.get("hpk_status", {}).get("is_graduation_milestone"))
        if is_graduation_milestone:
            ms_title = (
                "Panduan Menyapih Penuh Kasih & Rujukan Susu PKMK Medis (Milestone Hari ke-1.000)"
                if has_growth_risk
                else "Panduan Menyapih Penuh Kasih (Weaning with Love) & Susu Keluarga (Milestone Hari ke-1.000)"
            )
            ms_primary = (
                "Proses Menyapih Bertahap (Weaning with Love) + Rujukan Dokter Spesialis Anak Puskesmas/RSUD Maria Walanda Maramis untuk Evaluasi Susu PKMK Padat Kalori."
                if has_growth_risk
                else "Proses Menyapih Penuh Kasih (Weaning with Love) Bertahap ke Makanan Keluarga + Susu UHT Plain / Susu Pertumbuhan Maksimal 300–400 mL/hari (Bukan Pengganti Makanan)."
            )
            ms_guidelines = [
                "Terapkan prinsip Weaning with Love: Menyapih secara perlahan dan bertahap dengan kasih sayang, DILARANG menggunakan zat pahit, pedas, jamu, atau menempelkan plester pada payudara ibu.",
                "Gantikan sesi menyusu dengan pelukan hangat, interaksi membacakan buku cerita, dan pemberian air putih/susu dengan cangkir atau gelas terbuka (hindari botol dot untuk mencegah maloklusi gigi).",
                *(referral_lines or ["Pastikan anak tetap mendapat Kapsul Vitamin A di Posyandu setiap Februari & Agustus hingga usia 5 tahun."]),
                "Protokol Kemenkes RI & WHO Code: ASI Standar Emas Mutlak Awal Kehidupan. Susu Formula Khusus / PKMK HANYA diresepkan Dokter untuk indikasi medis gagal tumbuh.",
                "DILARANG KERAS memberikan Susu Kental Manis (SKM) kepada baduta/balita karena tinggi gula (>=50%) dan miskin zat gizi pembangun tubuh.",
            ]
        else:
            ms_title = (
                "Panduan ASI Lanjutan, Evaluasi Susu PKMK Medis & Suplementasi Baduta"
                if has_growth_risk
                else "Panduan ASI Lanjutan, Susu Pelengkap & Vitamin A Baduta"
            )
            ms_primary = (
                "ASI lanjutan hingga 24 bulan. Rujuk ke Puskesmas sesuai alur PNPK; PKMK atau PMT pemulihan hanya diberikan setelah evaluasi tenaga kesehatan."
                if has_growth_risk
                else "ASI lanjutan hingga usia 24 bulan + Kapsul Vitamin A (Februari & Agustus)"
                + (" + susu UHT plain bila diinginkan (maks. 300–400 mL/hari)." if age_months > 12 else ".")
            )
            ms_guidelines = [
                "Lanjutkan pemberian ASI sesuai keinginan anak hingga usia 24 bulan (berikan di sela waktu makan agar anak tetap lahap makan MP-ASI utama).",
                *(referral_lines or ["Pastikan anak mendapat Kapsul Vitamin A di Posyandu setiap Februari & Agustus (Biru 100.000 IU usia 6–11 bln; Merah 200.000 IU usia 12–24 bln)."]),
                "Protokol Kemenkes RI & WHO Code: ASI adalah standar emas mutlak nutrisi bayi. Susu PKMK hanya atas resep dokter bila ada indikasi gagal tumbuh.",
                "DILARANG KERAS memberikan Susu Kental Manis (SKM) kepada bayi/balita karena tinggi gula dan miskin protein.",
                "Jangan memberikan susu melebihi 500 mL/hari pada anak >1 tahun agar anak tidak kenyang cairan dan tetap lahap makan lauk protein hewani.",
            ]
        ms_warning = (
            "Pada usia 6–24 bulan, kombinasi MP-ASI kaya protein hewani dan dukungan nutrisi cair (ASI / Susu PKMK medis dengan pengawasan Dokter Puskesmas bagi anak gagal tumbuh) "
            "sangat krusial untuk memperbaiki pertumbuhan linier sebelum 1.000 HPK berakhir."
        )

        milk_and_supplements = {
            "title": ms_title,
            "headline": ms_title,
            "recommended_type": ms_primary,
            "primary_source": ms_primary,
            "frequency_and_portion": (
                "ASI sesuai keinginan anak; PKMK hanya bila diresepkan dokter setelah rujukan."
                if has_growth_risk
                else "ASI sesuai keinginan anak + Kapsul Vitamin A setiap Februari & Agustus di Posyandu."
            ),
            "clinical_rationale": ms_warning,
            "medical_warning": ms_warning,
            "safety_notes": ms_guidelines,
            "guidelines": ms_guidelines,
        }

    # Aktivitas & Stimulasi Tumbuh Kembang sesuai Kelompok Usia Baduta (Buku KIA)
    if age_months <= 3:
        stim_list = [
            "Latihan Tummy Time (Tengkurap Aktif) 3–5 menit beberapa kali sehari saat bayi terjaga untuk menguatkan otot leher dan bahu.",
            "Gantung benda berwarna cerah/berbunyi di atas bayi agar mata bayi mengikuti gerak benda ke kanan-kiri.",
            "Sering ajak bayi tersenyum, mengoceh, dan berbicara lembut sambil menatap matanya.",
            "Peluk, belai, dan penuhi kebutuhan menyusu segera saat bayi menangis.",
        ]
    elif age_months <= 6:
        stim_list = [
            "Stimulasi berguling bolak-balik (telentang ke tengkurap) di alas yang datar dan aman.",
            "Latih bayi meraih, memegang, dan menggoyangkan mainan bersih dengan kedua tangannya.",
            "Tirukan suara ocehan bayi (ba-ba, ma-ma) dan panggil namanya dari berbagai arah.",
            "Latih bayi menyangga dada dan kepala tegak saat posisi tengkurap atau digendong.",
        ]
    elif age_months <= 9:
        stim_list = [
            "Stimulasi duduk mandiri tanpa pegangan dan latihan merangkak meraih mainan di depannya.",
            "Latih motorik halus: memindahkan benda dari satu tangan ke tangan lain dan mengambil potongan finger food (pincer grasp).",
            "Bermain cilukba, tepuk tangan, dan sebutkan nama-nama anggota keluarga/benda di sekitar anak.",
            "Biasakan cuci tangan pakai sabun sebelum makan dan setelah bermain di lantai.",
        ]
    elif age_months <= 12:
        stim_list = [
            "Stimulasi berdiri berpegangan pada perabot yang kokoh dan latihan melangkah sambil ditatih kedua tangannya.",
            "Latih anak memasukkan benda ke dalam wadah, menunjuk benda yang diinginkan, dan melambaikan tangan (da-dah).",
            "Ajak anak berbicara dengan kata-kata pendek yang jelas (mama, papa, minum, makan) dan bacakan buku bergambar.",
            "Libatkan anak makan bersama keluarga di meja makan (responsive feeding tanpa paksaan/tanpa gawai).",
        ]
    elif age_months <= 18:
        stim_list = [
            "Stimulasi berjalan mandiri tanpa berpegangan, berjongkok lalu berdiri kembali, dan menggelindingkan/menendang bola.",
            "Latih motorik halus & kemandirian: menyusun 2–4 kubus/balok, mencoret-coret kertas dengan krayon, serta belajar memegang sendok dan gelas sendiri.",
            "Perkaya kosakata anak dengan menunjuk bagian tubuh (mata, hidung, tangan) dan menyanyikan lagu anak-anak.",
            "Bermain aktif di luar ruangan pagi hari minimal 30–60 menit untuk paparan Vitamin D alami.",
        ]
    else:
        stim_list = [
            "Stimulasi berlari kecil dengan seimbang, naik-turun tangga dengan berpegangan, dan melompat di tempat.",
            "Latih menyusun 4–6 balok, membuka halaman buku cerita, serta merangkai kalimat 2–3 kata ('mau makan ikan', 'minum air').",
            "Latih kemandirian harian: makan sendiri dengan sendok, mencuci & mengeringkan tangan, serta mulai pengenalan toilet training.",
            "Bermain fisik aktif di luar ruang minimal 60 menit/hari dan batasi total waktu duduk diam.",
        ]

    ac_title = f"Panduan Aktivitas Fisik, Stimulasi Tumbuh Kembang & Tidur (Usia {age_months} Bulan)"
    rest_sleep = (
        "Pastikan anak tidur berkualitas 11–14 jam sehari (tidur malam 10–11 jam + tidur siang 1–3 jam) karena hormon pertumbuhan (Growth Hormone) bekerja maksimal saat anak tidur nyenyak di malam hari. Hindari layar HP/TV (zero screen time untuk anak < 2 tahun)."
    )

    activity_and_stimulation = {
        "title": ac_title,
        "headline": ac_title,
        "recommended_activities": stim_list,
        "daily_activities": stim_list,
        "rest_and_sleep": rest_sleep,
        "restrictions": [
            *(["PERINGATAN IMUNISASI KEJAR (CATCH-UP): Status imunisasi dasar anak belum lengkap. Segera kunjungi Posyandu atau Puskesmas Airmadidi untuk melengkapi vaksin yang tertunda guna melindungi anak dari komplikasi infeksi dan gagal tumbuh."] if str(v_data.get("immunization_status") or "").upper() in ["BELUM_LENGKAP", "TIDAK_IMUNISASI"] else []),
            "Hindari penggunaan layar gawai/HP/TV (screen time) saat anak makan maupun pada anak usia di bawah 2 tahun sesuai pedoman IDAI & Buku KIA.",
            "Pastikan lantai/area bermain bersih, bebas benda tajam/kecil yang berisiko tertelan, dan bebas asap rokok.",
        ],
    }

    danger_signs = [
        "Berat badan tidak naik 2 bulan berturut-turut (2T) atau berada di Bawah Garis Merah (BGM) pada KMS.",
        "Anak tampak sangat kurus, pucat, lemas/kurang aktif, atau bengkak pada kedua punggung kaki.",
        "Diare cair >3x sehari (terutama bila disertai mata cekung/dehidrasi), muntah berulang, atau demam tinggi >2 hari.",
        "Batuk disertai napas cepat atau tarikan dinding dada bagian bawah ke dalam.",
        "Keterlambatan perkembangan (belum bisa duduk di usia >9 bulan atau belum bisa berjalan di usia >18 bulan).",
    ]

    graduation_package = None
    if norm_phase == "BADUTA" and (age_months >= 24 or det.get("hpk_status", {}).get("is_graduation_milestone")):
        graduation_package = {
            "is_graduation": True,
            "milestone_day": 1000,
            "milestone_age_months": age_months,
            "title": "Paket Transisi Kelulusan 1.000 HPK (Milestone Usia 24 Bulan)",
            "graduation_status": "PERHATIAN_KHUSUS_STUNTING" if has_growth_risk else "LULUS_OPTIMAL_BEBAS_STUNTING",
            "status_badge": "⚠️ Perhatian Khusus: Terdeteksi Risiko Pertumbuhan / Stunting" if has_growth_risk else "🎓 Lulus Optimal: Pertumbuhan Normal Bebas Stunting",
            "status_type": "ALERT" if has_growth_risk else "OPTIMAL",
            "exit_assessment": (
                "Hasil Evaluasi Akhir 1.000 HPK: Anak terdeteksi memiliki risiko perlambatan pertumbuhan/stunting saat mencapai akhir periode emas 1.000 HPK. "
                "Karena jendela kritis plastisitas otak 80% telah mendekati penutupan di usia 24 bulan, anak memerlukan intervensi terintegrasi Dokter Spesialis Anak (Sp.A) "
                "di RSUD Maria Walanda Maramis / Puskesmas Airmadidi untuk terapi kejar tumbuh (catch-up growth) terarah."
                if has_growth_risk else
                "Hasil Evaluasi Akhir 1.000 HPK: Selamat! Anak berhasil menuntaskan seluruh 1.000 Hari Pertama Kehidupan (270 hari masa kandungan + 730 hari masa baduta) "
                "dengan kurva pertumbuhan dalam batas normal. Pertumbuhan otak 80% telah terbentuk optimal dan anak terlindungi dari risiko stunting kronis."
            ),
            "weaning_guidance": {
                "title": "Panduan Menyapih Penuh Kasih (Weaning with Love)",
                "principles": [
                    "Menyapih secara bertahap dan penuh empati (Weaning with Love) tanpa paksaan atau penghentian mendadak.",
                    "DILARANG KERAS mengoleskan zat pahit (brotowali), pedas, jamu, atau menempelkan plester pada payudara ibu karena memicu trauma emosional pada anak.",
                    "Alihkan kebiasaan menyusu dengan pelukan hangat, membacakan buku cerita, dan menawarkan air putih/susu dengan cangkir atau gelas terbuka (bukan botol dot).",
                    "Pastikan kebutuhan gizi harian anak telah terpenuhi seimbang dari 3 kali makan utama keluarga + 2 kali selingan padat protein hewani.",
                ],
            },
            "toddler_nutrition_transition": {
                "title": "Transisi Makanan Balita Usia 2–5 Tahun (Isi Piringku Balita)",
                "principles": [
                    "Berikan makanan keluarga utuh: 3x makan utama seimbang (1/3 karbohidrat, 1/3 protein hewani/nabati, 1/3 sayur & buah) + 2x selingan padat gizi.",
                    "Wajib protein hewani ganda lokal Minahasa Utara setiap hari: 1 butir telur + ikan tude/cakalang segar (bebas duri) atau daging ayam/hati ayam.",
                    "Susu cair UHT plain atau susu pertumbuhan terfortifikasi cukup sebagai pelengkap (maksimal 300–400 mL/hari agar anak tidak kenyang cairan dan tetap lahap makan nasi/lauk).",
                    "Ajak anak makan bersama keluarga di meja makan (responsive feeding) dan hindari penggunaan gawai (screen time) saat makan.",
                ],
            },
            "kpsp_24_months": {
                "title": "Skrining Perkembangan KPSP Usia 24 Bulan",
                "milestones": [
                    "Motorik Kasar: Mampu melompat dengan kedua kaki terangkat, menaiki tangga dengan berpegangan, dan menendang bola.",
                    "Motorik Halus: Mampu menyusun menara dari 4–6 balok kayu, membuka tutup wadah/botol, dan mencoret-coret garis di kertas.",
                    "Bicara & Bahasa: Mampu merangkai kalimat dari minimal 2 kata bermakna (misal: 'mau makan ikan', 'mama pulang', 'minum air') dan menunjuk gambar benda yang disebutkan.",
                    "Sosialisasi & Kemandirian: Mampu melepas pakaian sederhana sendiri, makan dengan sendok tanpa banyak tumpah, dan mulai pengenalan toilet training.",
                ],
            },
            "medical_compliance": {
                "badge": "Protokol Kemenkes RI & WHO Code: ASI Standar Emas Mutlak • PKMK Khusus Resep Dokter",
                "principles": [
                    "ASI adalah standar emas mutlak nutrisi awal kehidupan (0–24 bulan).",
                    "Susu Formula Terapi / PKMK (Pangan Olahan untuk Keperluan Medis Khusus ±0,9–1,0 kkal/mL) HANYA boleh diresepkan oleh Dokter Puskesmas/Sp.A atas indikasi medis kegagalan tumbuh (Growth Faltering / Stunting).",
                    "DILARANG KERAS memberikan Susu Kental Manis (SKM) kepada baduta/balita karena tinggi gula (>=50%) dan miskin zat gizi mikro pembangun tubuh.",
                ],
            },
        }

    res = {
        "phase": norm_phase,
        "age_or_trimester_label": age_or_trimester_label,
        "food_and_nutrition": food_and_nutrition,
        "milk_and_supplements": milk_and_supplements,
        "activity_and_stimulation": activity_and_stimulation,
        "danger_signs": danger_signs,
    }
    if graduation_package:
        res["graduation_package"] = graduation_package
    return res


EVIDENCE_CHUNK = "CHUNK_DOKUMEN"
EVIDENCE_CURATED = "RINGKASAN_TERKURASI"
EVIDENCE_NONE = "TANPA_KUTIPAN"
EVIDENCE_RULE = "ATURAN_SISTEM"


def citation_from_chunk(
    chunk: Optional[Dict[str, Any]],
    supporting_chunks: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Sitasi diambil apa adanya dari metadata chunk ChromaDB beserta seluruh chunk pendukung yang relevan."""
    if not chunk:
        return {
            "source": None,
            "section": None,
            "page": None,
            "chunk_id": None,
            "origin": None,
            "derived_from": None,
            "additional_pages": None,
            "additional_sections": None,
            "supporting_chunk_ids": None,
            "supporting_chunks": None,
        }
    sup_list = [c for c in (supporting_chunks or [chunk]) if c and c.get("id")]
    if not sup_list:
        sup_list = [chunk]

    pages: List[str] = []
    sections: List[str] = []
    chunk_ids: List[str] = []
    sup_meta: List[Dict[str, Any]] = []
    for sc in sup_list:
        cid = sc.get("id")
        if cid and cid not in chunk_ids:
            chunk_ids.append(cid)
        pg = sc.get("page")
        if pg is not None and str(pg).strip() and str(pg).strip() not in pages:
            pages.append(str(pg).strip())
        sec = sc.get("section")
        if sec and str(sec).strip() and str(sec).strip() not in sections:
            sections.append(str(sec).strip())
        sup_meta.append({
            "chunk_id": cid,
            "source": sc.get("source"),
            "section": sc.get("section"),
            "page": sc.get("page"),
            "origin": sc.get("origin"),
            "derived_from": sc.get("derived_from"),
            "content": sc.get("content"),
        })

    return {
        "source": chunk.get("source"),
        "section": chunk.get("section"),
        "page": chunk.get("page"),
        "chunk_id": chunk.get("id"),
        "origin": chunk.get("origin"),
        "derived_from": chunk.get("derived_from"),
        "additional_pages": pages if len(pages) > 1 else None,
        "additional_sections": sections if len(sections) > 1 else None,
        "supporting_chunk_ids": chunk_ids if len(chunk_ids) > 1 else None,
        "supporting_chunks": sup_meta if len(sup_meta) >= 1 else None,
    }


def _extract_verbatim_supporting_sentence(
    chunk_content: str,
    candidate_sentence: Optional[str],
    rec_context: str = "",
) -> str:
    """
    Mengambil kalimat pendukung APA ADANYA (verbatim substring) dari teks chunk.
    - Jika chunk pendek (<= 160 karakter), kembalikan isi chunk utuh.
    - Jika LLM menunjuk supporting_sentence yang benar-benar ada di dalam chunk,
      ambil substring verbatim tersebut dari chunk.
    - Jika tidak ada atau tidak cocok, pilih 1-2 kalimat berturut-turut di dalam chunk
      yang paling relevan secara leksikal dengan isi rekomendasi.
    """
    import re as _re
    raw_doc = (chunk_content or "").strip()
    if not raw_doc:
        return ""
    if len(raw_doc) <= 160:
        if candidate_sentence and len(candidate_sentence.strip()) >= 15 and candidate_sentence.strip() in raw_doc:
            return candidate_sentence.strip()
        return raw_doc

    if candidate_sentence:
        cand = candidate_sentence.strip().strip('"\'')
        if len(cand) >= 20:
            if cand in raw_doc:
                return cand
            # Cek kecocokan dengan normalisasi spasi/baris baru namun tetap ambil slice asli dari raw_doc
            pattern = _re.escape(cand)
            pattern = _re.sub(r"(\\\s)+", r"\\s+", pattern)
            m = _re.search(pattern, raw_doc, flags=_re.IGNORECASE)
            if m:
                return raw_doc[m.start():m.end()].strip()

    # Pecah chunk menjadi kalimat tanpa mengubah teks aslinya
    spans = []
    for m in _re.finditer(r"[^.!?\n]+(?:[.!?]+|\n|$)", raw_doc):
        seg = m.group(0).strip()
        if len(seg) >= 20:
            spans.append((m.start(), m.end(), seg))
    if not spans:
        return raw_doc

    words_fn = lambda t: {w for w in _re.findall(r"[a-zA-Z]{4,}", (t or "").lower())}
    ctx_words = words_fn(rec_context)
    if not ctx_words:
        first_end = spans[min(1, len(spans) - 1)][1]
        return raw_doc[spans[0][0]:first_end].strip()

    best_score = -1.0
    best_slice = raw_doc[spans[0][0]:spans[min(1, len(spans) - 1)][1]].strip()
    for i in range(len(spans)):
        # Uji 1 kalimat atau 2 kalimat berurutan (maks ~320 karakter)
        for j in (i, min(i + 1, len(spans) - 1)):
            s_start, s_end = spans[i][0], spans[j][1]
            sub = raw_doc[s_start:s_end].strip()
            if len(sub) > 360 and j > i:
                continue
            w = words_fn(sub)
            overlap = len(w & ctx_words) / max(1, len(ctx_words))
            if overlap > best_score:
                best_score = overlap
                best_slice = sub
    return best_slice


def _format_citation_short(cit: Optional[Dict[str, Any]]) -> Optional[str]:
    if not isinstance(cit, dict) or not cit.get("source"):
        return None
    src = str(cit.get("source") or "").strip()
    page = cit.get("page")
    sec = cit.get("section")
    parts = [src]
    if sec and str(sec).strip() and str(sec).strip() != "-":
        parts.append(str(sec).strip())
    if page and str(page).strip() and str(page).strip() != "-":
        parts.append(f"Halaman PDF {page}")
    return ", ".join(parts)


def _build_unified_items(
    item: Dict[str, Any],
    visit_data: Optional[Dict[str, Any]] = None,
    risk_flags: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Menggabungkan butir rujukan (makanan, susu/suplemen, stimulasi, langkah tindakan)
    dan tambahan analisis AI ke dalam satu daftar terstruktur beserta keterangan asalnya.
    """
    cit = item.get("citation") if isinstance(item.get("citation"), dict) else {}
    chunk_id = cit.get("chunk_id")
    ev_status = item.get("evidence_status") or ("CHUNK_DOKUMEN" if chunk_id else "ATURAN_SISTEM")
    ref_source_type = "RUJUKAN" if (chunk_id and ev_status in ("CHUNK_DOKUMEN", "RINGKASAN_TERKURASI")) else "ATURAN_SISTEM"
    quote = item.get("evidence_quote")
    cit_label = _format_citation_short(cit)

    unified: List[Dict[str, Any]] = []
    field_defs = [
        ("MAKANAN", "Panduan Makanan, Tekstur & Porsi", item.get("food_guide")),
        ("SUSU_SUPLEMEN", "Panduan ASI, Susu & Suplementasi", item.get("milk_and_supplements")),
        ("STIMULASI_AKTIVITAS", "Aktivitas Fisik & Stimulasi Harian", item.get("activity_and_stimulation")),
    ]
    for cat_code, label_str, val in field_defs:
        if val and str(val).strip():
            unified.append({
                "category": cat_code,
                "label": label_str,
                "text": str(val).strip(),
                "source_type": ref_source_type,
                "chunk_id": chunk_id,
                "basis_quote": quote,
                "citation_label": cit_label,
            })

    for idx_s, step_txt in enumerate(item.get("action_steps") or [], start=1):
        if step_txt and str(step_txt).strip():
            unified.append({
                "category": "LANGKAH_TINDAKAN",
                "label": f"Langkah Tindakan {idx_s}",
                "text": str(step_txt).strip(),
                "source_type": ref_source_type,
                "chunk_id": chunk_id,
                "basis_quote": quote,
                "citation_label": cit_label,
            })

    ai_text = item.get("ai_insight")
    ai_details = item.get("ai_insight_details") if isinstance(item.get("ai_insight_details"), dict) else None
    if (not ai_text or not str(ai_text).strip()) and ai_details:
        parts = [
            ai_details.get("condition_explanation"),
            ai_details.get("practical_tips"),
            f'Contoh edukasi kader: "{ai_details["counseling_script"]}"' if ai_details.get("counseling_script") else None,
        ]
        composed = " ".join(str(p).strip() for p in parts if p and str(p).strip())
        if composed:
            ai_text = composed
            item["ai_insight"] = composed

    if ai_text and str(ai_text).strip():
        ai_cit_label = _format_citation_short(ai_details) if ai_details and ai_details.get("source") else None
        basis = (
            (ai_details.get("supporting_sentence") if ai_details else None)
            or item.get("ai_insight_basis")
        )
        if not basis:
            if quote:
                basis = quote
            elif risk_flags:
                basis = "; ".join(
                    str(f.get("detail") or f.get("flag") or "")
                    for f in risk_flags[:2] if isinstance(f, dict)
                )
            elif visit_data:
                basis = "Data pengukuran klinis kunjungan pasien"
        item["ai_insight_basis"] = basis
        unified.append({
            "category": "ANALISIS_TAMBAHAN",
            "label": "Tambahan analisis AI",
            "text": str(ai_text).strip(),
            "source_type": "ANALISIS_AI",
            "chunk_id": (ai_details.get("chunk_id") if ai_details else None) or chunk_id,
            "basis_quote": basis,
            "citation_label": ai_cit_label or cit_label or "Data pemeriksaan klinis pasien",
        })

    return unified


def _resolve_ai_insight_details(
    item: Dict[str, Any],
    primary_chunk: Optional[Dict[str, Any]],
    chunks_by_id: Dict[str, Dict[str, Any]],
) -> None:
    """
    Menautkan `ai_insight_details` secara deterministik ke metadata chunk Buku KIA / PNPK
    yang benar-benar di-retrieve dari ChromaDB (sumber, bagian, halaman, kutipan verbatim).
    """
    raw_details = item.get("ai_insight_details")
    if not isinstance(raw_details, dict):
        item["ai_insight_details"] = None
        return

    cond = str(raw_details.get("condition_explanation") or "").strip() or None
    tips = str(raw_details.get("practical_tips") or "").strip() or None
    script = str(raw_details.get("counseling_script") or "").strip() or None
    if not (cond or tips or script):
        item["ai_insight_details"] = None
        return

    extra_cid = raw_details.get("chunk_id") or item.get("ai_insight_chunk_id")
    extra_chunk = chunks_by_id.get(extra_cid) if extra_cid else None
    if extra_chunk is None:
        extra_chunk = primary_chunk

    if extra_chunk:
        ai_ctx = " ".join(p for p in (cond, tips, script) if p)
        verbatim = _extract_verbatim_supporting_sentence(
            extra_chunk.get("content", ""),
            candidate_sentence=raw_details.get("supporting_sentence"),
            rec_context=ai_ctx,
        )
        item["ai_insight_details"] = {
            "condition_explanation": cond,
            "practical_tips": tips,
            "counseling_script": script,
            "source": extra_chunk.get("source"),
            "section": extra_chunk.get("section"),
            "page": extra_chunk.get("page"),
            "chunk_id": extra_chunk.get("id"),
            "origin": extra_chunk.get("origin"),
            "supporting_sentence": verbatim or None,
        }
        if not item.get("ai_insight_basis") and verbatim:
            item["ai_insight_basis"] = verbatim
    else:
        # Tidak ada chunk RAG yang valid: jangan mengarang nama buku atau halaman.
        item["ai_insight_details"] = None
        item["ai_insight"] = None
        item["ai_insight_basis"] = None


def attach_chunk_evidence(item: Dict[str, Any], chunks_by_id: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    Mengisi kutipan & sitasi rekomendasi dari chunk yang benar-benar di-retrieve.
    LLM menunjuk `chunk_id` dan `supporting_sentence`; sistem mengambil kalimat kutipan
    secara verbatim dari chunk dan memverifikasi keberadaannya di dalam teks chunk.
    Tidak ada penambahan chunk pendukung otomatis tanpa verifikasi relevansi.
    Bila chunk_id tidak valid, rekomendasi ditandai TANPA_KUTIPAN (tanpa sitasi pengganti).
    """
    cit = item.get("citation")
    chunk_id = cit.get("chunk_id") if isinstance(cit, dict) else None
    chunk_id = chunk_id or item.get("chunk_id")
    candidate_sentence = (
        (cit.get("supporting_sentence") if isinstance(cit, dict) else None)
        or item.get("supporting_sentence")
        or item.get("evidence_quote")
    )
    extra_ids = (cit.get("supporting_chunk_ids") if isinstance(cit, dict) else None) or item.get("supporting_chunk_ids") or []
    chunk = chunks_by_id.get(chunk_id) if chunk_id else None

    supporting_chunks: List[Dict[str, Any]] = []
    if chunk:
        supporting_chunks.append(chunk)
        for eid in extra_ids:
            ec = chunks_by_id.get(eid)
            if ec and ec.get("id") not in {c.get("id") for c in supporting_chunks}:
                supporting_chunks.append(ec)

    item.pop("source", None)
    item.pop("section", None)
    item.pop("page", None)
    item["citation"] = citation_from_chunk(chunk, supporting_chunks=supporting_chunks if chunk else None)
    if chunk:
        rec_context = " ".join(
            str(item.get(k) or "")
            for k in ("title", "recommendation_text", "food_guide", "milk_and_supplements", "activity_and_stimulation")
        )
        item["evidence_quote"] = _extract_verbatim_supporting_sentence(
            chunk.get("content", ""),
            candidate_sentence=candidate_sentence,
            rec_context=rec_context,
        )
        item["evidence_status"] = EVIDENCE_CURATED if chunk.get("origin") == "CURATED_SUMMARY" else EVIDENCE_CHUNK
    else:
        item["evidence_quote"] = None
        item["evidence_status"] = EVIDENCE_NONE
    _resolve_ai_insight_details(item, chunk, chunks_by_id)
    return item


# Istilah kondisi pada saran gizi LLM -> potongan nama flag yang harus ada (termasuk RIWAYAT_*)
_NUTRITION_CONDITION_TERMS = {
    r"\bkek\b|kurang energi kronis": ("KEK",),
    r"stunting|kejar tumbuh": ("STUNTING", "UNDERWEIGHT", "GIZI_KURANG", "GIZI_BURUK", "BB_TIDAK_NAIK"),
    r"gizi buruk": ("GIZI_BURUK",),
    r"\bbblr\b|kanguru|berat lahir rendah": ("BBLR", "BBLSR", "BBLER", "PREMATUR"),
    r"obesitas|gizi lebih": ("OBESITAS", "GIZI_LEBIH", "OVERWEIGHT", "BB_LEBIH"),
}
_PREVENTION_RE = r"(cegah|mencegah|pencegahan)"


def nutrition_text_mismatch(text: str, phase: str, age_months: Optional[int], flags: List[str]) -> Optional[str]:
    """
    Alasan bila saran gizi LLM tidak sesuai hasil analisis Agent 1, atau None bila sesuai.
    Dipakai untuk membuang saran yang menyebut kondisi tidak terdeteksi atau tidak sesuai umur.
    """
    import re as _re
    t = (text or "").lower()
    if not t:
        return None
    joined = " ".join(flags)
    for pattern, needed in _NUTRITION_CONDITION_TERMS.items():
        if _re.search(pattern, t) and not any(n in joined for n in needed):
            return f"menyebut kondisi yang tidak terdeteksi ({pattern.split('|')[0].replace(chr(92) + 'b', '')})"
    for m in _re.finditer(r"anemia", t):
        window = t[max(0, m.start() - 40): m.end() + 10]
        if "ANEMIA" not in joined and not _re.search(_PREVENTION_RE, window):
            return "menyebut anemia padahal Hb tidak menunjukkan anemia"
    young = phase == "BAYI_BARU_LAHIR" or (phase == "BADUTA" and age_months is not None and age_months < 6)
    if young and _re.search(r"mp-?asi|bubur|nasi tim|puree", t) and not _re.search(r"jangan|belum|tunda|dini|sebelum|setelah (usia )?6|usia 6", t):
        return "memberi MP-ASI pada bayi di bawah 6 bulan"
    return None


def _guard_llm_nutrition(item: Dict[str, Any], phase: str, age_months: Optional[int], flags: List[str]) -> Dict[str, Any]:
    """Saran gizi LLM yang tidak sesuai dikosongkan agar diisi panduan berbasis aturan (care plan)."""
    for field in ("food_guide", "milk_and_supplements"):
        reason = nutrition_text_mismatch(item.get(field) or "", phase, age_months, flags)
        if reason:
            item[field] = None
            item.setdefault("nutrition_guard_notes", []).append(f"{field}: saran AI dibuang karena {reason}; diganti panduan aturan Buku KIA.")
    ai_details = item.get("ai_insight_details")
    if isinstance(ai_details, dict):
        for sub_f in ("condition_explanation", "practical_tips", "counseling_script"):
            reason = nutrition_text_mismatch(ai_details.get(sub_f) or "", phase, age_months, flags)
            if reason:
                ai_details[sub_f] = None
                item.setdefault("nutrition_guard_notes", []).append(
                    f"ai_insight_details.{sub_f}: dibuang karena {reason}."
                )
        if not any(ai_details.get(k) for k in ("condition_explanation", "practical_tips", "counseling_script")):
            item["ai_insight_details"] = None
            item["ai_insight"] = None
    return item


def _enrich_recommendation_item_fields(
    item: Dict[str, Any],
    care_plan: Dict[str, Any],
    visit_data: Optional[Dict[str, Any]] = None,
    risk_flags: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Memastikan setiap item rekomendasi Agent 2 memiliki rincian makanan, susu, aktivitas/stimulasi, dan daftar butir gabungan berlabel asal."""
    fn = care_plan.get("food_and_nutrition", {})
    ms = care_plan.get("milk_and_supplements", {})
    ac = care_plan.get("activity_and_stimulation", {})

    if not item.get("food_guide"):
        foods = fn.get("recommended_foods", [])
        item["food_guide"] = (
            f"{fn.get('stage_and_texture', '')} Frekuensi: {fn.get('frequency_and_portion', '')} "
            f"Bahan utama: {foods[0] if foods else 'Protein hewani lokal (ikan tude/cakalang, telur, hati ayam) & sayur hijau.'}"
        ).strip()

    if not item.get("milk_and_supplements"):
        item["milk_and_supplements"] = (
            f"{ms.get('recommended_type', '')} Takaran: {ms.get('frequency_and_portion', '')}"
        ).strip()

    if not item.get("activity_and_stimulation"):
        acts = ac.get("recommended_activities", [])
        item["activity_and_stimulation"] = " ".join(acts[:2]) if acts else "Pantau aktivitas dan stimulasi harian sesuai Buku KIA."

    # Catatan: Tidak ada pengisian teks tetap (hardcoded) untuk ai_insight.
    # Bila LLM tidak mengisi ai_insight atau saat fallback, ai_insight dibiarkan None.
    item["items"] = _build_unified_items(item, visit_data=visit_data, risk_flags=risk_flags)
    return item


def clinical_recommender_agent(state: AgentState) -> Dict[str, Any]:
    """
    AGENT 2: Rekomendasi Klinis (Autonomous ReAct Agent + RAG)
    
    1. Mengoperasikan siklus ReAct (Reasoning + Acting) otonom:
       - Tool 1: `search_guidelines` untuk kueri semantik ke ChromaDB (Buku KIA / PNPK Stunting).
       - Tool 2: `get_deterministic_detail` untuk inspeksi angka baku kalkulasi Stage 1.
    2. Mendukung Human-in-the-loop: memperhitungkan catatan penolakan/revisi kader jika ada.
    3. Validasi skema keluaran terstruktur dengan Pydantic (RecommendationItem) yang telah diperkaya
       dengan panduan Makanan/MP-ASI, ASI/Susu/Suplementasi, dan Aktivitas/Stimulasi.
    4. Fallback deterministik berbasis aturan jika kuota LLM habis atau koneksi terputus.
    """
    t0 = time.perf_counter()
    spawned_at = datetime.now().isoformat(timespec="milliseconds")

    risk_flags = state.get("risk_flags", [])
    risk_narrative = state.get("risk_narrative", "")
    phase = state.get("phase", "BADUTA")
    visit_data = state.get("visit_data", {}) or {}
    deterministic_results = state.get("deterministic_results", {})
    maternal_history = state.get("maternal_history") or {}
    kader_feedback = state.get("kader_feedback")
    tools_invoked: List[str] = ["build_comprehensive_care_plan"]
    flag_names = [f.get("flag", "") for f in risk_flags if isinstance(f, dict)]
    _age_raw = visit_data.get("age_in_months")
    _age_for_guard = int(_age_raw) if _age_raw is not None else None

    care_plan = build_comprehensive_care_plan(
        phase=phase,
        visit_data=visit_data,
        risk_flags=risk_flags,
        deterministic_results=deterministic_results,
        maternal_history=maternal_history,
        kader_feedback=kader_feedback,
    )
    deterministic_results["care_plan"] = care_plan

    if not risk_flags:
        t1 = time.perf_counter()
        terminated_at = datetime.now().isoformat(timespec="milliseconds")
        lifetime_ms = round(max(0.5, (t1 - t0) * 1000.0), 2)
        agent2_telemetry = {
            "agent_id": "agent_2",
            "agent_name": "Agent 2: Rekomendasi Klinis RAG & Care Plan",
            "execution_order": 2,
            "execution_pattern": "SEQUENTIAL_STEP_2 (Bypassed RAG - No Risk Flags)",
            "lifecycle_state": "TERMINATED (Selesai Tugas, Selesai Hidup / Ephemeral)",
            "spawned_at": spawned_at,
            "terminated_at": terminated_at,
            "lifetime_ms": lifetime_ms,
            "mode": "NO_RISK",
            "complexity_rank": "Paling Sulit (Multi-Hop ReAct, RAG ChromaDB & Sintesis Klinis Kontekstual)",
            "complexity_reason": (
                "Menjalankan siklus ReAct otonom, menarik vektor Buku KIA/PNPK dari ChromaDB, serta merumuskan menu "
                "pangan lokal Minahasa, panduan ASI/susu/TTD, dan aktivitas harian ke JSON tersitasi."
            ),
            "tools_invoked": tools_invoked,
            "token_usage": extract_token_usage(None, is_llm_call=False),
            "task_proof": {
                "input_summary": f"Fase {phase}, 0 Flag Risiko",
                "output_summary": "Menyusun Care Plan preventif 1.000 HPK tanpa memanggil RAG LLM.",
                "chunks_retrieved_count": 0,
                "recommendations_count": 0,
            },
        }
        deterministic_results["_agent2_telemetry"] = agent2_telemetry
        existing_telemetry = dict(state.get("agent_telemetry") or {})
        existing_telemetry["agent_2"] = agent2_telemetry
        return {
            "recommendations": [],
            "care_plan": care_plan,
            "retrieved_chunks": [],
            "recommender_mode": "NO_RISK",
            "thought_process": ["Tidak ada flag risiko aktif, panduan preventif 1.000 HPK disiapkan pada care_plan."],
            "agent_telemetry": existing_telemetry,
        }

    seen_chunks: Dict[str, Dict[str, Any]] = {}
    thought_process: List[str] = []
    token_usages: List[Dict[str, Any]] = []

    # Pre-retrieval awal agar agen memiliki basis rujukan instan tanpa harus membuang round-trip
    tools_invoked.append("retrieve_clinical_guidelines (ChromaDB Vector Search)")
    for flag_obj in risk_flags:
        f_name = flag_obj.get("flag", "")
        detail = flag_obj.get("detail", "")
        q = flag_search_query(f_name, detail)
        for c in retrieve_clinical_guidelines(q, n_results=3):
            cid = c["id"]
            if cid not in seen_chunks:
                c["retrieved_for_flag"] = f_name
                c["retrieved_for_flags"] = [f_name]
                seen_chunks[cid] = c
            else:
                fl_list = seen_chunks[cid].setdefault("retrieved_for_flags", [])
                if f_name not in fl_list:
                    fl_list.append(f_name)

    guidelines_preview = "\n\n".join([
        f"[ID: {c.get('id')}] Sumber: {c.get('source')} | Bagian: {c.get('section')} | Hal: {c.get('page')}\nKutipan: {c.get('content')}"
        for c in list(seen_chunks.values())[:6]
    ])

    # ------------------------------------------------------------------------
    # Definisi Tools untuk ReAct Agent
    # ------------------------------------------------------------------------
    @tool
    def search_guidelines(query: str, n_results: int = 2) -> str:
        """Mencari pedoman klinis resmi KIA, tatalaksana gizi, makanan MP-ASI, ASI/susu, stimulasi, stunting, atau KEK dari ChromaDB."""
        chunks = retrieve_clinical_guidelines(query, n_results=n_results)
        if not chunks:
            return "Tidak ditemukan dokumen pedoman yang relevan untuk kueri tersebut."
        
        snippets = []
        for c in chunks:
            chunk_id = c.get("id")
            if chunk_id and chunk_id not in seen_chunks:
                seen_chunks[chunk_id] = c
            snippets.append(
                f"[ID: {chunk_id}] Sumber: {c.get('source')} | Bagian: {c.get('section')} | Hal: {c.get('page')}\n"
                f"Kutipan: {c.get('content')}"
            )
        return "\n\n".join(snippets)

    @tool
    def get_deterministic_detail(indicator_or_topic: str) -> str:
        """Mengambil rincian kalkulasi baku Stage 1 (Z-score WHO, LMS, KSPR, LiLA, Hb, BBLR, tren 2T, care_plan)."""
        topic = indicator_or_topic.lower()
        if "who" in topic or "zscore" in topic or "stunting" in topic or "z" in topic:
            who_data = deterministic_results.get("who_zscore")
            return json.dumps(who_data or "Tidak ada data kalkulasi WHO Z-score.", ensure_ascii=False)
        elif "faltering" in topic or "2t" in topic or "berat" in topic or "trend" in topic:
            trend_data = deterministic_results.get("weight_trend")
            return json.dumps(trend_data or "Tidak ada data pemantauan berat badan 2T.", ensure_ascii=False)
        elif "kspr" in topic or "kehamilan" in topic or "resiko" in topic:
            kspr_data = deterministic_results.get("kspr")
            return json.dumps(kspr_data or "Tidak ada data KSPR ibu hamil.", ensure_ascii=False)
        elif "maternal" in topic or "ibu" in topic:
            return json.dumps(maternal_history or "Tidak ada riwayat maternal.", ensure_ascii=False)
        else:
            return json.dumps(deterministic_results, ensure_ascii=False, default=str)

    tools = [search_guidelines, get_deterministic_detail]
    tool_map = {t.name: t for t in tools}

    # ------------------------------------------------------------------------
    # Eksekusi Siklus ReAct dengan Gemini LLM
    # ------------------------------------------------------------------------
    llm = get_chat_llm(temperature=0.2, max_tokens=2600)
    recommendations: List[Dict[str, Any]] = []
    recommender_mode = MODE_FALLBACK

    if llm is not None:
        try:
            llm_with_tools = llm.bind_tools(tools)

            feedback_note = ""
            if kader_feedback:
                feedback_note = (
                    f"\n[CATATAN REVISI KADER]: Kader Posyandu menolak rekomendasi sebelumnya dengan alasan:\n"
                    f"'{kader_feedback}'\n"
                    f"Anda WAJIB mengakomodasi catatan ini (misalnya mencari menu/intervensi alternatif).\n"
                )

            longitudinal_summary = deterministic_results.get("longitudinal_summary", {})
            comp_items = longitudinal_summary.get("comparison_items", [])
            comp_str = "; ".join([f"{c.get('metric')}: {c.get('previous')} -> {c.get('current')} ({c.get('delta')}, {c.get('status')})" for c in comp_items]) if comp_items else "Kunjungan pemantauan pertama / data awal."

            initial_user_prompt = f"""Konteks Pasien:
- Fase: {phase}
- Data Kunjungan: {json.dumps(visit_data, ensure_ascii=False, default=str)}
- Temuan Narasi Klinis: {risk_narrative}
- Daftar Flag Risiko Aktif: {json.dumps(risk_flags, ensure_ascii=False)}
- Riwayat Evaluasi Longitudinal Kunjungan Sebelumnya: {comp_str}
- Referensi Care Plan 1.000 HPK: {json.dumps(care_plan, ensure_ascii=False, default=str)}
{feedback_note}

Dokumen Pedoman Klinis Relevan Tersedia (Buku KIA / PNPK Stunting):
{guidelines_preview or 'Gunakan tool search_guidelines jika membutuhkan kutipan rujukan tambahan.'}

Tugas Anda:
1. Pelajari konteks pasien, panduan makanan/susu/stimulasi, dan pedoman rujukan resmi di atas.
2. Keluarkan 2-3 butir rekomendasi prioritas dalam format JSON valid yang memuat `title`, `category`, `recommendation_text`, `food_guide` (makanan & porsi), `milk_and_supplements` (ASI/susu/suplemen), `activity_and_stimulation` (aktivitas fisik & stimulasi), `action_steps`, dan `citation`.
3. Jika butuh rujukan tambahan di luar kutipan di atas, Anda DAPAT memanggil tool `search_guidelines` atau `get_deterministic_detail`.
"""
            full_prompt_text = f"{RECOMMENDER_REACT_SYSTEM_PROMPT}\n{initial_user_prompt}"
            messages = [
                SystemMessage(content=RECOMMENDER_REACT_SYSTEM_PROMPT),
                HumanMessage(content=initial_user_prompt),
            ]

            step_count = 0
            final_content = ""

            while step_count < MAX_REACT_STEPS:
                step_count += 1
                ai_msg = llm_with_tools.invoke(messages)
                messages.append(ai_msg)
                token_usages.append(
                    extract_token_usage(ai_msg, prompt_text=full_prompt_text, output_text=extract_text(ai_msg.content), is_llm_call=True)
                )

                tool_calls = getattr(ai_msg, "tool_calls", None) or []
                if not tool_calls:
                    final_content = extract_text(ai_msg.content)
                    thought_process.append(f"Langkah {step_count}: Model selesai merumuskan rekomendasi komprehensif.")
                    break

                for tc in tool_calls:
                    fn_name = tc.get("name")
                    fn_args = tc.get("args", {})
                    call_id = tc.get("id") or f"call_{step_count}"
                    if fn_name:
                        tools_invoked.append(f"ReAct Tool: {fn_name}")
                    thought_process.append(f"Langkah {step_count}: Action `{fn_name}` dengan argumen {fn_args}")
                    target_tool = tool_map.get(fn_name)
                    if target_tool:
                        try:
                            obs = target_tool.invoke(fn_args)
                        except Exception as tool_err:
                            obs = f"Error saat menjalankan tool {fn_name}: {tool_err}"
                    else:
                        obs = f"Tool {fn_name} tidak ditemukan."
                    messages.append(ToolMessage(content=str(obs), tool_call_id=call_id))

            if not final_content:
                followup_prompt = (
                    "Informasi dokumen rujukan dan kalkulasi telah dikumpulkan. "
                    "Sekarang, keluarkan HANYA array JSON rekomendasi klinis final beserta food_guide, milk_and_supplements, dan activity_and_stimulation."
                )
                messages.append(HumanMessage(content=followup_prompt))
                final_ai = llm.invoke(messages)
                final_content = extract_text(final_ai.content)
                token_usages.append(
                    extract_token_usage(final_ai, prompt_text=full_prompt_text + followup_prompt, output_text=final_content, is_llm_call=True)
                )

            parsed_data = parse_llm_json(final_content)
            if isinstance(parsed_data, dict) and "recommendations" in parsed_data:
                raw_items = parsed_data["recommendations"]
            elif isinstance(parsed_data, list):
                raw_items = parsed_data
            else:
                raw_items = [parsed_data]

            validated_items = []
            for item in raw_items:
                if not isinstance(item, dict):
                    continue
                item = attach_chunk_evidence(item, seen_chunks)
                item = _guard_llm_nutrition(item, phase, _age_for_guard, flag_names)
                item = _enrich_recommendation_item_fields(item, care_plan, visit_data=visit_data, risk_flags=risk_flags)
                item["reasoning_mode"] = MODE_LLM_REACT
                item["thought_process"] = list(thought_process)
                if not item.get("longitudinal_progress"):
                    item["longitudinal_progress"] = comp_str
                try:
                    validated = RecommendationItem(**item)
                    validated_items.append(validated.model_dump())
                except Exception as pydantic_err:
                    logger.warning(f"[RECOMMENDER SCHEMA WARNING] Item diabaikan karena skema tidak valid: {pydantic_err}")

            if validated_items:
                recommendations = validated_items
                recommender_mode = MODE_LLM_REACT
                thought_process.append(f"Validasi Pydantic sukses: {len(validated_items)} butir rekomendasi disahkan.")

        except Exception as e:
            logger.warning(f"[RECOMMENDER REACT WARNING] Fallback ke aturan deterministik: {e}")
            thought_process.append(f"Gagal mengeksekusi ReAct LLM ({e}), beralih ke fallback deterministik.")
            recommendations = []

    # ------------------------------------------------------------------------
    # Fallback Deterministik jika LLM offline, kehabisan kuota, atau skema gagal
    # ------------------------------------------------------------------------
    if not recommendations:
        recommender_mode = MODE_FALLBACK
        if not seen_chunks:
            for flag_obj in risk_flags:
                f_name = flag_obj.get("flag", "")
                detail = flag_obj.get("detail", "")
                q = flag_search_query(f_name, detail)
                for c in retrieve_clinical_guidelines(q, n_results=3):
                    cid = c["id"]
                    if cid not in seen_chunks:
                        c["retrieved_for_flag"] = f_name
                        c["retrieved_for_flags"] = [f_name]
                        seen_chunks[cid] = c
                    else:
                        fl_list = seen_chunks[cid].setdefault("retrieved_for_flags", [])
                        if f_name not in fl_list:
                            fl_list.append(f_name)

        tools_invoked.append("_generate_rule_based_recommendations (Fallback PNPK/Buku KIA)")
        longitudinal_summary = deterministic_results.get("longitudinal_summary", {})
        comp_items = longitudinal_summary.get("comparison_items", [])
        comp_str_fb = (
            "; ".join([f"{c.get('metric')}: {c.get('previous')} -> {c.get('current')} ({c.get('delta')}, {c.get('status')})" for c in comp_items])
            if comp_items
            else "Kunjungan pemantauan pertama / data awal."
        )
        recommendations = _generate_rule_based_recommendations(
            risk_flags=risk_flags,
            chunks=list(seen_chunks.values()),
            kader_feedback=kader_feedback,
            care_plan=care_plan,
            longitudinal_progress=comp_str_fb,
        )
        thought_process.append("Rekomendasi disintesis menggunakan aturan deterministik fallback standar PNPK/Buku KIA.")

    t1 = time.perf_counter()
    terminated_at = datetime.now().isoformat(timespec="milliseconds")
    lifetime_ms = round(max(0.5, (t1 - t0) * 1000.0), 2)

    final_token_usage = (
        merge_token_usage(token_usages)
        if token_usages
        else extract_token_usage(
            None,
            prompt_text=guidelines_preview,
            output_text=json.dumps(recommendations, ensure_ascii=False),
            is_llm_call=False,
        )
    )

    # Pastikan butir rekomendasi Kelulusan 1.000 HPK disisipkan bila anak mencapai milestone usia 24 bulan
    grad_pkg = care_plan.get("graduation_package") if care_plan else None
    if grad_pkg and not any(r.get("category") == "KELULUSAN_1000_HPK" for r in recommendations):
        has_gr = (grad_pkg.get("graduation_status") == "PERHATIAN_KHUSUS_STUNTING")
        grad_rec = {
            "title": f"Milestone Hari ke-1.000: Evaluasi Kelulusan 1.000 HPK ({'Perhatian Khusus Stunting' if has_gr else 'Lulus Optimal Bebas Stunting'})",
            "category": "KELULUSAN_1000_HPK",
            "recommendation_text": grad_pkg.get("exit_assessment", ""),
            "food_guide": (
                "Transisi Nutrisi Balita 2-5 Tahun: Makanan keluarga 3x sehari + 2x selingan padat gizi (Isi Piringku Balita). "
                "Wajib protein hewani ganda lokal Minahasa Utara setiap hari (ikan tude/cakalang, telur ayam, hati ayam)."
            ),
            "milk_and_supplements": (
                "Panduan Menyapih Penuh Kasih (Weaning with Love) bertahap tanpa paksaan. "
                "Susu UHT plain / susu pertumbuhan maksimal 300-400 mL/hari sebagai pelengkap. "
                + ("Konsultasikan ke Dokter Spesialis Anak Puskesmas/RSUD untuk peresepan Susu PKMK padat kalori karena terdeteksi gagal tumbuh. " if has_gr else "")
                + "DILARANG KERAS Susu Kental Manis (SKM). Protokol Kemenkes RI: ASI Standar Emas Awal Kehidupan."
            ),
            "activity_and_stimulation": (
                "Skrining KPSP 24 Bulan: Latih melompat dengan 2 kaki, menaiki tangga dengan berpegangan, menendang bola, "
                "menyusun 4-6 balok, bicara kalimat 2 kata, dan mulai toilet training."
            ),
            "ai_insight": None,
            "action_steps": [
                "Lakukan evaluasi antropometri penutupan 1.000 HPK bersama Tenaga Kesehatan Puskesmas",
                "Terapkan metode menyapih dengan kasih sayang (Weaning with Love) tanpa paksaan atau trauma",
                "Penuhi menu harian Isi Piringku Balita dengan protein hewani ganda lokal Minahasa Utara",
                "Lanjutkan pemantauan berat dan panjang badan setiap bulan di Posyandu Balita hingga usia 5 tahun",
            ],
            # Rekomendasi aturan sistem: tidak berasal dari chunk, sehingga tanpa kutipan.
            "citation": citation_from_chunk(None),
            "evidence_quote": None,
            "evidence_status": EVIDENCE_RULE,
            "reasoning_mode": "ATURAN_SISTEM",
            "severity": "HIGH" if has_gr else "INFO",
        }
        grad_rec["items"] = _build_unified_items(grad_rec, visit_data=visit_data, risk_flags=risk_flags)
        recommendations.insert(0, grad_rec)

    agent2_telemetry = {
        "agent_id": "agent_2",
        "agent_name": "Agent 2: Rekomendasi Klinis RAG & Care Plan",
        "execution_order": 2,
        "execution_pattern": "SEQUENTIAL_STEP_2 (Conditional Router: requires_rag=True)",
        "lifecycle_state": "TERMINATED (Selesai Tugas, Selesai Hidup / Ephemeral)",
        "spawned_at": spawned_at,
        "terminated_at": terminated_at,
        "lifetime_ms": lifetime_ms,
        "mode": recommender_mode,
        "complexity_rank": "Paling Sulit (Multi-Hop ReAct, RAG ChromaDB & Sintesis Klinis Kontekstual)",
        "complexity_reason": (
            "Menjalankan siklus ReAct otonom, menarik vektor Buku KIA/PNPK dari ChromaDB, serta merumuskan menu "
            "pangan lokal Minahasa, panduan ASI/susu/TTD, dan aktivitas harian ke JSON tersitasi."
        ),
        "tools_invoked": tools_invoked,
        "thought_process": thought_process,
        "token_usage": final_token_usage,
        "task_proof": {
            "input_summary": f"Fase {phase}, {len(risk_flags)} Flag Risiko ({', '.join(f.get('flag', '') for f in risk_flags)})",
            "output_summary": f"{len(recommendations)} Rekomendasi Tersitasi + Care Plan 1.000 HPK ({len(seen_chunks)} Chunks ChromaDB)",
            "chunks_retrieved_count": len(seen_chunks),
            "recommendations_count": len(recommendations),
        },
        "work_breakdown": {
            "recommender_mode": recommender_mode,
            "chunks_retrieved_count": len(seen_chunks),
            "recommendations_trace": [
                {
                    "title": r.get("title"),
                    "category": r.get("category"),
                    "reasoning_mode": r.get("reasoning_mode"),
                    "evidence_status": r.get("evidence_status"),
                    "citation": r.get("citation"),
                    "evidence_quote": r.get("evidence_quote"),
                    "ai_insight": r.get("ai_insight"),
                    "ai_insight_details": r.get("ai_insight_details"),
                }
                for r in recommendations
            ],
        },
    }
    deterministic_results["_agent2_telemetry"] = agent2_telemetry
    existing_telemetry = dict(state.get("agent_telemetry") or {})
    existing_telemetry["agent_2"] = agent2_telemetry

    return {
        "recommendations": recommendations,
        "care_plan": care_plan,
        "retrieved_chunks": list(seen_chunks.values()),
        "recommender_mode": recommender_mode,
        "thought_process": thought_process,
        "agent_telemetry": existing_telemetry,
    }


def _generate_rule_based_recommendations(
    risk_flags: List[Dict[str, Any]],
    chunks: List[Dict[str, Any]],
    kader_feedback: Optional[str] = None,
    care_plan: Optional[Dict[str, Any]] = None,
    longitudinal_progress: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Generator rekomendasi deterministik fallback berbasis aturan standar Kemenkes/PNPK.
    Menyertakan rincian makanan, ASI/susu/suplemen, aktivitas/stimulasi, serta narasi pendampingan.
    """
    recs = []
    has_egg_allergy = bool(kader_feedback and ("telur" in kader_feedback.lower() or "alergi" in kader_feedback.lower()))
    cp = care_plan or build_comprehensive_care_plan(phase="BADUTA", risk_flags=risk_flags, kader_feedback=kader_feedback)
    fn = cp.get("food_and_nutrition", {})
    ms = cp.get("milk_and_supplements", {})
    ac = cp.get("activity_and_stimulation", {})

    for flag in risk_flags:
        f_name = flag.get("flag", "")
        matching_chunks = [
            c for c in chunks
            if c.get("retrieved_for_flag") == f_name or f_name in (c.get("retrieved_for_flags") or [])
        ]
        matching_chunk = matching_chunks[0] if matching_chunks else (chunks[0] if chunks else None)
        citation = {
            "chunk_id": matching_chunk["id"] if matching_chunk else None,
        }

        # Nama flag dicocokkan persis: OVERWEIGHT/GIZI_LEBIH tidak boleh masuk cabang gagal tumbuh
        if f_name in GROWTH_DEFICIT_FLAGS:
            protein_step = (
                "Berikan alternatif protein hewani non-telur setiap makan: ikan tude/cakalang segar (bebas duri), hati ayam, daging ayam/sapi cincang, serta tahu/tempe"
                if has_egg_allergy
                else "Wajib berikan protein hewani ganda setiap hari: 1 butir telur ayam/puyuh ditambah ikan tude/cakalang segar, hati ayam, atau daging ayam/sapi cincang"
            )
            recs.append({
                "title": "Intervensi Gizi Spesifik, MP-ASI Tinggi Protein Hewani & Rujukan Puskesmas",
                "category": "GIZI",
                "recommendation_text": (
                    " ".join(_pnpk_referral_lines({f.get("flag", "") for f in risk_flags}))
                    + " Berikan MP-ASI tinggi protein hewani sesuai usia; PMT pemulihan atau PKMK diberikan setelah evaluasi tenaga kesehatan."
                    + (f" (Catatan Kader: {kader_feedback})" if kader_feedback else "")
                ),
                "longitudinal_progress": longitudinal_progress,
                "food_guide": (
                    f"{fn.get('stage_and_texture', '')} {protein_step}. "
                    "Tambahkan 1 sdt minyak kelapa/mentega/santan matang pada setiap porsi bubur/nasi tim untuk meningkatkan densitas kalori."
                ),
                "milk_and_supplements": (
                    f"{ms.get('recommended_type', '')} "
                    "Jangan berikan Susu Kental Manis (SKM); berikan kapsul Vitamin A sesuai jadwal Posyandu."
                ),
                "activity_and_stimulation": (
                    " ".join(ac.get("recommended_activities", [])[:3])
                    or "Pastikan anak tidur cukup 11-13 jam/hari (hormon pertumbuhan aktif saat tidur malam), stimulasi motorik & bicara sesuai usia, dan cuci tangan pakai sabun (PHBS)."
                ),
                "ai_insight": None,
                "action_steps": [
                    "Rujuk anak ke Puskesmas Airmadidi sesuai alur PNPK untuk konfirmasi dan evaluasi",
                    protein_step,
                    "Tambahkan lemak sehat (1 sdt minyak kelapa/santan/mentega) di setiap porsi MP-ASI dan terapkan responsive feeding tanpa gawai",
                    "Pantau kenaikan berat badan dan panjang/tinggi badan setiap 2 minggu di Posyandu",
                ],
                "citation": citation,
            })
        elif f_name in OVERWEIGHT_FLAGS:
            recs.append({
                "title": "Konfirmasi Gizi Lebih & Konseling Gizi Seimbang",
                "category": "GIZI",
                "recommendation_text": (
                    f"Status gizi lebih terdeteksi ({flag.get('detail', f_name)}). Dokumen rujukan (Buku KIA, PNPK Stunting) "
                    "tidak memuat tata laksana gizi lebih; rujuk ke Puskesmas untuk konfirmasi dan konseling gizi."
                ),
                "longitudinal_progress": longitudinal_progress,
                "food_guide": f"{fn.get('stage_and_texture', '')} Frekuensi: {fn.get('frequency_and_portion', '')} Jangan menambah porsi atau lemak tambahan.",
                "milk_and_supplements": f"{ms.get('recommended_type', '')}",
                "activity_and_stimulation": " ".join(ac.get("recommended_activities", [])[:2]),
                "ai_insight": None,
                "action_steps": [
                    "Rujuk ke Puskesmas Airmadidi untuk konfirmasi status gizi lebih",
                    "Jangan menambah porsi makan atau lemak tambahan pada MP-ASI",
                    "Lanjutkan penimbangan dan pengukuran panjang badan setiap bulan di Posyandu",
                ],
                "citation": citation,
            })
        elif "KEK" in f_name and not f_name.startswith("RIWAYAT_") or f_name == "BB_IBU_HAMIL_TURUN":
            recs.append({
                "title": "Pemberian Makanan Tambahan (PMT) & Pemulihan Gizi Ibu Hamil KEK",
                "category": "GIZI_MATERNAL",
                "recommendation_text": (
                    f"{flag.get('detail', 'LiLA < 23,5 cm').rstrip('. ')}. Ibu hamil berisiko KEK. Makan lebih banyak dan lebih sering sesuai porsi ibu hamil "
                    "Buku KIA, dan konsultasikan pemberian makanan tambahan (PMT) ibu hamil ke bidan/Puskesmas."
                ),
                "longitudinal_progress": longitudinal_progress,
                "food_guide": (
                    f"{fn.get('stage_and_texture', '')} {fn.get('frequency_and_portion', '')} "
                    "Utamakan lauk ikan tude/cakalang, telur, hati ayam, tempe/tahu, dan sayur daun kelor/bayam."
                ).strip(),
                "milk_and_supplements": (
                    "Minum Susu Khusus Ibu Hamil tinggi protein, kalsium & asam folat 2 gelas/hari (pagi dan sore), "
                    "serta 1 tablet TTD setiap malam sebelum tidur (beri jeda minimal 2 jam antara susu dan TTD)."
                ),
                "activity_and_stimulation": (
                    "Istirahat cukup (tidur malam 7-8 jam dan tidur siang 1 jam posisi miring kiri), kurangi beban kerja fisik berat, "
                    "jalan pagi santai 20 menit, dan hindari paparan asap rokok."
                ),
                "ai_insight": None,
                "action_steps": [
                    "Konsultasikan PMT ibu hamil ke bidan/Puskesmas dan pantau berat badan serta LiLA setiap bulan",
                    "Edukasi ibu untuk makan porsi kecil tapi sering dengan 2 lauk protein hewani setiap kali makan",
                    "Anjurkan konsumsi Susu Ibu Hamil 2x sehari terpisah 2 jam dari jadwal minum Tablet Tambah Darah (TTD)",
                    "Jadwalkan pemeriksaan ANC terpadu bersama Bidan/Dokter di Puskesmas Airmadidi",
                ],
                "citation": citation,
            })
        elif "ANEMIA" in f_name and not f_name.startswith("RIWAYAT_"):
            recs.append({
                "title": "Tata Laksana Anemia Kehamilan, Diet Tinggi Zat Besi & Kepatuhan TTD",
                "category": "MEDIS",
                "recommendation_text": (
                    f"{flag.get('detail', 'Hb < 11,0 g/dL').rstrip('. ')}. Pastikan Tablet Tambah Darah (TTD)/MMS diminum setiap hari dan periksakan ulang Hb "
                    "ke bidan/Puskesmas. Dosis TTD saat anemia ditentukan bidan/dokter."
                ),
                "longitudinal_progress": longitudinal_progress,
                "food_guide": (
                    "Konsumsi sumber zat besi heme yang mudah diserap tubuh setiap hari: hati ayam/sapi, ikan cakalang/tude, daging merah, telur, "
                    "sayur daun kelor/bayam, serta wajib disertai buah kaya Vitamin C (jeruk, jambu biji, pepaya)."
                ),
                "milk_and_supplements": (
                    "Minum Tablet Tambah Darah (TTD) sesuai anjuran bidan/dokter pada malam hari dengan air putih/jeruk. "
                    "Jangan minum TTD bersama teh, kopi, atau susu (beri jeda minimal 2 jam dari Susu Ibu Hamil)."
                ),
                "activity_and_stimulation": (
                    "Batasi aktivitas fisik yang menguras tenaga agar ibu tidak pusing/lemas, istirahat miring kiri yang cukup, "
                    "dan bangun secara perlahan dari posisi tidur/duduk."
                ),
                "ai_insight": None,
                "action_steps": [
                    "Pastikan kepatuhan minum TTD setiap malam sebelum tidur bersama air putih atau sari jeruk manis",
                    "Edukasi larangan minum teh/kopi setelah makan dan beri jeda 2 jam antara minum susu ibu hamil dengan TTD",
                    "Tingkatkan konsumsi hati ayam, ikan laut segar, telur, dan sayur daun kelor setiap hari",
                    "Periksakan ulang kadar Hemoglobin (Hb) di Puskesmas Airmadidi sesuai jadwal dari bidan/dokter",
                ],
                "citation": citation,
            })
        elif f_name in {"RISIKO_BBLR", "RISIKO_BBLSR", "RISIKO_BBLER", "RISIKO_PREMATUR"}:
            recs.append({
                "title": "Perawatan Metode Kanguru (PMK), ASI Eksklusif Intensif & Pemantauan BBLR",
                "category": "NEONATAL",
                "recommendation_text": (
                    "Bayi dengan berat lahir rendah (< 2.500 gram) atau riwayat BBLR memerlukan penjagaan suhu tubuh ketat "
                    "melalui Perawatan Metode Kanguru (PMK) dan pemberian ASI/nutrisi kejar tumbuh (catch-up growth)."
                ),
                "longitudinal_progress": longitudinal_progress,
                "food_guide": (
                    f"{fn.get('stage_and_texture', '')} "
                    "Bagi bayi <6 bulan: 100% ASI Eksklusif (ibu menyusui wajib makan tinggi protein hewani & daun katuk/kelor). "
                    "Bagi baduta >=6 bulan: MP-ASI padat energi-protein hewani ganda + tambahan lemak 1 sdt minyak kelapa/mentega."
                ),
                "milk_and_supplements": (
                    "Bayi 0-6 bulan: Susui ASI setiap 2 jam sekali (8-12x sehari, pastikan bayi mendapat hindmilk akhir yang kaya lemak). "
                    "Baduta >=6 bulan: Lanjutkan ASI + konsultasikan ke Dokter Puskesmas bila memerlukan fortifikasi/Susu PKMK kejar tumbuh."
                ),
                "activity_and_stimulation": (
                    "Terapkan kontak kulit-ke-kulit (Perawatan Metode Kanguru) untuk menjaga suhu 36,5-37,5°C, jemur pagi 10 menit, "
                    "dan berikan stimulasi sentuhan/suara lembut serta tidur yang cukup."
                ),
                "ai_insight": None,
                "action_steps": [
                    "Terapkan Perawatan Metode Kanguru (kontak kulit ke kulit di dada ibu/ayah) secara rutin dan jaga kehangatan bayi",
                    "Berikan ASI eksklusif sesering mungkin minimal setiap 2 jam sekali (bangunkan bayi bila tidur >2 jam)",
                    "Lakukan pemantauan kenaikan berat badan, panjang badan, dan suhu tubuh secara ketat bersama Bidan/Kader",
                    "Segera rujuk ke Puskesmas Airmadidi bila bayi malas menyusu, suhu dingin (<36,5°C), atau napas cepat",
                ],
                "citation": citation,
            })
        else:
            recs.append({
                "title": "Pendampingan Gizi 1.000 HPK, Stimulasi & Pemantauan Rutin Posyandu",
                "category": "EDUKASI",
                "recommendation_text": (
                    f"Tindak lanjuti temuan ({flag.get('detail', f_name)}) melalui konseling gizi harian, "
                    "pemberian ASI/susu sesuai tahapan, dan pemantauan kurva pertumbuhan rutin di Posyandu."
                ),
                "longitudinal_progress": longitudinal_progress,
                "food_guide": f"{fn.get('stage_and_texture', '')} Frekuensi: {fn.get('frequency_and_portion', '')}",
                "milk_and_supplements": f"{ms.get('recommended_type', '')} ({ms.get('frequency_and_portion', '')})",
                "activity_and_stimulation": " ".join(ac.get("recommended_activities", [])[:2]),
                "ai_insight": None,
                "action_steps": [
                    "Lakukan kunjungan dan penimbangan rutin setiap bulan di Posyandu",
                    "Terapkan jadwal menu makanan tinggi protein hewani dan pemberian ASI/susu sesuai usia/trimester",
                    "Lakukan aktivitas fisik dan stimulasi tumbuh kembang harian sesuai pedoman Buku KIA",
                ],
                "citation": citation,
            })

    unique_by_title: Dict[str, Dict[str, Any]] = {}
    for r in recs:
        title_key = r["title"]
        if title_key not in unique_by_title:
            unique_by_title[title_key] = r
        else:
            existing_cit = unique_by_title[title_key].get("citation") or {}
            new_cit = r.get("citation") or {}
            if not existing_cit.get("chunk_id") and new_cit.get("chunk_id"):
                existing_cit["chunk_id"] = new_cit["chunk_id"]
            unique_by_title[title_key]["citation"] = existing_cit
    recs = list(unique_by_title.values())

    chunks_by_id = {c["id"]: c for c in chunks if c.get("id")}
    for r in recs:
        attach_chunk_evidence(r, chunks_by_id)
        r["items"] = _build_unified_items(r, risk_flags=risk_flags)
        r["reasoning_mode"] = "FALLBACK_DETERMINISTIC"
        r["thought_process"] = [
            "Mode Darurat Deterministik Aktif: Rekomendasi disusun berdasarkan standar PNPK Kemenkes RI karena API LLM offline / kuota terbatas."
        ]

    return recs
