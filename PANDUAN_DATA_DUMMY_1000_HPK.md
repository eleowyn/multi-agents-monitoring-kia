# Panduan Data Dummy Pengujian 1.000 HPK Multi-Agent KIA

Dokumen ini berisi panduan data dummy pengujian komprehensif untuk **3 Posyandu** (minimal 2 pasien per posyandu). Seluruh kolom data disesuaikan **persis** dengan formulir registrasi sistem (hanya mencakup: **Tipe Pasien, NIK, Nama, Tanggal Lahir, Jenis Kelamin, dan Relasi Ibu Kandung** tanpa field alamat/no telepon).

Panduan ini mencakup:
1. **Timeline Lengkap Kelulusan 1.000 HPK**: 1 pasien anak dengan rekam jejak bertahap (Neonatus $\rightarrow$ 6 Bulan $\rightarrow$ 12 Bulan $\rightarrow$ 24 Bulan / Hari ke-1.000).
2. **Variasi Klinis Nyata**: Kasus Normal/Optimal, KEK, Anemia, Stunting Berat, dan BBLR (Bayi Berat Lahir Rendah).
3. **Multi-Agent Cross-Phase Continuity**: Hubungan riwayat ibu hamil dengan hasil diagnosis anak baduta.

---

## 🏛️ Akun Kader Posyandu untuk Testing

| Posyandu | Kelurahan/Desa | Username | Password | Target Pengujian |
| :--- | :--- | :--- | :--- | :--- |
| **Posyandu Mawar** | Kel. Airmadidi Atas | `posyandu_mawar` | `kader123` | **Kelulusan Tepat Hari ke-1.000 HPK (Timeline 4 Kunjungan)** & Ibu Normal |
| **Posyandu Melati** | Kel. Airmadidi Bawah | `posyandu_melati` | `kader123` | **Kasus Stunting Berat (Z < -3 SD)** & Ibu KEK + Anemia |
| **Posyandu Anggrek** | Kel. Sarongsong Satu | `posyandu_anggrek` | `kader123` | **Kasus BBLR Neonatal** & Ibu Hamil Normal |

---

## 📍 POSYANDU 1: Posyandu Mawar (Kelurahan Airmadidi Atas)
> **Fokus Uji**: Pelacakan Garis Waktu Lengkap hingga **Target Kelulusan Hari ke-1.000 HPK (Usia 24 Bulan)**.

### Pasien 1 (Ibu Kandung): Ny. Maria Wenas
#### A. Registrasi Pasien Baru (`/kader/input-kunjungan` $\rightarrow$ tombol `+ Pasien Baru`)
* **Tipe Pasien**: `Ibu Hamil`
* **NIK**: `7106015504980001`
* **Nama Lengkap**: `Ny. Maria Wenas`
* **Tanggal Lahir**: `1998-04-15`
*(Klik Simpan Pasien)*

#### B. Rekam Kunjungan ANC Ibu Hamil
* **Pilih Pasien**: `Ny. Maria Wenas`
* **Tanggal Kunjungan**: `2024-07-15`
* **Fase**: `1. Fase Kehamilan (Ibu Hamil)`
* **Usia Kehamilan**: `24` Minggu | **Trimester**: `2`
* **Berat Badan Ibu**: `53.0` kg
* **Tinggi Badan Ibu**: `155.0` cm
* **LiLA**: `25.0` cm *(Normal bebas KEK)*
* **Kadar Hb**: `12.2` g/dL *(Normal bebas Anemia)*
* **Tekanan Darah**: `115` / `75` mmHg
* **Kepatuhan TTD**: `Rutin Minum Setiap Hari`
* **KSPR**: *(Tidak perlu dicentang / Kehamilan Risiko Rendah)*
* **Catatan Klinis**: `Kondisi kehamilan ibu sehat dan asupan nutrisi seimbang.`
* *(Klik Analisis & Simpan Kunjungan $\rightarrow$ Sahkan Laporan)*

