from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.report import ReportStatus


class ReportBase(BaseModel):
    visit_id: int
    patient_id: int
    overall_status: str


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_id: int
    patient_id: int
    kader_id: int
    risk_flags: List[Dict[str, Any]]
    risk_narrative: str
    recommendations: Optional[List[Dict[str, Any]]] = None
    verification_summary: Optional[List[Dict[str, Any]]] = None
    overall_status: str
    final_report_json: Dict[str, Any]
    status: ReportStatus
    rejection_reason: Optional[str] = None
    revision_count: int = 0
    validated_at: Optional[datetime] = None
    pdf_path: Optional[str] = None
    created_at: Optional[datetime] = None


class ReportValidationRequest(BaseModel):
    status: ReportStatus
    rejection_reason: Optional[str] = None


class ReportListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visit_id: int
    patient_id: int
    patient_name: Optional[str] = None
    patient_nik: Optional[str] = None
    patient_type: Optional[str] = None
    village_name: Optional[str] = None
    posyandu_name: Optional[str] = None
    phase: Optional[str] = None
    visit_date: Optional[str] = None
    overall_status: str
    status: ReportStatus
    risk_count: int = 0
    revision_count: int = 0
    validated_at: Optional[datetime] = None
    has_pdf: bool = False
