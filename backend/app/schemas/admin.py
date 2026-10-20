from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class VillageStats(BaseModel):
    village_name: str
    total_patients: int
    stunting_count: int
    kek_count: int
    anemia_count: int
    high_risk_count: int


class RecentValidationItem(BaseModel):
    id: int
    report_id: int
    patient_name: str
    patient_nik: str
    village_name: str
    phase: str
    kader_name: str
    status: str
    overall_status: str
    risk_count: int
    validated_at: Optional[str] = None
    created_at: Optional[str] = None


class RagMetrics(BaseModel):
    total_recommendations: int
    verified_recommendations: int
    grounding_rate: float
    active_sources: List[str]


class PipelineNode(BaseModel):
    id: str
    name: str
    role: str
    status: str
    throughput: int
    description: str
    active_guidelines: List[str] = []


class PipelineStatus(BaseModel):
    nodes: List[PipelineNode]
    chroma_chunks_count: int


class MonthlyTrendPoint(BaseModel):
    month: str          # "2026-05"
    label: str          # "Mei 26"
    stunting: int
    kek: int
    anemia: int


class PatientTrendPoint(BaseModel):
    visit_date: str
    phase: str
    age_in_months: Optional[int] = None
    child_weight_kg: Optional[float] = None
    child_length_cm: Optional[float] = None
    birth_weight_gram: Optional[float] = None
    birth_length_cm: Optional[float] = None
    lila_cm: Optional[float] = None
    hb_level: Optional[float] = None
    maternal_weight_kg: Optional[float] = None
    overall_status: Optional[str] = None


class PatientTrendResponse(BaseModel):
    patient_id: int
    patient_name: str
    patient_type: str
    village_name: Optional[str] = None
    points: List[PatientTrendPoint]


class DashboardSummary(BaseModel):
    total_patients: int
    total_visits: int
    total_stunting: int
    total_kek: int
    total_anemia: int
    total_reports_approved: int
    total_reports_pending: int
    village_breakdown: List[VillageStats]
    recent_validations: Optional[List[RecentValidationItem]] = []
    rag_metrics: Optional[RagMetrics] = None
    pipeline_status: Optional[PipelineStatus] = None
    monthly_trend: Optional[List[MonthlyTrendPoint]] = []


class AuditLogResponse(BaseModel):
    id: int
    report_id: Optional[int]
    agent_name: str
    input_instruction: str
    agent_output: str
    reference_context: Optional[str]
    is_compliant: Optional[bool] = None
    evaluation_notes: Optional[str]
    created_at: Any

    class Config:
        from_attributes = True