---

### Pasien 2 (Anak Kelulusan 1.000 HPK): David Wenas (L)
#### A. Registrasi Pasien Baru (`/kader/input-kunjungan` $\rightarrow$ tombol `+ Pasien Baru`)
* **Tipe Pasien**: `Anak / Bayi`
* **NIK**: `7106010111240001`
* **Nama Lengkap**: `David Wenas`
* **Tanggal Lahir**: `2024-11-01`
* **Jenis Kelamin**: `Laki-laki`
* **Ibu Kandung**: Pilih `Ny. Maria Wenas (NIK: 7106015504980001)`
*(Klik Simpan Pasien)*

#### B. Rekam Jejak 4 Kunjungan Berkelanjutan (Timeline 1.000 HPK)

##### 1. Kunjungan Fase 2: Neonatal (Hari ke-277 HPK / Usia 7 Hari)
* **Pilih Pasien**: `David Wenas`
* **Tanggal Kunjungan**: `2024-11-08`
* **Fase**: `2. Fase Bayi Baru Lahir (0-28 Hari)`
* **Berat Lahir**: `3200` gram *(Normal > 2500 g)*
* **Panjang Badan Lahir**: `49.5` cm
* **Lingkar Kepala**: `34.0` cm
* **Usia Gestasi saat Lahir**: `39` Minggu *(Cukup Bulan)*
* **Inisiasi Menyusu Dini (IMD)**: `Ya, Berhasil (< 1 Jam)`
* **Catatan Klinis**: `Refleks hisap bayi baik, tangisan kuat, tidak ada ikterus.`
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

##### 2. Kunjungan Fase 3: Baduta 6 Bulan (Hari ke-452 HPK / Awal MP-ASI)
* **Pilih Pasien**: `David Wenas`
* **Tanggal Kunjungan**: `2025-05-01`
* **Fase**: `3. Fase Baduta (1-24 Bulan)`
* **Usia Anak**: `6` Bulan
* **Berat Badan**: `7.8` kg
* **Panjang Badan**: `67.5` cm *(PB/U Z-score: +0.20 SD $\rightarrow$ Normal)*
* **Lingkar Kepala**: `43.0` cm
* **Tren Berat Badan KMS**: `Naik (N)`
* **Status Pemberian Makan**: `Mulai MP-ASI + ASI Eksklusif`
* **Vitamin A**: `Belum Waktunya (Usia < 6 Bulan Saat Distribusi)`
* **Status Imunisasi**: `Lengkap Sesuai Usia`
* **Catatan Klinis**: `Mulai perkenalan makanan lumat kaya protein hewani.`
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

##### 3. Kunjungan Fase 3: Baduta 12 Bulan (Hari ke-635 HPK / Evaluasi 1 Tahun)
* **Pilih Pasien**: `David Wenas`
* **Tanggal Kunjungan**: `2025-11-01`
* **Fase**: `3. Fase Baduta (1-24 Bulan)`
* **Usia Anak**: `12` Bulan
* **Berat Badan**: `9.8` kg
* **Panjang Badan**: `76.0` cm *(PB/U Z-score: +0.12 SD $\rightarrow$ Normal)*
* **Lingkar Kepala**: `46.0` cm
* **Tren Berat Badan KMS**: `Naik (N)`
* **Status Pemberian Makan**: `MP-ASI Adekuat + ASI`
* **Vitamin A**: `Sudah Diberikan (Kapsul Merah)`
* **Status Imunisasi**: `Lengkap Sesuai Usia`
* **Catatan Klinis**: `Anak sudah bisa berdiri mandiri, pertumbuhan motorik sesuai usia.`
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

