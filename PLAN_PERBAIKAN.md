# Plan Perbaikan Sistem Multi-Agent KIA 1.000 HPK

Dokumen ini merangkum semua perubahan yang direncanakan berdasarkan audit kode terhadap skripsi
"Penerapan Multi-Agent AI untuk Monitoring KIA pada 1.000 HPK di Posyandu Airmadidi".
Patokannya adalah isi skripsi yang sudah ada: kode disesuaikan ke skripsi, bukan sebaliknya.
Butir yang menuntut perubahan teks skripsi ditandai **[ubah skripsi]**.

Status: **belum ada perubahan kode** selain bagian "Sudah dikerjakan" di akhir dokumen.

---

## Daftar isi

- [Bagian A: Chunk dan ChromaDB](#bagian-a-chunk-dan-chromadb)
- [Prioritas 1: Bertentangan langsung dengan skripsi](#prioritas-1-bertentangan-langsung-dengan-skripsi)
- [Prioritas 2: Logika alur 1.000 HPK dan human-in-the-loop](#prioritas-2-logika-alur-1000-hpk-dan-human-in-the-loop)
- [Prioritas 3: Grafik dan dashboard](#prioritas-3-grafik-dan-dashboard)
- [Prioritas 4: Keamanan akses](#prioritas-4-keamanan-akses)
- [Cakupan di luar prioritas](#cakupan-di-luar-prioritas)
- [Keputusan yang masih dibutuhkan](#keputusan-yang-masih-dibutuhkan)
- [Urutan pengerjaan](#urutan-pengerjaan)
- [Cara verifikasi](#cara-verifikasi)
- [Koreksi teks skripsi](#koreksi-teks-skripsi)
- [Sudah dikerjakan](#sudah-dikerjakan)

---

## Bagian A: Chunk dan ChromaDB

### Masalah yang ditemukan

Teks yang tampil sebagai "kutipan buku" sering bukan teks asli Buku KIA 2024 / PNPK 2022. Penyebabnya:

| No | Penyebab | Lokasi |
|---|---|---|
| A1 | 6 ringkasan buatan peneliti dimasukkan ke ChromaDB dengan label sumber "Buku KIA 2024 (Kemenkes RI)" / PNPK beserta nomor halaman, dan dikomentari "Verbatim Murni". Hasil pencocokan dengan file buku: hanya ringkasan PNPK "Pencegahan primer…" yang asli. Kalimat "batas LiLA kurang dari 23,5 cm…", "minimal 90 tablet…", "minimal 6 kali selama kehamilan…" tidak ada di buku. Skripsi 1.5.1 no.10 mewajibkan label "Ringkasan Terkurasi Peneliti". | `backend/app/multiagent/rag/ingest.py` (`DEFAULT_CLINICAL_GUIDELINES`) |
| A2 | Kutipan ditulis oleh LLM, bukan diambil dari chunk. Agent 2 diminta mengeluarkan "kutipan kalimat asli", Agent 3 (LLM-judge) juga menulis `evidence_quote` sendiri. Tidak pernah dicek apakah teksnya ada di chunk. | `recommender.py`, `verifier.py`, `prompts/recommender_prompt.py`, `prompts/verifier_prompt.py` |
| A3 | Kutipan cadangan generik ditempel berdasarkan kata kunci bila kutipan kosong. | `recommender.py` (fallback `DEFAULT_CLINICAL_GUIDELINES`), `reports.py` (`_enrich_evidence_quotes`), `ValidasiLaporan.jsx` baris ±1613 (teks hardcode "…Buku KIA Hal. 32"), `doctor.py` `/report-citations` (memakai `recommendation_text` sebagai kutipan) |
| A4 | ChromaDB berisi chunk lama dari dokumen lain (Gambar 92 skripsi menampilkan sumber "Buku KIA Kesehatan Ibu Hamil Kemenkes RI 2020" dengan teks rusak). Kemungkinan besar dari koleksi lama `kia_guidelines`. Retriever memakai koleksi lama bila embedding Gemini gagal, dan **selalu** bila `LLM_PROVIDER` = KoboiLLM. Ingest hanya menambah, tidak menghapus ID usang. | `rag/retriever.py`, `rag/vectorstore.py`, `rag/ingest.py` |
| A5 | Isi chunk dari file buku masih kotor. Simulasi: Buku KIA 554 chunk, 408 mengandung penanda "KIA 2024 Book 2.17.5 N", timestamp cetak, tag HTML (`<span>`, `<td>`), atau `~~coretan~~`. 124 chunk Buku KIA dan 69 chunk PNPK terpotong di tengah kata (dipotong per 1.000 karakter). Nomor halaman bisa meleset satu halaman. | `ingest.py` (`chunk_markdown_file`) |
| A6 | Halaman "Koleksi Rujukan & Chunks RAG" membaca chunk dari file (`_collect_documents`), bukan dari ChromaDB, sehingga bisa berbeda dengan chunk yang benar-benar dipakai agent. | `ingest.get_all_knowledge_chunks`, `doctor.py` `/knowledge-chunks`, `AdminKnowledgeChunks.jsx` |
| A7 | Rekomendasi aturan sistem diberi sitasi palsu: rekomendasi kelulusan 1.000 HPK hardcode dengan `page: 1`, sitasi berbentuk string diubah jadi `page: 1`, fallback berbasis aturan memakai "Buku KIA RI (2024)" halaman 1 bila tidak ada chunk cocok. | `recommender.py` |

### Tahap A-1: Chunk diambil persis dari buku

File: `backend/app/multiagent/rag/ingest.py`

- Buang hanya artefak non-isi:
  - penanda halaman `KIA 2024 Book 2.17.5 N` dan baris timestamp cetak (`10/24/24 01:20`);
  - referensi gambar `![...](...)`;
  - tag HTML (teks di dalam tag tetap dipertahankan);
  - tanda `~~` (lihat keputusan K2).
- Kata-kata buku **tidak diubah**: tidak ada parafrase, tidak ada penambahan kalimat.
- Pemotongan di batas paragraf/kalimat dengan target ±800 karakter (sesuai `RAG_CHUNK_SIZE` di Tabel 26), tanpa memotong kata. Tabel dan daftar tetap utuh.
- Nomor halaman = penanda halaman tempat kalimat pertama chunk berada. Label di metadata dan tampilan: "Halaman PDF".
- Metadata tetap sesuai Tabel 26: ID chunk, sumber dokumen, bagian (heading terdekat), halaman, kategori, asal chunk.
- Test baru: setiap chunk harus merupakan potongan asli dari file (setelah artefak dibuang). Test gagal bila ada teks yang tidak ditemukan di sumber.

### Tahap A-2: Ringkasan terkurasi

File: `ingest.py`. Tergantung keputusan K1:

- **(a)** Dipertahankan, sumber diganti menjadi "Ringkasan Terkurasi Peneliti (disarikan dari Buku KIA 2024 / PNPK 2022)", tanpa nomor halaman buku, `origin = CURATED_SUMMARY`. Komentar "Verbatim Murni" dihapus. Di tampilan diberi label jelas sehingga tidak dikira kutipan buku. Sesuai skripsi 1.5.1 no.10 dan Tabel 26.
- **(b)** Dikeluarkan dari ChromaDB sehingga isi koleksi 100% teks buku. **[ubah skripsi]** 1.5.1 no.10 dan Tabel 26 (baris "Dokumen").

### Tahap A-3: ChromaDB dibangun ulang dari nol

Files: `ingest.py`, `vectorstore.py`, `retriever.py`, skrip baru `backend/scripts/rebuild_chroma.py`

- Hapus koleksi `kia_guidelines_v2` dan `kia_guidelines`, lalu ingest ulang hanya dari 2 file di `knowledge_base/` (+ ringkasan terkurasi bila K1 = a).
- Ingest menghapus ID yang tidak lagi dihasilkan dari file, sehingga tidak ada chunk usang.
- Koleksi cadangan offline dibangun dari chunk yang **sama persis** (ID, teks, metadata sama), hanya embedding-nya lokal. Sumber tetap Buku KIA 2024 / PNPK 2022.
- `retriever.py`: catat di setiap chunk koleksi mana yang dipakai (`retrieval_mode`) dan tampilkan di audit, supaya terlihat bila sistem berjalan dengan koleksi cadangan.
- Skrip rebuild membutuhkan `GEMINI_API_KEY` dan dijalankan di mesin yang punya folder `chroma_db/` (lihat keputusan K3). Perkiraan ±680 embedding.
- Ganti nama file `Buku_KIA_2024 (1).md` menjadi `Buku_KIA_2024.md` (opsional, agar rapi; prefix ID chunk tidak berubah karena ditentukan dari kata "kia").

### Tahap A-4: Kutipan selalu teks asli chunk

Files: `recommender.py`, `verifier.py`, `prompts/recommender_prompt.py`, `prompts/verifier_prompt.py`, `reports.py`, `doctor.py`, `ValidasiLaporan.jsx`

- **Agent 2**: LLM cukup memilih `chunk_id` dari chunk yang diberikan. `evidence_quote`, `citation.source`, `citation.section`, `citation.page` diisi **oleh sistem** dari isi dan metadata chunk tersebut apa adanya.
  - Bila `chunk_id` tidak valid / tidak ada di `retrieved_chunks`: rekomendasi ditandai "tanpa kutipan", tidak diberi halaman 1 dan tidak diberi chunk default.
  - Prompt diubah: tidak lagi meminta LLM menulis kutipan, hanya `chunk_id`.
- **Agent 3**: bukti yang ditampilkan adalah isi chunk asli. Keluaran LLM-judge (`reasoning`, `grounding_score`) disimpan sebagai catatan alasan, bukan sebagai kutipan.
- Hapus semua pengisian kutipan generik:
  - fallback `DEFAULT_CLINICAL_GUIDELINES` di `recommender.py`;
  - fungsi `_enrich_evidence_quotes` di `reports.py`;
  - teks hardcode di `ValidasiLaporan.jsx` (±baris 1613);
  - fallback `recommendation_text` sebagai kutipan di `doctor.py` `/report-citations`.
- Hapus `ai_insight` generik yang ditempel otomatis (di `recommender.py` dan `reports.py`). `ai_insight` hanya ada bila memang ditulis LLM.
- Rekomendasi aturan sistem (kelulusan 1.000 HPK, fallback `_generate_rule_based_recommendations`) diberi label "Rekomendasi aturan sistem". Kutipan hanya dilampirkan bila ada chunk nyata yang cocok, bukan sitasi halaman 1.

### Tahap A-5: Pisahkan kutipan dan analisis di tampilan

Files: `ValidasiLaporan.jsx`, `templates/report_kader.html`, `AdminKnowledgeChunks.jsx`, `ingest.get_all_knowledge_chunks`

- Laporan web dan PDF memisahkan:
  - **"Kutipan Asli Dokumen"**: teks verbatim chunk + sumber + bagian + Halaman PDF + ID chunk;
  - **"Analisis/Saran AI"**: teks hasil LLM.
- Halaman Koleksi Rujukan membaca isi ChromaDB langsung (`collection.get`), sehingga sama dengan yang dipakai agent. Endpoint tetap di `doctor.py` (bagian dokter tidak dihapus).

### Tahap A-6: Data laporan lama

Files: `reports.py`, `doctor.py`

- Laporan lama menyimpan kutipan versi lama di database. Isinya **tidak diubah diam-diam**.
- Saat ditampilkan, kutipan yang tidak ditemukan di chunk ChromaDB baru diberi tanda "Kutipan versi lama, belum terverifikasi terhadap chunk asli".

---

## Prioritas 1: Bertentangan langsung dengan skripsi

### P1-1. Evaluator gagal dicatat `NULL`, bukan "Patuh"

Rujukan skripsi: Bab 5.1.21, 5.1.22.

- `backend/app/services/eval_logger.py` (`_evaluate_single_agent_worker`): nilai awal `is_compliant = None`. Bila LLM offline, error, atau JSON tidak berisi `is_compliant`, tetap `None`.
- `backend/app/api/v1/endpoints/admin.py` (`get_audit_logs`): kirim `r.is_compliant` apa adanya (hapus `else True`). Schema `AuditLogResponse.is_compliant` menjadi `Optional[bool]`.
- `backend/app/api/v1/endpoints/reports.py` (`_enrich_report_telemetry`, bagian `parallel_evaluator_logs`): sama, tidak mengubah `NULL` jadi `True`.
- `frontend/src/pages/admin/AuditLogs.jsx`: lencana "Tidak dievaluasi" untuk `null`.

### P1-2. Verifikasi cadangan Agent 3 dinilai ulang dengan benar

Rujukan skripsi: Bab 4.2.2, 1.5.2 no.1.

- `backend/app/multiagent/agents/verifier.py`:
  - Chunk hasil pencarian cadangan dinilai lagi oleh LLM-judge (langkah kedua).
  - Bila LLM tidak tersedia: cek leksikal memakai **sitasi asli rekomendasi**, bukan sitasi yang diambil dari chunk itu sendiri (penyebab skor selalu ≥ 0,5).
  - Hapus pembulatan paksa `max(0.70, …)` pada skor.
  - Bila judge tidak mengembalikan `is_grounded`, anggap belum terverifikasi (bukan default `True`).
  - Status `UNVERIFIED` dapat muncul sesuai rancangan. Batas dua langkah per poin tetap dipertahankan.
- Bukti masalah: rekomendasi "susu formula" yang dicocokkan dengan chunk imunisasi mendapat skor 0,8 dan status `AUTO_GROUNDED_SECONDARY`.
- Test baru untuk kasus rekomendasi tidak relevan → `UNVERIFIED`.

### P1-3. Riwayat ibu dibatasi ke kehamilan anak tersebut

Rujukan skripsi: Bab 2.4.3, 2.9.1, batasan 1.5.2 no.2.

- `backend/app/multiagent/state_builder.py` (`build_maternal_history`): kunjungan ibu yang dipakai hanya `visit_date <= patient.birth_date` milik anak tersebut. KEK/anemia/KSPR kehamilan berikutnya tidak lagi diturunkan ke anak yang sudah lahir.
- Test baru di `tests/test_1000_hpk_longitudinal.py`: ibu dengan dua kehamilan, anak pertama tidak mewarisi risiko kehamilan kedua.

### P1-4. Kutipan bukti tidak boleh diisi teks generik

Rujukan skripsi: Bab 2.4.1, NFR 4.1.1c (ketertelusuran), 1.5.1 no.10.

- Dikerjakan melalui **Tahap A-4** di atas (hapus `_enrich_evidence_quotes`, fallback `DEFAULT_CLINICAL_GUIDELINES`, teks hardcode frontend, dan fallback di `/report-citations`).
- Ringkasan terkurasi hanya boleh muncul bila memang hasil retrieval dan berlabel "Ringkasan Terkurasi Peneliti" (Tahap A-2).

### P1-5. Telemetri tidak direkayasa

Rujukan skripsi: Bab 5.3, Tabel 23.

- `backend/app/api/v1/endpoints/reports.py` (`_enrich_report_telemetry`): hapus pembuatan timestamp (185 ms, 540 ms, dst.) dan token sintetis untuk laporan yang tidak punya telemetri. Hapus juga daftar evaluator paralel palsu bila tabel `audit_logs` kosong.
- `backend/app/api/v1/endpoints/admin.py` (`get_audit_logs`): hapus nilai cadangan `spawned_at`, `terminated_at`, `lifetime_ms`, dan `token_usage` hasil estimasi panjang teks.
- Bila data tidak ada, kirim `null` dan tampilkan "tidak tercatat" di `AuditLogs.jsx` dan `ValidasiLaporan.jsx`.
- Estimasi token (`TOKENIZER_ESTIMATE`) dari `llm_utils.extract_token_usage` tetap boleh dipakai saat API tidak mengirim metadata, tapi sumbernya harus terlihat di tampilan.

---

## Prioritas 2: Logika alur 1.000 HPK dan human-in-the-loop

### P2-6. Validasi fase terhadap pasien

Rujukan skripsi: Bab 1.5.1 no.2 dan no.5, Bab 2.1.2.

- `backend/app/api/v1/endpoints/visits.py`: tolak (422) bila
  - `IBU_HAMIL` untuk pasien CHILD;
  - `BAYI_BARU_LAHIR` / `BADUTA` untuk pasien MOTHER;
  - `BAYI_BARU_LAHIR` untuk anak berumur > 28 hari pada tanggal kunjungan;
  - `BADUTA` untuk anak berumur > 24 bulan, dengan pesan "Anak sudah melewati periode 1.000 HPK";
  - tanggal kunjungan sebelum tanggal lahir anak.
- `frontend/src/pages/kader/InputKunjungan.jsx`: tab fase yang tidak sesuai tipe/umur pasien dinonaktifkan. Umur tidak lagi dipotong diam-diam ke 24 bulan (`Math.min(24, …)`), melainkan menampilkan peringatan.

### P2-7. Kunjungan tidak tertinggal tanpa laporan

Rujukan skripsi: Bab 4.2.2 (early exit).

- `visits.py`: bungkus `kia_multiagent_app.invoke` dengan `try/except`. Bila graf error, hapus kunjungan yang baru disimpan dan kembalikan pesan error yang jelas.

### P2-8. Kunci status laporan

Rujukan skripsi: Bab 4.1.3.3, 5.1.8.

- `reports.py` (`validate_report_by_kader`): approve/reject hanya untuk laporan berstatus DRAFT. Laporan APPROVED hanya bisa diubah lewat pengajuan revisi ke admin (pesan 400 bila dicoba).

### P2-9. Revisi admin menangani data tidak wajar

Rujukan skripsi: Bab 1.5.1 no.11, 4.2.2.

- `backend/app/api/v1/endpoints/revisions.py` (`validate_revision_by_admin`):
  - Jalankan `check_visit_plausibility` terhadap data usulan sebelum disimpan.
  - Bila re-analisis berhenti di Agent 1 (`is_data_plausible = False`), batalkan persetujuan (rollback) dan kembalikan daftar peringatan ke admin. Laporan tidak boleh dikosongkan.
  - Validasi tipe nilai usulan (angka, tanggal) sebelum `setattr`.

### P2-10. Analisis ulang memakai state bersih

Rujukan skripsi: Bab 4.2.3 no.3 (graf dijalankan ulang dari awal).

- `reports.py` (reject kader) dan `revisions.py` (revisi admin): pakai `thread_id` baru, misalnya `visit_{id}_r{n}`, atau isi semua field `AgentState` di `build_initial_state`, supaya `agent_telemetry`, `care_plan`, `recommender_mode`, `verifier_mode`, `thought_process` dari analisis sebelumnya tidak terbawa.
- Tambah kasus di `tests/test_langgraph_checkpointer.py`: analisis ulang lewat fast-path tidak lagi memuat telemetri Agent 2 lama.

### P2-11. Angka HPK tidak dikarang saat data kosong

Rujukan skripsi: Bab 2.1.2, 4.1.1e.

- `backend/app/multiagent/tools/hpk_tracker.py` (`calculate_1000_hpk_status`):
  - Ibu tanpa usia kehamilan dan tanpa trimester → status "belum ada data kunjungan" (bukan hari ke-140).
  - Ibu dengan trimester saja → tandai "perkiraan dari trimester", bukan angka pasti.
  - Anak tanpa tanggal lahir dan tanpa umur → tidak diasumsikan 12 bulan / 7 hari.
  - Umur anak dihitung dari tanggal lahir. Bila isian umur kader berbeda > 1 bulan dari tanggal lahir, tambahkan peringatan dan pakai tanggal lahir.
- `risk_detector.py`: hapus default `age_months = 12` dan `trimester = 1`; bila kosong, indikator terkait dilewati dengan catatan.
- `patients.py` (`_enrich_patient`): pasien tanpa kunjungan tidak diberi angka HPK karangan.

### P2-12. Ibu yang sudah melahirkan tidak lagi tercatat hamil

Rujukan skripsi: Bab 2.4.3 (kontinuitas lintas fase).

- `patients.py` (`_enrich_patient`): bila ibu punya anak dengan tanggal lahir setelah kunjungan kehamilan terakhirnya, status HPK ibu = "Kehamilan selesai, pemantauan dilanjutkan pada anak [nama]".
- `HpkTimelineStepper.jsx` / `MonitoringKia.jsx` / `DataPasien.jsx`: tampilkan status tersebut.

### P2-13. Status keparahan BBLSR/BBLER

Rujukan skripsi: Bab 2.1.3, Tabel 30.

- `backend/app/multiagent/agents/verifier.py`: ganti pencarian kata "BERAT"/"BURUK"/"KRST" dengan daftar flag eksplisit. Masukkan `RISIKO_BBLSR` dan `RISIKO_BBLER` ke RISIKO_TINGGI, bersama `RISIKO_STUNTING_BERAT`, `RISIKO_UNDERWEIGHT_BERAT`, `RISIKO_GIZI_BURUK`, `RISIKO_ANEMIA_BERAT`, `RISIKO_KEHAMILAN_SANGAT_TINGGI_KRST`.

### P2-14. Ambang anemia persisten mengikuti trimester

Rujukan skripsi: Tabel 22 no.11.

- `backend/app/multiagent/agents/risk_detector.py` (`detect_maternal_longitudinal_trend`): pakai `classify_maternal_anemia` per kunjungan (ambang 10,5 g/dL di trimester 2), bukan angka tetap 11,0. Sama untuk `build_visit_comparison_summary` (status "ANEMIA").

---

## Prioritas 3: Grafik dan dashboard

Rujukan skripsi: Bab 5.1.2, 5.1.14, 5.1.15.

### P3-15. KEK/Anemia tidak dihitung ganda

- Bukti: Gambar 103/104, Airmadidi Bawah punya 1 ibu tapi KEK = 2 (flag anak `RIWAYAT_IBU_KEK` ikut terhitung).
- `admin.py` (`get_dashboard_summary`, tren bulanan), `kader.py` (`get_kader_dashboard_summary`), `patients.py` (`get_posyandu_aggregates`):
  - KEK/anemia hanya dari pasien MOTHER, dengan flag tepat `RISIKO_KEK_MATERNAL` dan `RISIKO_ANEMIA_RINGAN/SEDANG/BERAT`.
  - Stunting hanya dari pasien CHILD, flag `RISIKO_STUNTING` dan `RISIKO_STUNTING_BERAT`.
  - Tidak lagi memakai pencocokan substring.

### P3-16. Satu sumber hitungan untuk semua dashboard

- Buat satu modul agregat bersama (misalnya `backend/app/services/aggregates.py`) yang dipakai dashboard admin, tren bulanan admin, dashboard kader, dan Pusat Monitoring, sehingga angka yang sama selalu sama di semua halaman.
- Pencocokan desa memakai satu fungsi yang sama. Pasien dengan desa tidak dikenali masuk kategori "Lainnya", bukan Airmadidi Atas.

### P3-17. Hitungan memakai data yang sudah divalidasi

- Prevalensi stunting/KEK/anemia dihitung dari laporan APPROVED terakhir per pasien (sesuai kartu "Laporan Tervalidasi Kader"). Bila DRAFT ingin tetap ditampilkan, beri label terpisah "menunggu validasi".
- Ibu yang sudah melahirkan (P2-12) tidak dihitung sebagai "Ibu Hamil KEK/Anemia".

### P3-18. Kartu "Pantauan Berisiko" konsisten dengan radar

- Bukti: Gambar 85, kartu = 0 padahal Dewi Lestari tampil di radar.
- `kader.py`: hitung per pasien (laporan terakhir) dengan status RISIKO_TINGGI atau PERLU_PERHATIAN, sama dengan kriteria daftar radar.

### P3-19. Badge HPK di grafik tren per pasien

- `admin.py` (`get_patient_trend`) dan `backend/app/schemas/admin.py` (`PatientTrendResponse`): tambahkan `hpk_status` agar badge "Hari ke-X / 1.000 HPK" di `PatientTrendChart.jsx` tampil.

### P3-20. Tren KMS satu aturan

- `frontend/src/components/kader/KmsDigitalChart.jsx`: hapus aturan N/T "> 0,2 kg". Pakai kode KMS dari backend atau aturan yang sama dengan `detect_weight_faltering` (≤).
- Istilah "BGM" pada grafik PB/U diganti (BGM adalah istilah BB/U di KMS).

### P3-21. Hapus angka cadangan palsu

- `admin.py`: jumlah chunk `394` saat ChromaDB gagal → tampilkan "tidak terhubung". Status node pipeline diambil dari kondisi nyata (ChromaDB terbaca, API key tersedia), bukan selalu "ONLINE".
- `frontend/src/pages/kader/KaderDashboard.jsx`: jangan memakai `DEFAULT_NOVEMBER_2026_SCHEDULES` saat API jadwal gagal. Tampilkan pesan "gagal memuat jadwal".

### P3-22. Grounding rate

- Rujukan: Bab 5.1.6, 5.1.21.
- `admin.py`: hitung `VERIFIED` + `AUTO_GROUNDED_SECONDARY` dari laporan terakhir per kunjungan saja, sama dengan rumus pada laporan (`verifier.py`). Laporan lama yang sudah tergantikan tidak ikut dihitung.

---

## Prioritas 4: Keamanan akses

Rujukan skripsi: Bab 1.5.2 no.9, Tabel 14 dan Tabel 16.

### P4-23. Akses laporan dibatasi wilayah

- `reports.py`: `GET /reports/{id}`, `GET /reports/visit/{visit_id}`, dan `GET /reports/{id}/download-pdf` memeriksa wilayah kader (sama dengan `_is_patient_in_kader_scope`).
- Hapus fallback pencarian `visit_id` di `get_report` (bisa mengembalikan laporan pasien lain bila ID laporan tidak ada).

### P4-24. Pencocokan wilayah tepat

- Ganti pencocokan substring desa (contoh: "airmadidi" cocok ke Airmadidi Atas dan Bawah) dengan pencocokan persis setelah normalisasi, di `visits.py`, `reports.py`, `revisions.py`, `patients.py` (`get_patients`, `_is_patient_in_kader_scope`), dan `kader.py` (`_build_kader_scope_filter`).
- Pasien tanpa desa tidak otomatis bisa diakses semua kader.

### P4-25. Agregat posyandu khusus admin/dokter

- `patients.py` (`get_posyandu_aggregates`): batasi ke ADMIN dan DOKTER, sesuai Tabel 11 (kader hanya melihat posyandunya). Frontend sudah hanya memanggilnya untuk supervisor.

---

## Cakupan di luar prioritas

### C-26. Peran DOKTER dan portal dokter: **tidak dihapus**

Sesuai keputusan, `doctor.py`, `DoctorMonitoring.jsx`, ekspor LB3/Excel, seed user `dokter`, dan izin DOKTER di `revisions.py` dibiarkan. Endpoint `/doctor/knowledge-chunks` dan `/doctor/report-citations` tetap dipakai halaman admin dan ikut diperbaiki di Tahap A-4/A-5.

### C-27. Rating bintang laporan

`/reports/{id}/rate` dan tombol rating di `ValidasiLaporan.jsx` tidak dibahas di skripsi. Pilihan: dihapus, atau dibiarkan (keputusan K4).

### C-28. Tabel SD WHO

`backend/data_tables/who_*.json` dicocokkan ulang dengan tabel resmi WHO Child Growth Standards (median dan SD per bulan; BB/PB per 0,5 cm bila memungkinkan, saat ini per 5 cm). Rumus tetap linear sesuai 1.5.2 no.8.
Contoh dugaan selisih: PB/U laki-laki 12 bulan, SD di tabel 2,46, perkiraan WHO ±2,37.
Bila nilai berubah, angka di Tabel 37 no.1 (Z = −3,13) dan test terkait ikut disesuaikan.

### C-29. Kode minor yang ikut dirapikan

- `eval_logger.py`: hapus impor yang tidak lagi dipakai (`settings`, `llm_available`) setelah penghapusan fungsi mati.
- `admin.py` `/patient-trend` memakai pencocokan wilayah yang sama dengan endpoint lain (P4-24).
- KSPR (`tools/kspr.py`): `muda_hamil_1` dan `tua_hamil_lanjut` diberikan otomatis dari umur tanpa melihat urutan kehamilan. Dicatat sebagai keterbatasan; tidak diubah kecuali diminta.

---

## Keputusan yang masih dibutuhkan

| Kode | Pertanyaan | Pilihan |
|---|---|---|
| K1 | 6 ringkasan terkurasi | (a) dipertahankan dengan label "Ringkasan Terkurasi Peneliti", sesuai skripsi; (b) dikeluarkan dari ChromaDB **[ubah skripsi]** |
| K2 | Teks `~~coretan~~` hasil konversi | Buang tanda `~~` dan pertahankan katanya (usulan), atau buang kata yang dicoret. Cek beberapa contoh ke buku fisik. |
| K3 | Ingest ulang ChromaDB | Dijalankan sendiri di mesin yang punya `chroma_db/` dan `GEMINI_API_KEY` dengan skrip yang disiapkan, atau dijalankan bersama |
| K4 | Fitur rating bintang | Dihapus atau dibiarkan |

---

## Urutan pengerjaan

1. Tahap A-1 dan A-4 (chunk asli dan kutipan asli), beserta P1-4.
2. Tahap A-2, A-3, A-5, A-6 (setelah K1–K3 diputuskan).
3. P1-1, P1-2, P1-3, P1-5.
4. P3-15, P3-16, P3-17.
5. P2-6 sampai P2-14.
6. P3-18 sampai P3-22.
7. P4-23 sampai P4-25.
8. C-27, C-28, C-29.

---

## Cara verifikasi

- Pasang dependensi (`pip install -r backend/requirements.txt`, `npm install` di `frontend/`) dan jalankan seluruh test di `backend/tests/`.
- Test baru:
  - chunk verbatim terhadap file sumber (A-1);
  - kutipan rekomendasi sama dengan isi chunk yang dirujuk (A-4);
  - verifikasi cadangan menghasilkan `UNVERIFIED` untuk rekomendasi tidak relevan (P1-2);
  - riwayat ibu dua kehamilan (P1-3);
  - evaluator gagal tercatat `NULL` (P1-1);
  - validasi fase dan umur (P2-6), status laporan terkunci (P2-8), revisi dengan data tidak wajar (P2-9), state bersih saat analisis ulang (P2-10);
  - hitungan KEK tidak menyertakan anak (P3-15).
- Ke-14 kasus uji deterministik di Tabel 22 tetap harus lolos.
- Cek manual di browser: dashboard admin, Pusat Monitoring, dashboard kader menampilkan angka yang sama; halaman Koleksi Rujukan menampilkan chunk yang sama dengan kutipan di laporan.

---

## Koreksi teks skripsi

Ditemukan saat audit, tidak mengubah kode:

- 1.5.1 no.13 menyebut 14 desa, sedangkan 4.2.7.2 dan kode memakai 9 desa.
- 4.2.7.3 menjelaskan rumus LMS (SD1/SD1neg), sedangkan kode dan 1.5.2 no.8 memakai satu SD linear.
- Gambar 64 menulis `PARTIALLY_VERIFIED`, sedangkan kode memakai `AUTO_GROUNDED_SECONDARY`.
- Pembuka Bab 4.2 menyebut admin ikut menyetujui laporan, sedangkan sistem hanya meminta validasi kader.
- Gambar 92/93 menampilkan sumber "Buku KIA Kesehatan Ibu Hamil Kemenkes RI 2020" dan kutipan rusak; perlu diganti screenshot baru setelah Tahap A selesai.
- Gambar 88 menampilkan anak 24 bulan di tab Bayi Baru Lahir; perlu screenshot baru setelah P2-6.
- Gambar 103/104 menampilkan KEK terhitung ganda; perlu screenshot baru setelah P3-15.
- Bila K1 = (b): 1.5.1 no.10 dan Tabel 26.
- Bila C-28 mengubah nilai tabel WHO: Tabel 37 no.1.

---

## Sudah dikerjakan

Belum di-commit.

- Dihapus `backend/generated_reports/` (17 HTML berisi NIK pasien; folder ini sudah di `.gitignore` dan dibuat ulang otomatis oleh `pdf_service`).
- Dihapus `backend/scripts/sync_patient_territory.py` (memindahkan semua pasien ke desa demo).
- Dihapus fungsi mati `log_agent_evaluation` di `backend/app/services/eval_logger.py`.
- Dihapus endpoint duplikat `GET /patients/{id}/trend` (frontend memakai `/admin/patient-trend`) beserta impor schema yang tidak dipakai.
