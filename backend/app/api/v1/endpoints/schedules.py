from datetime import date
from typing import List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.schedule import PosyanduSchedule, ScheduleStatus
from app.models.user import User, UserRole
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    PublicScheduleOverview,
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# Pemetaan resmi 14 titik Posyandu di 9 Kelurahan/Desa Kecamatan Airmadidi
# Sesuai poster resmi UPTD Puskesmas Airmadidi (Jadwal Posyandu November 2026)
OFFICIAL_POSYANDU_BY_VILLAGE: Dict[str, List[str]] = {
    "Sukur": [
        "Kelurahan Sukur",
        "Kel. Sukur (Musafir)",
    ],
    "Airmadidi Atas": [
        "Kel. Airmadidi Atas (SBY)",
        "Kel. Airmadidi Atas (Lokon)",
        "Kelurahan Airmadidi Atas",
    ],
    "Sampiri": [
        "Desa Sampiri",
    ],
    "Tanggari": [
        "Desa Tanggari",
    ],
    "Airmadidi Bawah": [
        "Kelurahan Airmadidi Bawah",
        "Kelurahan Airmadidi Bawah (Yordan)",
        "Kelurahan Airmadidi Bawah (Inadukan)",
    ],
    "Rap-Rap": [
        "Kelurahan Rap-Rap",
    ],
    "Sarongsong Satu": [
        "Kelurahan Sarongsong I",
    ],
    "Sarongsong Dua": [
        "Kelurahan Sarongsong II",
    ],
    "Sawangan": [
        "Desa Sawangan",
    ],
}

DEFAULT_NOVEMBER_2026_SCHEDULES = [
    {
        "village_name": "Sukur",
        "posyandu_name": "Kelurahan Sukur",
        "schedule_date": date(2026, 11, 2),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-1 (Senin) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Sukur",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Kel. Airmadidi Atas (SBY)",
        "schedule_date": date(2026, 11, 3),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-1 (Selasa) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Airmadidi Atas (SBY)",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Sampiri",
        "posyandu_name": "Desa Sampiri",
        "schedule_date": date(2026, 11, 4),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-1 (Rabu) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Desa Sampiri",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Kel. Airmadidi Atas (Lokon)",
        "schedule_date": date(2026, 11, 9),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-2 (Senin) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Airmadidi Atas (Lokon)",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Tanggari",
        "posyandu_name": "Desa Tanggari",
        "schedule_date": date(2026, 11, 10),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-2 (Selasa) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Desa Tanggari",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Airmadidi Bawah",
        "posyandu_name": "Kelurahan Airmadidi Bawah",
        "schedule_date": date(2026, 11, 11),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-2 (Rabu) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Airmadidi Bawah",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Rap-Rap",
        "posyandu_name": "Kelurahan Rap-Rap",
        "schedule_date": date(2026, 11, 13),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-2 (Jumat) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Rap-Rap",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Sarongsong Satu",
        "posyandu_name": "Kelurahan Sarongsong I",
        "schedule_date": date(2026, 11, 16),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-3 (Senin) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Sarongsong I",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Airmadidi Bawah",
        "posyandu_name": "Kelurahan Airmadidi Bawah (Yordan)",
        "schedule_date": date(2026, 11, 17),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-3 (Selasa) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Airmadidi Bawah (Yordan)",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Sarongsong Dua",
        "posyandu_name": "Kelurahan Sarongsong II",
        "schedule_date": date(2026, 11, 18),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-3 (Rabu) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Sarongsong II",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Sukur",
        "posyandu_name": "Kel. Sukur (Musafir)",
        "schedule_date": date(2026, 11, 20),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-3 (Jumat) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Sukur (Musafir)",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Kelurahan Airmadidi Atas",
        "schedule_date": date(2026, 11, 23),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-4 (Senin) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Kel. Airmadidi Atas",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Sawangan",
        "posyandu_name": "Desa Sawangan",
        "schedule_date": date(2026, 11, 25),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-4 (Rabu) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Desa Sawangan",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
    {
        "village_name": "Airmadidi Bawah",
        "posyandu_name": "Kelurahan Airmadidi Bawah (Inadukan)",
        "schedule_date": date(2026, 11, 27),
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Minggu ke-4 (Jumat) • 08.00 WITA",
        "service_agenda": "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil",
        "kader_name_fallback": "Kader Posyandu Airmadidi Bawah (Inadukan)",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    },
]


def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Akses dibatasi khusus Administrator Puskesmas.",
        )
    return user


