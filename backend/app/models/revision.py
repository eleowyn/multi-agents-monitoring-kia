import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RevisionStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class RevisionRequest(Base):
    """
    Model Pengajuan Revisi Data Kunjungan oleh Kader ke Admin Puskesmas.
    Sesuai Bab 4:
    - Tabel 16 (Use Case Ajukan Revisi Data Kunjungan)
    - Tabel 17 (Use Case Validasi Revisi Data)
    - Gambar 28 & 29 (Activity Diagram)
    - Gambar 44 & 45 (Sequence Diagram)
    - Gambar 52 (ERD Tabel pengajuan_revisi)
    """
    __tablename__ = "pengajuan_revisi"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=True)
    kader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    reason = Column(Text, nullable=False)               # Alasan revisi oleh kader
    proposed_data = Column(JSON, nullable=False)        # Data baru yang diusulkan
    previous_data = Column(JSON, nullable=True)         # Snapshot data kunjungan lama

    status = Column(Enum(RevisionStatus), default=RevisionStatus.PENDING, nullable=False)
    admin_notes = Column(Text, nullable=True)           # Catatan penjelasan oleh Admin

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    visit = relationship("Visit", back_populates="revisions")
    report = relationship("Report")
    kader = relationship("User", foreign_keys=[kader_id])
    admin = relationship("User", foreign_keys=[admin_id])


# Alias backward compatibility
Revision = RevisionRequest
