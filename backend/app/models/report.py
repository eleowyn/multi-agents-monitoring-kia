import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    kader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Hasil dari Agent 1 (Deteksi Risiko)
    risk_flags = Column(JSON, nullable=False)           # List[dict] flag risiko aktif
    risk_narrative = Column(Text, nullable=False)       # Narasi klinis deterministik
    
    # Hasil dari Agent 2 (Rekomendasi Klinis RAG)
    recommendations = Column(JSON, nullable=True)       # List[dict] rekomendasi klinis & sitasi
    
    # Hasil dari Agent 3 (Verifikasi & Laporan)
    verification_summary = Column(JSON, nullable=True)  # Status verifikasi sitasi per poin
    overall_status = Column(String(50), nullable=False) # e.g. "KONDISI_BAIK", "PERLU_INTERVENSI", "RISIKO_TINGGI"
    final_report_json = Column(JSON, nullable=False)    # Gabungan JSON komprehensif
    
    # Human-in-the-loop (Validasi Kader)
    status = Column(Enum(ReportStatus), default=ReportStatus.DRAFT, nullable=False)
    rejection_reason = Column(Text, nullable=True)      # Jika kader memilih REJECT
    revision_count = Column(Integer, default=0, nullable=False) # Maksimal 1 kali revisi
    validated_at = Column(DateTime(timezone=True), nullable=True)
    
    # File PDF
    pdf_path = Column(String(255), nullable=True)

    # Relationships
    visit = relationship("Visit", back_populates="reports")
    patient = relationship("Patient", back_populates="reports")
    kader = relationship("User")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
