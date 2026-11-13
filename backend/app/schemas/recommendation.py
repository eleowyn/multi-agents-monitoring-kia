from typing import List, Optional, Union
from pydantic import BaseModel, Field


class CitationModel(BaseModel):
    """Sitasi diisi sistem dari metadata chunk ChromaDB, bukan ditulis LLM."""
    source: Optional[str] = Field(default=None, description="Sumber dokumen sesuai metadata chunk")
    section: Optional[str] = Field(default=None, description="Bagian/heading sesuai metadata chunk")
    page: Optional[Union[int, str]] = Field(default=None, description="Halaman PDF sesuai metadata chunk")
    chunk_id: Optional[str] = Field(default=None, description="ID chunk ChromaDB")
    origin: Optional[str] = Field(default=None, description="MARKDOWN_DOC | PDF | CURATED_SUMMARY")
    derived_from: Optional[str] = Field(default=None, description="Dokumen asal ringkasan terkurasi")


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
        description="Wawasan klinis tambahan dari sintesis LLM (dipisahkan tegas dari pedoman resmi RAG)",
    )
    evidence_quote: Optional[str] = Field(
        default=None,
        description="Isi chunk asli yang dirujuk (diisi sistem, verbatim dari ChromaDB)",
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
