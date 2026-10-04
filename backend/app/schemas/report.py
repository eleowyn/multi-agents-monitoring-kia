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
