from typing import TypedDict, List, Dict, Any, Optional


class AgentState(TypedDict):
    """
    Shared State Memory yang mengalir dan diperbarui oleh seluruh
    agent dalam graf LangGraph (StateGraph).
    """
    # 1. Input Kunjungan & Pasien
    patient_id: int
    visit_id: Optional[int]
    patient_data: Dict[str, Any]       # NIK, Nama, Tanggal Lahir, Jenis Kelamin, dsb.
    visit_data: Dict[str, Any]         # Data pengukuran klinis fase saat ini
    phase: str                         # "IBU_HAMIL" | "BAYI_BARU_LAHIR" | "BADUTA"
    
    # 2. Longitudinal Memory Context (Riwayat Kunjungan & Riwayat Ibu)
    longitudinal_history: List[Dict[str, Any]]
    maternal_history: Optional[Dict[str, Any]] # Khusus anak: riwayat ibu saat hamil/melahirkan
    
    # 3. Output dari Agent 1: Deteksi Risiko
    risk_flags: List[Dict[str, Any]]   # Daftar flag aktif (e.g. RISIKO_STUNTING, RISIKO_KEK)
    risk_narrative: str                # Narasi deskriptif temuan klinis
    deterministic_results: Dict[str, Any] # Rincian angka baku Z-score, KSPR, dsb.
    requires_rag: bool                 # Flag routing kondisional apakah perlu panggil Agent 2
    narrative_mode: str                # "LLM" (Stage 2 Gemini) | "MODE_FALLBACK" (narasi berbasis aturan)
    
    # 4. Output dari Agent 2: Rekomendasi Klinis RAG
    recommendations: List[Dict[str, Any]] # Daftar rekomendasi klinis terstruktur & sitasi
    retrieved_chunks: List[Dict[str, Any]] # Potongan dokumen rujukan Buku KIA / PNPK
    
    # 5. Output dari Agent 3: Verifikasi & Laporan
    verification_details: List[Dict[str, Any]] # Status validasi grounding per rekomendasi
    overall_status: str                # "KONDISI_BAIK" | "PERLU_PERHATIAN" | "RISIKO_TINGGI"
    final_report_json: Dict[str, Any]  # Ringkasan laporan terstruktur final
    
    # 6. Human-in-the-loop & Iteration Control
    iteration_count: int               # Jumlah pengulangan jika ditolak kader (maksimal 1x loop)
    kader_feedback: Optional[str]      # Catatan perbaikan dari kader jika ditolak
    is_approved_by_kader: Optional[bool]

