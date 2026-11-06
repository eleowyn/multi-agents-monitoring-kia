import enum
from sqlalchemy import Column, Integer, String, Float, Date, Enum, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PhaseEnum(str, enum.Enum):
    IBU_HAMIL = "IBU_HAMIL"
    BAYI_BARU_LAHIR = "BAYI_BARU_LAHIR"
    BADUTA = "BADUTA"


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    kader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    visit_date = Column(Date, nullable=False)
    phase = Column(Enum(PhaseEnum), nullable=False)
    
    # ------------------ 1. FASE IBU HAMIL ------------------
    gestational_age_weeks = Column(Integer, nullable=True) # Usia kehamilan dalam minggu
    trimester = Column(Integer, nullable=True)             # 1, 2, 3
    maternal_weight_kg = Column(Float, nullable=True)      # Berat Badan Ibu
    maternal_height_cm = Column(Float, nullable=True)      # Tinggi Badan Ibu
    lila_cm = Column(Float, nullable=True)                 # Lingkar Lengan Atas (LiLA)
    hb_level = Column(Float, nullable=True)                # Hemoglobin (g/dL)
    systolic_bp = Column(Integer, nullable=True)           # Tekanan Darah Sistolik
    diastolic_bp = Column(Integer, nullable=True)          # Tekanan Darah Diastolik
    fundal_height_cm = Column(Float, nullable=True)        # Tinggi Fundus Uteri (TFU)
    ttd_consumption = Column(String(30), nullable=True)     # "RUTIN", "TIDAK_RUTIN", "BELUM_PERNAH"
    kspr_answers = Column(JSON, nullable=True)             # Array checkbox 20 faktor risiko KSPR
    
    # ------------------ 2. FASE BAYI BARU LAHIR ------------------
    birth_weight_gram = Column(Float, nullable=True)       # Berat Lahir (gram)
    birth_length_cm = Column(Float, nullable=True)         # Panjang Lahir (cm)
    head_circumference_cm = Column(Float, nullable=True)   # Lingkar Kepala Lahir (cm)
    gestational_age_at_birth_weeks = Column(Integer, nullable=True) # Prematur jika < 37
    early_initiation_breastfeeding = Column(String(10), nullable=True) # IMD: "Ya" / "Tidak"
    
    # ------------------ 3. FASE BADUTA (6 - 24 BULAN) ------------------
    age_in_months = Column(Integer, nullable=True)         # Usia anak dalam bulan
    child_weight_kg = Column(Float, nullable=True)         # Berat Badan Anak
    child_length_cm = Column(Float, nullable=True)         # Panjang/Tinggi Badan Anak
    child_head_circumference_cm = Column(Float, nullable=True) # Lingkar Kepala
    weight_trend_kms = Column(String(20), nullable=True)   # "NAIK" / "TIDAK_NAIK" / "BARU"
    feeding_status = Column(String(50), nullable=True)     # "ASI_EKSKLUSIF", "MP_ASI", dll
    vitamin_a = Column(String(10), nullable=True)          # "Ya" / "Tidak"
    immunization_status = Column(String(100), nullable=True)

    # Catatan keluhan klinis dasar kader
    clinical_notes = Column(Text, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="visits")
    kader = relationship("User")
    reports = relationship("Report", back_populates="visit", cascade="all, delete-orphan")
    revisions = relationship("RevisionRequest", back_populates="visit", cascade="all, delete-orphan")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