##### 4. Kunjungan Fase 3: Puncak Hari ke-1.000 HPK (Usia Tepat 24 Bulan / Target Kelulusan)
* **Pilih Pasien**: `David Wenas`
* **Tanggal Kunjungan**: `2026-11-01` *(Tepat hari ini)*
* **Fase**: `3. Fase Baduta (1-24 Bulan)`
* **Usia Anak**: `24` Bulan *(Tepat 730 hari paska-lahir + 270 hari kandungan = 1.000 Hari)*
* **Berat Badan**: `12.3` kg
* **Panjang/Tinggi Badan**: `87.8` cm *(PB/U Z-score: +0.18 SD $\rightarrow$ Normal)*
* **Lingkar Kepala**: `48.5` cm
* **Tren Berat Badan KMS**: `Naik (N)`
* **Status Pemberian Makan**: `Makanan Keluarga Seimbang + ASI Lanjutan`
* **Vitamin A**: `Sudah Diberikan (Kapsul Merah)`
* **Status Imunisasi**: `Lengkap Sesuai Usia`
* **Catatan Klinis**: `Anak lulus 1.000 HPK dengan status gizi normal dan kurva tumbuh kembang optimal.`
* **Hasil Multi-Agent AI**: Status `KONDISI_BAIK`, memunculkan paket kelulusan: **Lulus Optimal: Pertumbuhan Normal Bebas Stunting**!
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

---

## 📍 POSYANDU 2: Posyandu Melati (Kelurahan Airmadidi Bawah)
> **Fokus Uji**: **Kasus Stunting Berat (PB/U < -3 SD)**, Ibu Hamil KEK + Anemia, dan Deteksi Kontinuitas Maternal.

### Pasien 3 (Ibu Hamil KEK & Anemia): Ny. Sintia Pangemanan
#### A. Registrasi Pasien Baru (`/kader/input-kunjungan` $\rightarrow$ tombol `+ Pasien Baru`)
* **Tipe Pasien**: `Ibu Hamil`
* **NIK**: `7106024806000001`
* **Nama Lengkap**: `Ny. Sintia Pangemanan`
* **Tanggal Lahir**: `2000-06-08`
*(Klik Simpan Pasien)*

#### B. Rekam Kunjungan ANC Ibu Hamil
* **Pilih Pasien**: `Ny. Sintia Pangemanan`
* **Tanggal Kunjungan**: `2026-11-01`
* **Fase**: `1. Fase Kehamilan (Ibu Hamil)`
* **Usia Kehamilan**: `26` Minggu | **Trimester**: `2`
* **Berat Badan Ibu**: `44.0` kg
* **Tinggi Badan Ibu**: `143.5` cm *(Risiko $\le$ 145 cm)*
* **LiLA**: `21.0` cm *(Terdeteksi KEK < 23.5 cm)*
* **Kadar Hb**: `9.5` g/dL *(Terdeteksi Anemia < 11.0 g/dL)*
* **Tekanan Darah**: `105` / `65` mmHg
* **Kepatuhan TTD**: `Tidak Rutin / Belum Minum`
* **KSPR**: Centang `Terlalu pendek, tinggi <= 145 cm (Skor 4)` dan `Kurang darah / Anemia (Skor 4)`
* **Catatan Klinis**: `Nafsu makan sangat rendah, pusing, dan tampak pucat.`
* **Hasil Multi-Agent**: Status `PERLU_PERHATIAN`, deteksi KEK, Anemia, dan rekomendasi PMT KEK resmi Buku KIA.
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

---

### Pasien 4 (Anak Stunting Kronis): Giselle Pangemanan (P)
#### A. Registrasi Pasien Baru (`/kader/input-kunjungan` $\rightarrow$ tombol `+ Pasien Baru`)
* **Tipe Pasien**: `Anak / Bayi`
* **NIK**: `7106025510250001`
* **Nama Lengkap**: `Giselle Pangemanan`
* **Tanggal Lahir**: `2025-10-15`
* **Jenis Kelamin**: `Perempuan`
* **Ibu Kandung**: Pilih `Ny. Sintia Pangemanan (NIK: 7106024806000001)`
*(Klik Simpan Pasien)*

