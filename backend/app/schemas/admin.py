from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class VillageStats(BaseModel):
    village_name: str
    total_patients: int
    stunting_count: int
    kek_count: int
    anemia_count: int
    high_risk_count: int


class DashboardSummary(BaseModel):
    total_patients: int
    total_visits: int
    total_stunting: int
    total_kek: int
    total_anemia: int
    total_reports_approved: int
    total_reports_pending: int
    village_breakdown: List[VillageStats]


class AuditLogResponse(BaseModel):
    id: int
    report_id: Optional[int]
    agent_name: str
    input_instruction: str
    agent_output: str
    reference_context: Optional[str]
    is_compliant: bool
    evaluation_notes: Optional[str]
    created_at: Any

    class Config:
        from_attributes = True

