from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from app.models.patient import PatientType, Gender


class PatientBase(BaseModel):
    nik: str = Field(..., min_length=1, max_length=20, description="NIK / Nomor Identitas Pasien")
    name: str
    patient_type: PatientType
    birth_date: date
    gender: Optional[Gender] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None
    village_name: Optional[str] = None
    posyandu_name: Optional[str] = None
    mother_id: Optional[int] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    nik: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = None
    patient_type: Optional[PatientType] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = None
    phone_number: Optional[str] = None
    village_name: Optional[str] = None
    posyandu_name: Optional[str] = None
    mother_id: Optional[int] = None


class PatientResponse(PatientBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class LongitudinalHistoryResponse(BaseModel):
    patient: PatientResponse
    mother: Optional[PatientResponse] = None
    maternal_visits: List[dict] = []
    child_visits: List[dict] = []