def _serialize_schedule(s: PosyanduSchedule) -> ScheduleResponse:
    k_name = (
        s.kader.full_name
        if (s.kader and getattr(s.kader, "full_name", None))
        else (s.kader_name_fallback or f"Kader {s.posyandu_name}")
    )
    return ScheduleResponse(
        id=s.id,
        village_name=s.village_name,
        posyandu_name=s.posyandu_name,
        schedule_date=s.schedule_date,
        start_time=s.start_time or "08:00",
        end_time=s.end_time or "11:30",
        routine_pattern=s.routine_pattern,
        service_agenda=s.service_agenda,
        kader_id=s.kader_id,
        kader_name=k_name,
        status=s.status,
        notes=s.notes,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


def ensure_default_schedules_seeded(db: Session) -> None:
    """Mengisi otomatis 14 jadwal Posyandu November 2026 apabila tabel jadwal masih kosong."""
    count = db.query(PosyanduSchedule).count()
    if count > 0:
        return

    kaders = db.query(User).filter(User.role == UserRole.KADER, User.is_active == True).all()
    kader_by_village: Dict[str, User] = {}
    for k in kaders:
        if k.village_name and k.village_name.strip() not in kader_by_village:
            kader_by_village[k.village_name.strip()] = k

    for item in DEFAULT_NOVEMBER_2026_SCHEDULES:
        matched_kader = kader_by_village.get(item["village_name"])
        row = PosyanduSchedule(
            village_name=item["village_name"],
            posyandu_name=item["posyandu_name"],
            schedule_date=item["schedule_date"],
            start_time=item["start_time"],
            end_time=item["end_time"],
            routine_pattern=item["routine_pattern"],
            service_agenda=item["service_agenda"],
            kader_id=matched_kader.id if matched_kader else None,
            kader_name_fallback=matched_kader.full_name if matched_kader else item["kader_name_fallback"],
            status=ScheduleStatus.TERJADWAL,
            notes=item["notes"],
        )
        db.add(row)
    db.commit()


def _check_schedule_conflict(
    db: Session,
    schedule_date: date,
    start_time: str,
    end_time: str,
    village_name: str,
    posyandu_name: str,
    kader_id: Optional[int],
    status: ScheduleStatus,
    exclude_id: Optional[int] = None,
) -> None:
    """
    Validasi Bentrok Jadwal (Bab 4 Tabel 23 Skenario Alternatif 4a, Gambar 36 & Gambar 53):
    1. Jam selesai harus setelah jam mulai.
    2. Jika status TERJADWAL, tolak bila sudah ada jadwal aktif di Posyandu & Desa yang sama
       pada tanggal dan rentang jam yang beririsan.
    3. Jika kader_id dipilih dan status TERJADWAL, tolak bila kader tersebut sudah bertugas
       di lokasi Posyandu lain pada tanggal dan jam yang beririsan.
    """
    if end_time <= start_time:
        raise HTTPException(
            status_code=400,
            detail="Jam selesai harus lebih besar dari jam mulai kegiatan.",
        )

    if status != ScheduleStatus.TERJADWAL:
        return

    q = db.query(PosyanduSchedule).filter(
        PosyanduSchedule.schedule_date == schedule_date,
        PosyanduSchedule.status == ScheduleStatus.TERJADWAL,
    )
    if exclude_id is not None:
        q = q.filter(PosyanduSchedule.id != exclude_id)

    same_day_schedules = q.all()
    norm_village = village_name.strip().lower()
    norm_posyandu = posyandu_name.strip().lower()

    for existing in same_day_schedules:
        ex_start = existing.start_time or "08:00"
        ex_end = existing.end_time or "11:30"
        time_overlaps = (start_time < ex_end) and (end_time > ex_start)
        if not time_overlaps:
            continue

        if (
            existing.village_name.strip().lower() == norm_village
            and existing.posyandu_name.strip().lower() == norm_posyandu
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Bentrok Jadwal: {existing.posyandu_name} ({existing.village_name}) "
                    f"sudah memiliki jadwal aktif pada tanggal {schedule_date} pukul {ex_start}–{ex_end} WITA."
                ),
            )

        if kader_id is not None and existing.kader_id == kader_id:
            kader_label = (
                existing.kader.full_name
                if existing.kader
                else (existing.kader_name_fallback or "Kader tersebut")
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Bentrok Penugasan Kader: {kader_label} sudah ditugaskan di "
                    f"{existing.posyandu_name} ({existing.village_name}) pada tanggal {schedule_date} "
                    f"pukul {ex_start}–{ex_end} WITA."
                ),
            )


@router.get("/public", response_model=PublicScheduleOverview)
def get_public_schedules(db: Session = Depends(get_db)):
    """Endpoint publik untuk Landing Page: menampilkan 14 jadwal Posyandu dan pemetaan 9 Desa/Kelurahan."""
    ensure_default_schedules_seeded(db)
    rows = (
        db.query(PosyanduSchedule)
        .order_by(PosyanduSchedule.schedule_date.asc(), PosyanduSchedule.start_time.asc())
        .all()
    )
    return PublicScheduleOverview(
        total_posyandu=sum(len(v) for v in OFFICIAL_POSYANDU_BY_VILLAGE.values()),
        total_villages=len(OFFICIAL_POSYANDU_BY_VILLAGE),
        general_note="Wajib Membawa FC Kartu Keluarga & Buku KIA",
        villages_mapping=OFFICIAL_POSYANDU_BY_VILLAGE,
        schedules=[_serialize_schedule(r) for r in rows],
    )


