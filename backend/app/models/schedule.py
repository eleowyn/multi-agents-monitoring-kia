import enum
from sqlalchemy import Column, Integer, String, Date, Enum, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ScheduleStatus(str, enum.Enum):
    TERJADWAL = "TERJADWAL"
    SELESAI = "SELESAI"
    DIBATALKAN = "DIBATALKAN"


class PosyanduSchedule(Base):
    """
    Model Manajemen Jadwal Posyandu oleh Admin Puskesmas.
    Sesuai Bab 4 Skripsi:
    - Tabel 23 (Use Case Manajemen Jadwal Posyandu)
    - Gambar 36 (Activity Diagram Manajemen Jadwal Posyandu)
    - Gambar 53 (Sequence Diagram Manajemen Jadwal Posyandu)
    """
    __tablename__ = "jadwal_posyandu"

    id = Column(Integer, primary_key=True, index=True)
    village_name = Column(String(100), nullable=False, index=True)
    posyandu_name = Column(String(120), nullable=False, index=True)
    schedule_date = Column(Date, nullable=False, index=True)
    start_time = Column(String(10), nullable=False, default="08:00")
    end_time = Column(String(10), nullable=False, default="11:00")
    routine_pattern = Column(String(100), nullable=True)
    service_agenda = Column(String(255), nullable=False)
    kader_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    kader_name_fallback = Column(String(100), nullable=True)
    status = Column(Enum(ScheduleStatus), default=ScheduleStatus.TERJADWAL, nullable=False)
    notes = Column(Text, nullable=True, default="Wajib Membawa FC Kartu Keluarga")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    kader = relationship("User", foreign_keys=[kader_id])

