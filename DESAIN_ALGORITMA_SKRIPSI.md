# PSEUDOCODE RANCANGAN SISTEM MULTI-AGENT AI KIA

### Dokumen Pendukung Skripsi / Research Project

**Fakultas Ilmu Komputer – Universitas Klabat**

Format pseudocode di bawah ini disesuaikan dengan standar penulisan skripsi yang ringkas, jelas, dan mudah dipahami, berfokus pada alur logika interaksi pengguna dan proses internal sistem.

---

## 4.2.3.1 Pseudocode Interaksi Kader dengan Sistem (Alur Kunjungan & Validasi)

```text
PROGRAM MonitoringKIA_Kader

START

    KADER membuka aplikasi monitoring KIA
    SISTEM menampilkan halaman login

    KADER melakukan login dengan akun Kader Posyandu
    SISTEM menampilkan antarmuka Formulir Kunjungan

    IF Pasien belum pernah terdaftar di sistem? THEN
        KADER memilih "Registrasi Pasien Baru"
        KADER mengisi NIK, nama, tanggal lahir, dan desa
        SISTEM menyimpan data pasien baru
    ELSE
        KADER memilih pasien dari daftar pencarian
    ENDIF

    KADER memilih tab fase pemantauan (Ibu Hamil / Bayi Baru Lahir / Baduta)
    KADER menginput hasil pengukuran antropometri dan gejala klinis
    KADER menekan tombol "Jalankan Analisis Multi-Agent AI"

    SISTEM mengeksekusi alur Multi-Agent AI
    SISTEM menampilkan draf laporan hasil analisis beserta status risiko

    IF KADER menyetujui hasil laporan? THEN
        KADER menekan tombol "Setujui"
        SISTEM mengesahkan laporan menjadi status APPROVED
        SISTEM menerbitkan dokumen lembar laporan PDF resmi
    ELSE
        KADER menekan tombol "Tolak & Minta Revisi"
        KADER memasukkan catatan perbaikan / keluhan tambahan

        IF Laporan sudah pernah direvisi 1 kali sebelumnya? THEN
            SISTEM menolak proses revisi (batas maksimal 1 kali revisi)
            SISTEM mengarahkan kader untuk merujuk pasien ke Puskesmas
        ELSE
            SISTEM memperbarui konteks state dengan catatan kader
            SISTEM mengeksekusi 1 kali siklus revisi dengan AI Agent
            SISTEM menampilkan draf laporan hasil revisi untuk persetujuan akhir
        ENDIF
    ENDIF

END
```

_Gambar 4.x Pseudocode Interaksi Kader dengan Sistem Monitoring KIA_

---

## 4.2.3.2 Pseudocode Alur Orkestrasi Multi-Agent AI (LangGraph Workflow)

```text
PROGRAM Orkestrasi_MultiAgent_AI

START

    SISTEM menginisialisasi Shared State Memory dengan data pasien dan kunjungan

    // --- AGENT 1: Deteksi Risiko Deterministik ---
    AGENT 1 memeriksa riwayat longitudinal pasien (termasuk riwayat KEK ibu)
    AGENT 1 menjalankan kalkulasi baku matematis (Z-score WHO, skor KSPR, LiLA, Hb)
    AGENT 1 menghasilkan daftar flag risiko aktif dan narasi temuan klinis

    // --- PERCABANGAN KONDISIONAL (ROUTING) ---
    IF Terdapat flag risiko aktif yang memerlukan rujukan pedoman? THEN
        // --- AGENT 2: Rekomendasi Klinis RAG ---
        AGENT 2 mengubah flag risiko menjadi kueri pencarian semantik
        AGENT 2 mencari dokumen relevan di ChromaDB (Buku KIA & PNPK Stunting)
        AGENT 2 menyusun draf rekomendasi klinis beserta kutipan sumber dokumen
    ELSE
        SISTEM melompati Agent 2 (Bypass)
        AGENT 3 menetapkan status keseluruhan "KONDISI_BAIK" tanpa proses pencarian
    ENDIF

    // --- AGENT 3: Verifikasi Sitasi & Laporan Akhir ---
    AGENT 3 memeriksa kesesuaian setiap rekomendasi terhadap dokumen rujukan
    AGENT 3 menandai status grounding sitasi (VERIFIED / PARTIALLY_VERIFIED)
    AGENT 3 menyatukan seluruh temuan ke dalam format laporan JSON komprehensif

    // --- AUDIT EVALUATOR PARALEL ---
    SISTEM memanggil Evaluator LLM secara paralel di latar belakang
    EVALUATOR mencatat kepatuhan (Ya/Tidak) masing-masing agen ke tabel Audit Log

    SISTEM mengembalikan draf laporan akhir ke antarmuka kader

END
```

_Gambar 4.x Pseudocode Alur Kerja Orkestrasi Multi-Agent AI_

---

## 4.2.3.3 Pseudocode Interaksi Admin Puskesmas dengan Sistem

```text
PROGRAM PengelolaanSistem_Admin

START

    ADMIN membuka aplikasi monitoring KIA
    ADMIN melakukan login dengan akun Administrator Puskesmas
    SISTEM menampilkan halaman Dashboard Admin

    ADMIN memantau grafik agregat kasus stunting, KEK, dan anemia lintas 9 desa

    IF ADMIN memilih menu "Kelola Pasien"? THEN
        SISTEM menampilkan daftar seluruh pasien di wilayah kerja Puskesmas
        ADMIN dapat mencari, memperbarui (edit), atau menghapus data pasien
        SISTEM menyimpan perubahan data ke basis data MySQL

    ELSE IF ADMIN memilih menu "Kelola Kader"? THEN
        SISTEM menampilkan daftar akun kader dan Posyandu aktif
        ADMIN mendaftarkan akun kader baru untuk desa tertentu
        SISTEM menyimpan akun kader baru

    ELSE IF ADMIN memilih menu "Audit Log"? THEN
        SISTEM menampilkan tabel hasil evaluasi kepatuhan AI
        ADMIN meninjau riwayat penilaian biner (Ya/Tidak) dari tiap agen

    ENDIF

END
```

_Gambar 4.x Pseudocode Interaksi Admin Puskesmas dengan Sistem_

---

## 4.2.3.4 Pseudocode Kalkulasi Deterministik Z-Score PB/U (Stunting)

```text
PROGRAM Hitung_ZScore_Stunting

START

    INPUT umur_bulan, jenis_kelamin, panjang_badan
    BACA tabel baku WHO Child Growth Standards (LHFA) berdasarkan umur dan kelamin

    median_M = nilai baku SD0
    sd_positif = nilai baku SD1
    sd_negatif = nilai baku SD1neg

    IF panjang_badan >= median_M THEN
        z_score = (panjang_badan - median_M) / (sd_positif - median_M)
    ELSE
        z_score = (panjang_badan - median_M) / (median_M - sd_negatif)
    ENDIF

    IF z_score < -3.0 THEN
        status_gizi = "Sangat Pendek (Severely Stunted)"
        flag_risiko = "RISIKO_TINGGI"
    ELSE IF z_score < -2.0 THEN
        status_gizi = "Pendek (Stunted)"
        flag_risiko = "PERLU_PERHATIAN"
    ELSE
        status_gizi = "Normal"
        flag_risiko = "NORMAL"
    ENDIF

    OUTPUT z_score, status_gizi, flag_risiko

END
```

_Gambar 4.x Pseudocode Perhitungan Z-Score Stunting Deterministik_
