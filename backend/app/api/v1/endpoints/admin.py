from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List

from app.core.database import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.models.report import Report, ReportStatus
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.admin import (
    DashboardSummary,
    VillageStats,
    AuditLogResponse,
    RecentValidationItem,
    RagMetrics,
    PipelineNode,
    PipelineStatus,
    MonthlyTrendPoint,
    PatientTrendPoint,
    PatientTrendResponse,
    BulkDeleteRequest,
    BulkStatusRequest,
)
from app.multiagent.rag.vectorstore import get_or_create_collection
from app.schemas.auth import UserResponse, UserCreate
from app.core.security import get_password_hash
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()



def _require_admin(user: User = Depends(get_current_user)):
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Akses dibatasi khusus Admin Puskesmas.")
    return user


@router.get("/dashboard-summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    from app.services import aggregates as agg
    from app.multiagent.llm_utils import llm_available

    all_patients = db.query(Patient).all()
    all_reports = db.query(Report).all()
    total_visits = db.query(Visit).count()
    total_reports_approved = sum(1 for r in all_reports if r.status == ReportStatus.APPROVED)
    total_reports_pending = sum(1 for r in all_reports if r.status == ReportStatus.DRAFT)

    children_by_mother = agg.children_index(all_patients)
    totals = agg.summarize(all_patients, all_reports, children_by_mother)

    # Rekapitulasi per desa (pencocokan desa persis; desa tidak dikenali -> "Lainnya")
    by_village: Dict[str, List[Patient]] = {}
    for p in all_patients:
        by_village.setdefault(agg.village_bucket(p), []).append(p)
    village_names = list(agg.AIRMADIDI_VILLAGES) + ([agg.OTHER_VILLAGE] if agg.OTHER_VILLAGE in by_village else [])
    village_breakdown = []
    for v_name in village_names:
        v_patients = by_village.get(v_name, [])
        v_ids = {p.id for p in v_patients}
        v_tot = agg.summarize(v_patients, [r for r in all_reports if r.patient_id in v_ids], children_by_mother)
        village_breakdown.append(VillageStats(
            village_name=v_name,
            total_patients=len(v_patients),
            stunting_count=v_tot["stunting"],
            kek_count=v_tot["kek"],
            anemia_count=v_tot["anemia"],
            high_risk_count=v_tot["high_risk"],
        ))

    # 1. Feed Validasi Terkini
    recent_reports = db.query(Report).order_by(Report.id.desc()).limit(6).all()
    recent_validations = []
    for r in recent_reports:
        phase_val = (r.visit.phase.value if hasattr(r.visit.phase, "value") else str(r.visit.phase)) if (r.visit and r.visit.phase) else "-"
        recent_validations.append(RecentValidationItem(
            id=r.id,
            report_id=r.id,
            patient_name=r.patient.name if r.patient else "-",
            patient_nik=r.patient.nik if r.patient else "-",
            village_name=(r.patient.village_name if r.patient else None) or "-",
            phase=phase_val,
            kader_name=(r.kader.full_name or r.kader.username) if r.kader else "-",
            status=r.status.value if hasattr(r.status, "value") else str(r.status),
            overall_status=r.overall_status or "-",
            risk_count=len(r.risk_flags) if r.risk_flags else 0,
            validated_at=r.validated_at.strftime("%d %b %Y, %H:%M") if r.validated_at else None,
            created_at=r.created_at.strftime("%d %b %Y, %H:%M") if r.created_at else None,
        ))

    # 2. Metrik Transparansi RAG (laporan terakhir per kunjungan)
    g = agg.grounding_rate(all_reports)
    rag_metrics = RagMetrics(
        total_recommendations=g["total"],
        verified_recommendations=g["verified"],
        grounding_rate=g["rate"],
        active_sources=g["sources"],
    )

    # 3. Status Pipeline Multi-Agent (kondisi nyata, bukan nilai tetap)
    try:
        chroma_count = get_or_create_collection().count()
        chroma_status = "TERHUBUNG" if chroma_count > 0 else "KOSONG"
    except Exception:
        chroma_count = None
        chroma_status = "TIDAK_TERHUBUNG"
    llm_ok = llm_available()
    llm_node_status = "ONLINE" if llm_ok else "MODE_FALLBACK"
    rag_node_status = "ONLINE" if (llm_ok and chroma_status == "TERHUBUNG") else ("MODE_FALLBACK" if chroma_status == "TERHUBUNG" else "OFFLINE")

    pipeline_status = PipelineStatus(
        chroma_chunks_count=chroma_count,
        chroma_status=chroma_status,
        llm_status="TERSEDIA" if llm_ok else "TIDAK_TERSEDIA",
        nodes=[
            PipelineNode(
                id="agent_1",
                name="Agent 1: Deteksi Risiko",
                role="Kalkulasi Deterministik & Memory Longitudinal",
                status=llm_node_status,
                throughput=total_visits,
                description="Menghitung Z-score WHO, skor KSPR Poedji Rochjati, serta klasifikasi LiLA dan anemia Hb secara deterministik.",
                active_guidelines=["Permenkes No. 2/2020", "WHO Child Growth Standards", "Skoring Poedji Rochjati"]
            ),
            PipelineNode(
                id="agent_2",
                name="Agent 2: Rekomendasi Klinis RAG",
                role="ChromaDB Knowledge Retrieval & ReAct Synthesis",
                status=rag_node_status,
                throughput=sum(1 for r in all_reports if r.recommendations),
                description="Menarik chunk Buku KIA/PNPK via cosine similarity dan menyusun rekomendasi yang merujuk chunk tersebut.",
                active_guidelines=["PNPK Stunting KMK 1928/2022", "Buku KIA Kemenkes RI 2024"]
            ),
            PipelineNode(
                id="agent_3",
                name="Agent 3: Verifikasi Groundedness",
                role="Verifikasi keterhubungan rekomendasi terhadap chunk rujukan",
                status=rag_node_status,
                throughput=total_reports_approved + total_reports_pending,
                description="Memeriksa setiap rekomendasi terhadap chunk rujukan (2 langkah per poin) dan menyusun laporan JSON.",
                active_guidelines=["LLM-Judge Grounding", "Pencarian cadangan ChromaDB"]
            ),
            PipelineNode(
                id="human_loop",
                name="Human-in-the-Loop",
                role="Validasi Kader Posyandu",
                status="ACTIVE",
                throughput=total_reports_approved,
                description="Validasi oleh Kader Posyandu (Setujui / 1x Siklus Revisi) sebelum PDF diterbitkan.",
                active_guidelines=["WeasyPrint PDF Generator"]
            )
        ]
    )

    # 4. Tren Bulanan Kasus Risiko (6 bulan terakhir, laporan APPROVED, pasien unik per bulan)
    monthly_trend = [MonthlyTrendPoint(**m) for m in agg.monthly_trend(all_patients, all_reports, agg.last_n_months(6))]

    return DashboardSummary(
        total_patients=len(all_patients),
        total_visits=total_visits,
        total_stunting=totals["stunting"],
        total_kek=totals["kek"],
        total_anemia=totals["anemia"],
        total_reports_approved=total_reports_approved,
        total_reports_pending=total_reports_pending,
        village_breakdown=village_breakdown,
        recent_validations=recent_validations,
        rag_metrics=rag_metrics,
        pipeline_status=pipeline_status,
        monthly_trend=monthly_trend
    )


@router.get("/patient-trend/{patient_id}", response_model=PatientTrendResponse)
def get_patient_trend(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Riwayat pengukuran per kunjungan untuk grafik tren individu pasien (Admin & Kader)."""
    from app.api.v1.endpoints.patients import _is_patient_in_kader_scope, _enrich_patient
    from app.api.v1.endpoints.visits import _months_between
    from app.models.patient import PatientType

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan.")

    if not _is_patient_in_kader_scope(patient, current_user):
        raise HTTPException(status_code=403, detail="Akses ditolak: Pasien di luar wilayah kerja Posyandu Anda.")

    visits = db.query(Visit).filter(Visit.patient_id == patient_id).order_by(Visit.visit_date.asc(), Visit.id.asc()).all()
    points = []
    for v in visits:
        latest = max(v.reports, key=lambda r: r.id) if v.reports else None
        points.append(PatientTrendPoint(
            visit_date=str(v.visit_date),
            phase=v.phase.value if hasattr(v.phase, "value") else str(v.phase),
            # Umur anak dihitung dari tanggal lahir (nilai tersimpan pada data lama bisa keliru)
            age_in_months=_months_between(patient.birth_date, v.visit_date)
            if (patient.patient_type == PatientType.CHILD and patient.birth_date and v.visit_date)
            else v.age_in_months,
            child_weight_kg=v.child_weight_kg,
            child_length_cm=v.child_length_cm,
            birth_weight_gram=v.birth_weight_gram,
            birth_length_cm=v.birth_length_cm,
            lila_cm=v.lila_cm,
            hb_level=v.hb_level,
            maternal_weight_kg=v.maternal_weight_kg,
            overall_status=latest.overall_status if latest else None,
        ))

    p_type = patient.patient_type.value if hasattr(patient.patient_type, "value") else str(patient.patient_type)
    return PatientTrendResponse(
        patient_id=patient.id,
        patient_name=patient.name,
        patient_type=p_type,
        village_name=patient.village_name,
        hpk_status=_enrich_patient(db, patient).hpk_status,
        points=points,
    )


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """
    Log audit evaluator per agent. Telemetri (waktu, durasi, token, tools) hanya diambil
    dari yang benar-benar tercatat pada laporan; bila tidak ada, dikirim null
    (tidak diestimasi). is_compliant NULL berarti "Tidak dievaluasi".
    """
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    report_cache = {}
    enriched_list = []

    for r in rows:
        a_name_upper = (r.agent_name or "").upper()
        if "AGENT 1" in a_name_upper or "DETEKSI" in a_name_upper or "RISK" in a_name_upper:
            a_key, default_order = "agent_1", 1
        elif "AGENT 2" in a_name_upper or "REKOMENDASI" in a_name_upper or "RECOMMENDER" in a_name_upper:
            a_key, default_order = "agent_2", 2
        else:
            a_key, default_order = "agent_3", 3

        agent_tel = {}
        if r.report_id:
            if r.report_id not in report_cache:
                report_cache[r.report_id] = db.query(Report).filter(Report.id == r.report_id).first()
            rep_obj = report_cache.get(r.report_id)
            if rep_obj and rep_obj.final_report_json:
                agent_tel = (
                    (rep_obj.final_report_json.get("agent_telemetry") or {})
                    .get("agents", {})
                    .get(a_key, {})
                ) or {}

        enriched_list.append(
            AuditLogResponse(
                id=r.id,
                report_id=r.report_id,
                agent_name=r.agent_name,
                input_instruction=r.input_instruction,
                agent_output=r.agent_output,
                reference_context=r.reference_context,
                is_compliant=r.is_compliant,
                evaluation_notes=r.evaluation_notes,
                created_at=r.created_at,
                execution_order=agent_tel.get("execution_order", default_order),
                execution_pattern=agent_tel.get("execution_pattern"),
                parallel_worker=f"ParallelEval_{default_order - 1}",
                spawned_at=agent_tel.get("spawned_at"),
                terminated_at=agent_tel.get("terminated_at"),
                lifetime_ms=agent_tel.get("lifetime_ms"),
                lifecycle_state=agent_tel.get("lifecycle_state"),
                complexity_rank=agent_tel.get("complexity_rank"),
                complexity_reason=agent_tel.get("complexity_reason"),
                token_usage=agent_tel.get("token_usage"),
                tools_invoked=agent_tel.get("tools_invoked"),
            )
        )

    return enriched_list


@router.get("/kaders", response_model=List[UserResponse])
def get_kaders(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    return db.query(User).filter(User.role == UserRole.KADER).all()


@router.post("/kaders", response_model=UserResponse)
def create_kader(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username kader sudah digunakan.")

    kader = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=UserRole.KADER,
        posyandu_name=user_in.posyandu_name,
        village_name=user_in.village_name
    )
    db.add(kader)
    db.commit()
    db.refresh(kader)
    return kader


@router.put("/kaders/{kader_id}/toggle-status", response_model=UserResponse)
def toggle_kader_status(
    kader_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """Mengubah status aktif/nonaktif akun kader (Bab 4 Tabel 20)."""
    if kader_id == admin.id:
        raise HTTPException(status_code=400, detail="Tidak dapat menonaktifkan akun admin yang sedang aktif.")

    kader = db.query(User).filter(User.id == kader_id, User.role == UserRole.KADER).first()
    if not kader:
        raise HTTPException(status_code=404, detail="Data kader tidak ditemukan.")

    kader.is_active = not kader.is_active
    db.commit()
    db.refresh(kader)
    return kader


@router.post("/kaders/bulk-status")
def bulk_update_kader_status(
    req: BulkStatusRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """Mengubah status aktif/nonaktif massal untuk akun kader terpilih."""
    if not req.ids:
        return {"updated_count": 0, "message": "Tidak ada kader yang dipilih."}

    target_ids = [kid for kid in req.ids if kid != admin.id]
    if not target_ids:
        raise HTTPException(status_code=400, detail="Tidak ada akun kader valid yang dipilih.")

    updated_count = db.query(User).filter(
        User.id.in_(target_ids),
        User.role == UserRole.KADER
    ).update({"is_active": req.is_active}, synchronize_session=False)

    db.commit()
    action_text = "diaktifkan" if req.is_active else "dinonaktifkan"
    return {
        "updated_count": updated_count,
        "message": f"{updated_count} akun kader berhasil {action_text}."
    }


@router.delete("/kaders/{kader_id}")
def delete_kader(
    kader_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """Menghapus 1 akun kader jika belum memiliki rekam kunjungan."""
    if kader_id == admin.id:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun admin yang sedang aktif.")

    kader = db.query(User).filter(User.id == kader_id, User.role == UserRole.KADER).first()
    if not kader:
        raise HTTPException(status_code=404, detail="Data kader tidak ditemukan.")

    v_count = db.query(Visit).filter(Visit.kader_id == kader_id).count()
    if v_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Kader '{kader.full_name}' telah mencatat {v_count} data kunjungan pasien. Untuk menjaga integritas data rekam medis, kader ini tidak dapat dihapus."
        )

    db.delete(kader)
    db.commit()
    return {"message": f"Kader {kader.full_name} berhasil dihapus."}


@router.post("/kaders/bulk-delete")
def bulk_delete_kaders(
    req: BulkDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """Menghapus massal akun kader yang belum memiliki rekam kunjungan."""
    if not req.ids:
        return {"deleted_count": 0, "message": "Tidak ada kader yang dipilih."}

    blocked = []
    to_delete = []

    for kid in req.ids:
        if kid == admin.id:
            blocked.append(f"ID {kid} (Akun Administrator aktif)")
            continue
        kader = db.query(User).filter(User.id == kid, User.role == UserRole.KADER).first()
        if not kader:
            continue
        v_count = db.query(Visit).filter(Visit.kader_id == kid).count()
        if v_count > 0:
            blocked.append(f"{kader.full_name} ({v_count} kunjungan)")
        else:
            to_delete.append(kader)

    if blocked and not to_delete:
        raise HTTPException(
            status_code=400,
            detail=f"Kader berikut tidak dapat dihapus karena memiliki rekam medis kunjungan: {', '.join(blocked)}."
        )

    for k in to_delete:
        db.delete(k)
    db.commit()

    msg = f"{len(to_delete)} kader berhasil dihapus."
    if blocked:
        msg += f" (Catatan: {len(blocked)} kader dilewati karena memiliki rekam kunjungan: {', '.join(blocked)})"

    return {
        "deleted_count": len(to_delete),
        "blocked_count": len(blocked),
        "message": msg
    }


@router.post("/audit-logs/bulk-delete")
def bulk_delete_audit_logs(
    req: BulkDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """Menghapus massal log audit terpilih."""
    if not req.ids:
        return {"deleted_count": 0, "message": "Tidak ada log yang dipilih."}
    deleted_count = db.query(AuditLog).filter(AuditLog.id.in_(req.ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted_count, "message": f"{deleted_count} log evaluasi audit berhasil dihapus."}


@router.delete("/audit-logs/clear-all")
def clear_all_audit_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """Membersihkan seluruh rekam audit log evaluator AI."""
    deleted_count = db.query(AuditLog).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted_count, "message": "Seluruh log audit berhasil dibersihkan."}
