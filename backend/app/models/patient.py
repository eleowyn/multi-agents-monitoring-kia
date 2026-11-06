import enum
from sqlalchemy import Column, Integer, String, Date, Float, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PatientType(str, enum.Enum):
    MOTHER = "MOTHER"
    CHILD = "CHILD"


class Gender(str, enum.Enum):
    MALE = "L"
    FEMALE = "P"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    nik = Column(String(16), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    patient_type = Column(Enum(PatientType), nullable=False)
    birth_date = Column(Date, nullable=False)
    gender = Column(Enum(Gender), nullable=True) # None for mother, L/P for child
    address = Column(String(255), nullable=True)
    phone_number = Column(String(20), nullable=True)
    village_name = Column(String(100), nullable=True)
    posyandu_name = Column(String(100), nullable=True)
    
    # Longitudinal link: Relasi Ibu ke Anak
    mother_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    mother = relationship("Patient", remote_side=[id], backref="children")

    # Hubungan dengan Kunjungan & Laporan
    visits = relationship("Visit", back_populates="patient", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="patient", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

