from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.core.database import Base


class AuditLog(Base):
    """
    Menyimpan hasil evaluasi biner (Ya/Tidak) oleh LLM evaluator
    yang berjalan secara paralel dan independen dari alur utama.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=True)
    agent_name = Column(String(50), nullable=False) # e.g. "RiskDetector", "ClinicalRecommender", "Verifier"
    
    input_instruction = Column(Text, nullable=False)
    agent_output = Column(Text, nullable=False)
    reference_context = Column(Text, nullable=True) # Potongan rujukan hasil retrieval mandiri
    
    is_compliant = Column(Boolean, nullable=True)   # True (Ya) / False (Tidak) / None (Gagal evaluasi/Error)
    evaluation_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