#### B. Rekam Kunjungan Baduta 12 Bulan (Kasus Stunting Berat)
* **Pilih Pasien**: `Giselle Pangemanan`
* **Tanggal Kunjungan**: `2026-11-01`
* **Fase**: `3. Fase Baduta (1-24 Bulan)`
* **Usia Anak**: `12` Bulan
* **Berat Badan**: `6.7` kg *(Sangat Kurang)*
* **Panjang/Tinggi Badan**: `65.5` cm *(PB/U Z-score: -3.61 SD $\rightarrow$ Stunting Berat / Sangat Pendek)*
* **Lingkar Kepala**: `42.0` cm
* **Tren Berat Badan KMS**: `Tidak Naik (T)`
* **Status Pemberian Makan**: `MP-ASI Kurang Adekuat`
* **Vitamin A**: `Belum Diberikan`
* **Status Imunisasi**: `Belum Lengkap`
* **Catatan Klinis**: `Anak sering sakit demam/batuk, nafsu makan minim, berat tidak naik 3 bulan.`
* **Hasil Multi-Agent**:
  * Status: **Risiko Tinggi**
  * Flag: `RISIKO_STUNTING_BERAT`
  * Kontinuitas Maternal: Sistem mengenali ibu kandung (`Ny. Sintia`) memiliki riwayat KEK & Anemia yang memperparah risiko pertumbuhan linier.
  * Rekomendasi: Rujukan segera ke Puskesmas Airmadidi untuk tata laksana Stunting & Susu PKMK padat kalori (sitasi PNPK Stunting KMK 1928/2022).
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

---

## 📍 POSYANDU 3: Posyandu Anggrek (Kelurahan Sarongsong Satu)
> **Fokus Uji**: Kasus **Bayi Berat Lahir Rendah (BBLR)**, Neonatus Kurang Bulan, dan Ibu Hamil Sehat.

### Pasien 5 (Ibu Hamil Sehat): Ny. Priscilia Rotinsulu
#### A. Registrasi Pasien Baru (`/kader/input-kunjungan` $\rightarrow$ tombol `+ Pasien Baru`)
* **Tipe Pasien**: `Ibu Hamil`
* **NIK**: `7106036209990001`
* **Nama Lengkap**: `Ny. Priscilia Rotinsulu`
* **Tanggal Lahir**: `1999-09-22`
*(Klik Simpan Pasien)*

#### B. Rekam Kunjungan ANC Ibu Hamil
* **Pilih Pasien**: `Ny. Priscilia Rotinsulu`
* **Tanggal Kunjungan**: `2026-11-01`
* **Fase**: `1. Fase Kehamilan (Ibu Hamil)`
* **Usia Kehamilan**: `16` Minggu | **Trimester**: `2`
* **Berat Badan Ibu**: `56.0` kg
* **Tinggi Badan Ibu**: `158.0` cm
* **LiLA**: `26.5` cm *(Normal)*
* **Kadar Hb**: `12.5` g/dL *(Normal)*
* **Tekanan Darah**: `115` / `75` mmHg
* **Kepatuhan TTD**: `Rutin Minum Setiap Hari`
* **KSPR**: *(Tidak ada centang)*
* **Catatan Klinis**: `Pemeriksaan ANC rutin berjalan normal tanpa keluhan klinis.`
* **Hasil Multi-Agent**: Status `KONDISI_BAIK`.
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

---

### Pasien 6 (Neonatus BBLR): Bayi Rendy Rotinsulu (L)
#### A. Registrasi Pasien Baru (`/kader/input-kunjungan` $\rightarrow$ tombol `+ Pasien Baru`)
* **Tipe Pasien**: `Anak / Bayi`
* **NIK**: `7106031810260001`
* **Nama Lengkap**: `Bayi Rendy Rotinsulu`
* **Tanggal Lahir**: `2026-10-18`
* **Jenis Kelamin**: `Laki-laki`
* **Ibu Kandung**: Pilih `Ny. Priscilia Rotinsulu (NIK: 7106036209990001)`
*(Klik Simpan Pasien)*

