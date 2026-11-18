from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class CitationModel(BaseModel):
    """Sitasi diisi sistem dari metadata chunk ChromaDB, bukan ditulis LLM."""
    source: Optional[str] = Field(default=None, description="Sumber dokumen sesuai metadata chunk")
    section: Optional[str] = Field(default=None, description="Bagian/heading sesuai metadata chunk")
    page: Optional[Union[int, str]] = Field(default=None, description="Halaman PDF sesuai metadata chunk")
    chunk_id: Optional[str] = Field(default=None, description="ID chunk ChromaDB")
    origin: Optional[str] = Field(default=None, description="MARKDOWN_DOC | PDF | CURATED_SUMMARY")
    derived_from: Optional[str] = Field(default=None, description="Dokumen asal ringkasan terkurasi")
    additional_pages: Optional[List[Union[int, str]]] = Field(
        default=None, description="Daftar seluruh halaman relevan yang mendukung rekomendasi"
    )
    additional_sections: Optional[List[str]] = Field(
        default=None, description="Daftar seluruh bagian relevan yang mendukung rekomendasi"
    )
    supporting_chunk_ids: Optional[List[str]] = Field(
        default=None, description="Daftar seluruh ID chunk relevan dari ChromaDB"
    )
    supporting_chunks: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Daftar metadata chunk pendukung untuk inspeksi audit"
    )


class AiInsightDetailsModel(BaseModel):
    """Detail terstruktur Tambahan Analisis AI yang berlandaskan chunk Buku KIA / PNPK."""
    condition_explanation: Optional[str] = Field(
        default=None,
        description="Penjelasan klinis mengapa kondisi ibu/anak perlu ditindaklanjuti berdasarkan pedoman",
    )
    practical_tips: Optional[str] = Field(
        default=None,
        description="Tips mengatasi kendala praktis (GTM/susah makan/mual) dengan bahan pangan lokal",
    )
    counseling_script: Optional[str] = Field(
        default=None,
        description="Contoh kalimat edukasi empatik siap ucap kader ke ibu/keluarga",
    )
    source: Optional[str] = Field(default=None, description="Sumber dokumen resmi dari metadata chunk ChromaDB")
    section: Optional[str] = Field(default=None, description="Bagian/bab sesuai metadata chunk ChromaDB")
    page: Optional[Union[int, str]] = Field(default=None, description="Halaman PDF sesuai metadata chunk ChromaDB")
    chunk_id: Optional[str] = Field(default=None, description="ID chunk ChromaDB yang menjadi dasar")
    origin: Optional[str] = Field(default=None, description="MARKDOWN_DOC | PDF | CURATED_SUMMARY")
    supporting_sentence: Optional[str] = Field(
        default=None,
        description="Kalimat kutipan verbatim dari chunk ChromaDB yang menjadi dasar tambahan analisis AI",
    )


class RecommendationContentItem(BaseModel):
    """Satu butir isi rekomendasi dalam daftar gabungan (Rujukan vs Tambahan analisis AI)."""
    category: str = Field(
        default="UMUM",
        description="MAKANAN | SUSU_SUPLEMEN | STIMULASI_AKTIVITAS | LANGKAH_TINDAKAN | ANALISIS_TAMBAHAN",
    )
    label: str = Field(default="Panduan", description="Nama sub-bagian panduan")
    text: str = Field(..., description="Isi butir panduan atau tindakan")
    source_type: str = Field(
        default="RUJUKAN",
        description="RUJUKAN (dari dokumen rujukan) | ANALISIS_AI (Tambahan analisis AI) | ATURAN_SISTEM",
    )
    chunk_id: Optional[str] = Field(default=None, description="ID chunk yang menjadi dasar")
    basis_quote: Optional[str] = Field(
        default=None,
        description="Kalimat kutipan verbatim dari chunk atau data pasien yang menjadi dasar",
    )
    citation_label: Optional[str] = Field(
        default=None,
        description="Label sumber dan halaman (mis. Buku KIA 2024, Halaman PDF 18)",
    )


class RecommendationItem(BaseModel):
    title: str = Field(..., description="Judul ringkas rekomendasi atau intervensi")
    category: str = Field(
        default="EDUKASI",
        description="Kategori intervensi: GIZI, MEDIS, EDUKASI, RUJUKAN, NEONATAL, GIZI_MATERNAL",
    )
    recommendation_text: str = Field(
        ..., description="Uraian rekomendasi tindakan praktis utama untuk kader dan keluarga"
    )
    food_guide: Optional[str] = Field(
        default=None,
        description="Panduan spesifik makanan/MP-ASI yang dikonsumsi, tekstur, frekuensi, porsi, dan bahan lokal",
    )
    milk_and_supplements: Optional[str] = Field(
        default=None,
        description="Panduan pemberian ASI, susu (ibu hamil / PKMK / susu pertumbuhan), TTD, atau Vitamin A",
    )
    activity_and_stimulation: Optional[str] = Field(
        default=None,
        description="Panduan aktivitas fisik ibu hamil, perawatan neonatal (PMK), atau stimulasi tumbuh kembang anak sesuai usia",
    )
    action_steps: List[str] = Field(
        default_factory=list, description="Langkah-langkah aksi konkret bagi Kader Posyandu & Keluarga"
    )
    longitudinal_progress: Optional[str] = Field(
        default=None,
        description="Evaluasi perkembangan dibanding kunjungan sebelumnya (misal kenaikan BB/TB, perubahan status KMS)",
    )
    ai_insight: Optional[str] = Field(
        default=None,
        description="Wawasan klinis tambahan dari sintesis LLM (berlabel Tambahan analisis AI beserta dasarnya)",
    )
    ai_insight_basis: Optional[str] = Field(
        default=None,
        description="Dasar dari tambahan analisis AI (kutipan chunk yang dikembangkan atau parameter klinis pasien)",
    )
    ai_insight_details: Optional[AiInsightDetailsModel] = Field(
        default=None,
        description="Rincian terstruktur Tambahan Analisis AI (kondisi, tips lokal, kalimat edukasi) beserta rujukan Buku KIA/PNPK",
    )
    items: Optional[List[RecommendationContentItem]] = Field(
        default=None,
        description="Daftar gabungan butir isi rekomendasi beserta keterangan asal (RUJUKAN vs ANALISIS_AI)",
    )
    evidence_quote: Optional[str] = Field(
        default=None,
        description="Kalimat kutipan asli dari chunk yang mendukung rekomendasi (verbatim dari ChromaDB)",
    )
    evidence_status: Optional[str] = Field(
        default=None,
        description="CHUNK_DOKUMEN | RINGKASAN_TERKURASI | TANPA_KUTIPAN | ATURAN_SISTEM",
    )
    reasoning_mode: Optional[str] = Field(
        default="LLM_REACT",
        description="Mode inferensi: LLM_REACT (Penalaran AI + ChromaDB) atau FALLBACK_DETERMINISTIC (Safety Net Standar PNPK)",
    )
    thought_process: Optional[List[str]] = Field(
        default=None,
        description="Jejak langkah penalaran ReAct multi-hop",
    )
    citation: CitationModel = Field(..., description="Sitasi dokumen resmi")
