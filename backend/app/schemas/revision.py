from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from app.models.revision import RevisionStatus


class RevisionCreate(BaseModel):
    visit_id: int
    reason: str
    proposed_data: Dict[str, Any]


class RevisionValidationRequest(BaseModel):
    status: RevisionStatus
    admin_notes: Optional[str] = None


class RevisionResponse(BaseModel):
    id: int
    visit_id: Optional[int] = None
    report_id: Optional[int] = None
    kader_id: int
    admin_id: Optional[int] = None
    reason: str
    proposed_data: Dict[str, Any]
    previous_data: Optional[Dict[str, Any]] = None
    status: RevisionStatus
    admin_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    # Metadata untuk tampilan UI Kader & Admin
    kader_name: Optional[str] = None
    admin_name: Optional[str] = None
    patient_name: Optional[str] = None
    patient_nik: Optional[str] = None
    village_name: Optional[str] = None
    visit_date: Optional[str] = None
    phase: Optional[str] = None

    class Config:
        from_attributes = True