@router.get("/", response_model=List[ScheduleResponse])
def list_schedules(
    village_name: Optional[str] = None,
    status: Optional[ScheduleStatus] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mengambil daftar jadwal Posyandu untuk Admin dan Kader."""
    ensure_default_schedules_seeded(db)
    query = db.query(PosyanduSchedule)

    if village_name and village_name.upper() != "ALL":
        query = query.filter(PosyanduSchedule.village_name == village_name)
    elif current_user.role == UserRole.KADER and current_user.village_name and village_name is None:
        query = query.filter(PosyanduSchedule.village_name == current_user.village_name)

    if status:
        query = query.filter(PosyanduSchedule.status == status)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (PosyanduSchedule.posyandu_name.ilike(s))
            | (PosyanduSchedule.village_name.ilike(s))
            | (PosyanduSchedule.service_agenda.ilike(s))
            | (PosyanduSchedule.kader_name_fallback.ilike(s))
        )

    rows = query.order_by(PosyanduSchedule.schedule_date.asc(), PosyanduSchedule.start_time.asc()).all()
    return [_serialize_schedule(r) for r in rows]


@router.post("/", response_model=ScheduleResponse)
def create_schedule(
    payload: ScheduleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Menambahkan jadwal Posyandu baru dengan pemeriksaan bentrok jadwal (Bab 4 Tabel 23)."""
    ensure_default_schedules_seeded(db)
    _check_schedule_conflict(
        db=db,
        schedule_date=payload.schedule_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        village_name=payload.village_name,
        posyandu_name=payload.posyandu_name,
        kader_id=payload.kader_id,
        status=payload.status,
    )

    kader_fallback = payload.kader_name_fallback
    if payload.kader_id:
        k_user = db.query(User).filter(User.id == payload.kader_id).first()
        if not k_user:
            raise HTTPException(status_code=404, detail="Akun kader penanggung jawab tidak ditemukan.")
        kader_fallback = k_user.full_name

    new_row = PosyanduSchedule(
        village_name=payload.village_name.strip(),
        posyandu_name=payload.posyandu_name.strip(),
        schedule_date=payload.schedule_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        routine_pattern=payload.routine_pattern,
        service_agenda=payload.service_agenda.strip(),
        kader_id=payload.kader_id,
        kader_name_fallback=kader_fallback or f"Kader {payload.posyandu_name.strip()}",
        status=payload.status,
        notes=payload.notes or "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    )
    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return _serialize_schedule(new_row)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    payload: ScheduleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Memperbarui jadwal Posyandu beserta validasi bentrok jadwal (Bab 4 Tabel 23)."""
    row = db.query(PosyanduSchedule).filter(PosyanduSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Jadwal Posyandu tidak ditemukan.")

    next_village = payload.village_name.strip() if payload.village_name is not None else row.village_name
    next_posyandu = payload.posyandu_name.strip() if payload.posyandu_name is not None else row.posyandu_name
    next_date = payload.schedule_date if payload.schedule_date is not None else row.schedule_date
    next_start = payload.start_time if payload.start_time is not None else row.start_time
    next_end = payload.end_time if payload.end_time is not None else row.end_time
    next_status = payload.status if payload.status is not None else row.status
    next_kader_id = payload.kader_id if "kader_id" in payload.model_fields_set else row.kader_id

    _check_schedule_conflict(
        db=db,
        schedule_date=next_date,
        start_time=next_start,
        end_time=next_end,
        village_name=next_village,
        posyandu_name=next_posyandu,
        kader_id=next_kader_id,
        status=next_status,
        exclude_id=row.id,
    )

    row.village_name = next_village
    row.posyandu_name = next_posyandu
    row.schedule_date = next_date
    row.start_time = next_start
    row.end_time = next_end
    row.status = next_status
    row.kader_id = next_kader_id

    if payload.routine_pattern is not None:
        row.routine_pattern = payload.routine_pattern
    if payload.service_agenda is not None:
        row.service_agenda = payload.service_agenda.strip()
    if payload.notes is not None:
        row.notes = payload.notes

    if next_kader_id:
        k_user = db.query(User).filter(User.id == next_kader_id).first()
        if not k_user:
            raise HTTPException(status_code=404, detail="Akun kader penanggung jawab tidak ditemukan.")
        row.kader_name_fallback = k_user.full_name
    elif payload.kader_name_fallback is not None:
        row.kader_name_fallback = payload.kader_name_fallback.strip() or f"Kader {next_posyandu}"

    db.commit()
    db.refresh(row)
    return _serialize_schedule(row)


@router.delete("/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Menghapus jadwal Posyandu."""
    row = db.query(PosyanduSchedule).filter(PosyanduSchedule.id == schedule_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Jadwal Posyandu tidak ditemukan.")
    label = f"{row.posyandu_name} ({row.schedule_date})"
    db.delete(row)
    db.commit()
    return {"message": f"Jadwal {label} berhasil dihapus."}

