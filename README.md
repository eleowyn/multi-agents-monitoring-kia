# Sistem Multi-Agent AI untuk Monitoring KIA pada 1.000 HPK

### Lokus Studi Kasus: Posyandu Wilayah Kerja Puskesmas Kecamatan Airmadidi

Sistem pendukung keputusan klinis berbasis AI Agent kolaboratif (**LangGraph**), basis data vektor (**ChromaDB**), kalkulator medis deterministik baku (**Permenkes No. 2/2020, WHO Anthro, KSPR, Kemenkes RI**), dan antarmuka web modern (**React.js + Tailwind CSS**).

---

## 🏛️ Arsitektur Sistem

```
                      +-----------------------------+
                      |    React.js Web Frontend    |
                      |   (Dashboard Kader & Admin) |
                      +--------------+--------------+
                                     | (REST API / JWT)
                                     v
                      +-----------------------------+
                      |     FastAPI Backend Core    |
                      +--------------+--------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
    +-------------------+                         +-------------------+
    |  MySQL Database   |                         |  WeasyPrint PDF   |
    | (1000 HPK Memory) |                         |  Report Engine    |
    +-------------------+                         +-------------------+
              |
              v
+-------------------------------------------------------------------+
|               LangGraph Multi-Agent Orchestration                 |
|                                                                   |
|   [ Entry ]                                                       |
|       |                                                           |
|       v                                                           |
|  +--------------------+                                           |
|  |  Agent 1: Deteksi  | ---> Tools Deterministik (WHO, KSPR, Hb)  |
|  |      Risiko        | ---> Longitudinal State Memory            |
|  +---------+----------+                                           |
|            |                                                      |
|     (Ada Risiko?)                                                 |
|     /           \                                                 |
|  (Ya)          (Tidak / Kondisi Baik)                             |
|   /               \                                               |
|  v                 |                                              |
| +----------------+ |                                              |
| | Agent 2: RAG   | | ---> ChromaDB (Buku KIA & PNPK Stunting)     |
| | Rekomendasi    | | ---> Gemini 2.5 Flash API (Tersitasi)        |
| +--------+-------+ |                                              |
|          |         |                                              |
|          v         v                                              |
|  +--------------------+                                           |
|  | Agent 3: Verifikasi| ---> Citation Groundedness Check          |
|  |    dan Laporan     | ---> Single-pass Final JSON Report        |
|  +---------+----------+                                           |
|            |                                                      |
|            v                                                      |
|   [ Validasi Kader ]  <--- Human-in-the-loop (Approve / Reject)   |
|            | (Reject: 1x Loop Revisi)                             |
|            v (Approve: Simpan DB & Cetak PDF)                     |
|         [ Selesai ]                                               |
+-------------------------------------------------------------------+
```

---

## 🔑 Akun Bawaan (Default Demo Accounts)

| Peran (Role)        | Username | Password   | Keterangan                             |
| ------------------- | -------- | ---------- | -------------------------------------- |
| **Kader Posyandu**  | `kader1` | `kader123` | Posyandu Mawar, Kel. Airmadidi Atas    |
| **Admin Puskesmas** | `admin`  | `admin123` | Administrator Puskesmas Kec. Airmadidi |

---

## 🚀 Panduan Menjalankan Sistem

### 1. Menjalankan Backend (FastAPI - Port 8000)

Buka terminal PowerShell baru di folder project:

```powershell
cd c:\Users\ASUS\Documents\multiagentkia\backend
..\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

- **Swagger UI Dokumentasi API**: `http://127.0.0.1:8000/docs`
- **Health Check**: `http://127.0.0.1:8000/health`

### 2. Menjalankan Frontend (React.js Vite - Port 5173)

Buka terminal PowerShell kedua di folder project:

```powershell
cd c:\Users\ASUS\Documents\multiagentkia\frontend
npm run dev
```

- **Aplikasi Web**: Akses di browser pada `http://127.0.0.1:5173`

---

## 🧪 Menjalankan Seluruh Automated Tests

Untuk memvalidasi kebenaran seluruh formula medis deterministik, alur orkestrasi graf LangGraph, dan REST API endpoints:

```powershell
cd c:\Users\ASUS\Documents\multiagentkia\backend
..\venv\Scripts\python -m pytest tests/ -v
```

_(Seluruh 23 test case dirancang lulus 100%)._
