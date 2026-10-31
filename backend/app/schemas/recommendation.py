from typing import List, Optional, Union
from pydantic import BaseModel, Field


class CitationModel(BaseModel):
    source: str = Field(
        default="Buku KIA 2024 (Kemenkes RI)",
        description="Nama dokumen rujukan resmi (e.g. Buku KIA RI 2024, KMK No. 1928/2022)",
    )
    section: Optional[str] = Field(default="", description="Nama bab atau bagian pedoman")
    page: Optional[Union[int, str]] = Field(default=1, description="Nomor halaman")
    chunk_id: Optional[str] = Field(default=None, description="ID chunk dari ChromaDB")
    quote: Optional[str] = Field(default=None, description="Kutipan teks asli dari dokumen rujukan")


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
        description="Kutipan kalimat asli dari Buku KIA / PNPK Stunting sebagai bukti pendukung",
    )
    citation: CitationModel = Field(..., description="Sitasi dokumen resmi")
