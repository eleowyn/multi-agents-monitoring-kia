from datetime import date, datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from app.models.schedule import ScheduleStatus


class ScheduleBase(BaseModel):
    village_name: str = Field(..., min_length=2, max_length=100)
    posyandu_name: str = Field(..., min_length=2, max_length=120)
    schedule_date: date
    start_time: str = Field(default="08:00", pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(default="11:00", pattern=r"^\d{2}:\d{2}$")
    routine_pattern: Optional[str] = Field(default="Bulanan • 08.00 WITA", max_length=100)
    service_agenda: str = Field(
        default="Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        min_length=3,
        max_length=255,
    )
    kader_id: Optional[int] = None
    kader_name_fallback: Optional[str] = Field(default=None, max_length=100)
    status: ScheduleStatus = ScheduleStatus.TERJADWAL
    notes: Optional[str] = Field(default="Wajib Membawa FC Kartu Keluarga")


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    village_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    posyandu_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    schedule_date: Optional[date] = None
    start_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    routine_pattern: Optional[str] = Field(default=None, max_length=100)
    service_agenda: Optional[str] = Field(default=None, min_length=3, max_length=255)
    kader_id: Optional[int] = None
    kader_name_fallback: Optional[str] = Field(default=None, max_length=100)
    status: Optional[ScheduleStatus] = None
    notes: Optional[str] = None


class ScheduleResponse(BaseModel):
    id: int
    village_name: str
    posyandu_name: str
    schedule_date: date
    start_time: str
    end_time: str
    routine_pattern: Optional[str] = None
    service_agenda: str
    kader_id: Optional[int] = None
    kader_name: str
    status: ScheduleStatus
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PublicScheduleOverview(BaseModel):
    total_posyandu: int
    total_villages: int
    general_note: str
    villages_mapping: Dict[str, List[str]]
    schedules: List[ScheduleResponse]