#### B. Rekam Kunjungan Neonatal (Fase 2 BBLR)
* **Pilih Pasien**: `Bayi Rendy Rotinsulu`
* **Tanggal Kunjungan**: `2026-11-01` *(Usia 14 Hari)*
* **Fase**: `2. Fase Bayi Baru Lahir (0-28 Hari)`
* **Berat Lahir**: `2150` gram *(Terdeteksi BBLR < 2500 g)*
* **Panjang Badan Lahir**: `45.0` cm
* **Lingkar Kepala**: `31.5` cm
* **Usia Gestasi saat Lahir**: `35` Minggu *(Prematur / Kurang Bulan)*
* **Inisiasi Menyusu Dini (IMD)**: `Tidak / Tertunda Karena Asfiksia Ringan`
* **Catatan Klinis**: `Bayi lahir prematur dengan BBLR, daya hisap masih lemah, membutuhkan metode kanguru (KMC).`
* **Hasil Multi-Agent**:
  * Status: **Perlu Perhatian**
  * Flag: `RISIKO_BBLR_RINGAN`, `RISIKO_PREMATUR`
  * Rekomendasi: Perawatan Metode Kanguru (PMK), pemantauan termoregulasi, dan konsultasi laktasi intensif.
* *(Klik Analisis $\rightarrow$ Sahkan Laporan)*

---

## 📊 Matriks Verifikasi Hasil pada Dashboard & Monitoring

Setelah seluruh data di atas dimasukkan dan disahkan oleh kader masing-masing, berikut adalah hasil komparasi yang dapat Anda verifikasi:

| Halaman | Parameter yang Ditampilkan | Nilai yang Harus Muncul | Status Verifikasi |
| :--- | :--- | :--- | :--- |
| **Kader Mawar** | Total Pasien / Stunting | **2 Pasien** / **0 Stunting** (David Lulus Normal) | ✅ Bebas Stunting |
| **Kader Melati** | Total Pasien / Stunting | **2 Pasien** / **1 Kasus Stunting Berat** (Giselle) | ✅ 1 Stunting (100% anak) |
| **Kader Anggrek** | Total Pasien / Stunting | **2 Pasien** / **0 Stunting**, 1 Kasus BBLR | ✅ Terpantau BBLR |
| **Pusat Monitoring KIA** | Rekap Wilayah 9 Posyandu | Airmadidi Atas: 2, Airmadidi Bawah: 2, Sarongsong Satu: 2. Stunting: 1 kasus. | ✅ Real-time Lintas Posyandu |
| **Pop-up Monitoring** | Garis Waktu David Wenas | Tampil terpusat di layar: **Hari ke-1.000 / 1.000 HPK (100.0%)** | ✅ Lulus 1.000 HPK |
| **Admin Dashboard** | Total Pasien Terdaftar | **6 Pasien** | ✅ Akumulasi 3 Posyandu |
| **Admin Dashboard** | Kasus Stunting Terdeteksi | **1 Kasus** (Hanya Giselle di Airmadidi Bawah) | ✅ Tidak Terjadi Inflasi Data |
| **Admin Dashboard** | Ibu KEK / Anemia | **1 Kasus** (Hanya Ny. Sintia di Airmadidi Bawah) | ✅ Tepat Sesuai Hasil Pengukuran |
| **Admin Dashboard** | Laporan Tervalidasi | **9 Laporan** (1 ibu Mawar + 4 kunjungan David + 1 ibu Melati + 1 anak Melati + 1 ibu Anggrek + 1 anak Anggrek) | ✅ Seluruh Rekam Tersimpan |

