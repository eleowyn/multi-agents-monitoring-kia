from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from app.models.visit import PhaseEnum


class VisitCreate(BaseModel):
    patient_id: int
    visit_date: date
    phase: PhaseEnum
    
    # Fase Ibu Hamil
    gestational_age_weeks: Optional[int] = None
    trimester: Optional[int] = None
    maternal_weight_kg: Optional[float] = None
    maternal_height_cm: Optional[float] = None
    lila_cm: Optional[float] = None
    hb_level: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    fundal_height_cm: Optional[float] = None
    ttd_consumption: Optional[str] = None
    kspr_answers: Optional[List[str]] = []
    
    # Fase Bayi Baru Lahir
    birth_weight_gram: Optional[float] = None
    birth_length_cm: Optional[float] = None
    head_circumference_cm: Optional[float] = None
    gestational_age_at_birth_weeks: Optional[int] = None
    early_initiation_breastfeeding: Optional[str] = None
    
    # Fase Baduta
    age_in_months: Optional[int] = None
    child_weight_kg: Optional[float] = None
    child_length_cm: Optional[float] = None
    child_head_circumference_cm: Optional[float] = None
    weight_trend_kms: Optional[str] = None
    feeding_status: Optional[str] = None
    vitamin_a: Optional[str] = None
    immunization_status: Optional[str] = None
    
    clinical_notes: Optional[str] = None


class VisitResponse(VisitCreate):
    id: int
    kader_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

