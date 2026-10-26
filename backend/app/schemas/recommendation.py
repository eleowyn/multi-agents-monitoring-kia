from typing import List, Optional, Union
from pydantic import BaseModel, Field


class CitationModel(BaseModel):
    source: str = Field(default="Buku KIA 2024 (Kemenkes RI)", description="Nama dokumen rujukan resmi (e.g. Buku KIA RI 2020, KMK No. 1928/2022)")
    section: Optional[str] = Field(default="", description="Nama bab atau bagian pedoman")
    page: Optional[Union[int, str]] = Field(default=1, description="Nomor halaman")
    chunk_id: Optional[str] = Field(default=None, description="ID chunk dari ChromaDB")


class RecommendationItem(BaseModel):
    title: str = Field(..., description="Judul ringkas rekomendasi atau intervensi")
    category: str = Field(
        default="EDUKASI",
        description="Kategori intervensi: GIZI, MEDIS, EDUKASI, RUJUKAN, NEONATAL, GIZI_MATERNAL"
    )
    recommendation_text: str = Field(..., description="Uraian rekomendasi tindakan praktis untuk kader")
    action_steps: List[str] = Field(default_factory=list, description="Langkah-langkah aksi konkret")
    citation: CitationModel = Field(..., description="Sitasi dokumen resmi")
