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
    limit: int = 200,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin)
):
    """
    Log audit sistem per agent (Agent 1, Agent 2, Agent 3). Menyajikan rincian
    instruksi, kalkulator/fungsi yang dijalankan, daftar chunk & halaman RAG,
    skor grounding, durasi, konsumsi token, dan status kepatuhan SOP.
    """
    import json as _json
    from app.services.eval_logger import _deterministic_sop_audit

    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    report_cache = {}
    patient_cache = {}
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
        agent_work_detail = None
        thought_process = None
        patient_name = None
        patient_nik = None
        village_name = None
        phase = None
        overall_status = None

        if r.report_id:
            if r.report_id not in report_cache:
                report_cache[r.report_id] = db.query(Report).filter(Report.id == r.report_id).first()
            rep_obj = report_cache.get(r.report_id)
            if rep_obj:
                overall_status = rep_obj.overall_status
                if rep_obj.patient_id:
                    if rep_obj.patient_id not in patient_cache:
                        patient_cache[rep_obj.patient_id] = db.query(Patient).filter(Patient.id == rep_obj.patient_id).first()
                    pat_obj = patient_cache.get(rep_obj.patient_id)
                    if pat_obj:
                        patient_name = pat_obj.name
                        patient_nik = pat_obj.nik
                        village_name = pat_obj.village_name
                if rep_obj.visit and hasattr(rep_obj.visit, "phase") and rep_obj.visit.phase:
                    phase = rep_obj.visit.phase.value if hasattr(rep_obj.visit.phase, "value") else str(rep_obj.visit.phase)

            if rep_obj and rep_obj.final_report_json:
                fr = rep_obj.final_report_json
                meta = fr.get("metadata") or {}
                patient_name = patient_name or meta.get("patient_name")
                patient_nik = patient_nik or meta.get("patient_nik")
                village_name = village_name or meta.get("village_name")
                phase = phase or meta.get("phase")
                overall_status = overall_status or meta.get("overall_status")

                agent_tel = (
                    (fr.get("agent_telemetry") or {})
                    .get("agents", {})
                    .get(a_key, {})
                ) or {}
                thought_process = agent_tel.get("thought_process")
                wb = agent_tel.get("work_breakdown")
                if wb:
                    agent_work_detail = dict(wb)
                elif a_key == "agent_1":
                    cf = fr.get("clinical_findings") or {}
                    det = cf.get("deterministic_summary") or {}
                    agent_work_detail = {
                        "phase": (fr.get("metadata") or {}).get("phase"),
                        "plausibility": det.get("plausibility"),
                        "hpk_status": fr.get("hpk_status") or det.get("hpk_status"),
                        "who_zscore": det.get("who_zscore"),
                        "kspr": det.get("kspr"),
                        "maternal_nutrition": det.get("maternal_nutrition"),
                        "neonatal_status": det.get("neonatal_status"),
                        "weight_trend": det.get("weight_trend"),
                        "active_risk_flags": cf.get("active_risk_flags") or rep_obj.risk_flags or [],
                        "risk_narrative": cf.get("risk_narrative") or rep_obj.risk_narrative or "",
                    }
                elif a_key == "agent_2":
                    recs_raw = fr.get("recommendations") or rep_obj.recommendations or []
                    if not thought_process and recs_raw and isinstance(recs_raw[0], dict):
                        thought_process = recs_raw[0].get("thought_process")
                    agent_work_detail = {
                        "recommender_mode": agent_tel.get("mode") or (recs_raw[0].get("reasoning_mode") if recs_raw and isinstance(recs_raw[0], dict) else "NO_RISK"),
                        "chunks_retrieved_count": (agent_tel.get("task_proof") or {}).get("chunks_retrieved_count", len(recs_raw)),
                        "recommendations_trace": [
                            {
                                "title": rec.get("title"),
                                "category": rec.get("category"),
                                "recommendation_text": rec.get("recommendation_text"),
                                "reasoning_mode": rec.get("reasoning_mode"),
                                "evidence_status": rec.get("evidence_status"),
                                "citation": rec.get("citation"),
                                "source": (rec.get("citation") or {}).get("source") if isinstance(rec.get("citation"), dict) else rec.get("source"),
                                "section": (rec.get("citation") or {}).get("section") if isinstance(rec.get("citation"), dict) else rec.get("section"),
                                "page": (rec.get("citation") or {}).get("page") if isinstance(rec.get("citation"), dict) else rec.get("page"),
                                "chunk_id": (rec.get("citation") or {}).get("chunk_id") if isinstance(rec.get("citation"), dict) else rec.get("chunk_id"),
                                "additional_pages": (rec.get("citation") or {}).get("additional_pages") if isinstance(rec.get("citation"), dict) else rec.get("additional_pages"),
                                "additional_sections": (rec.get("citation") or {}).get("additional_sections") if isinstance(rec.get("citation"), dict) else rec.get("additional_sections"),
                                "supporting_chunk_ids": (rec.get("citation") or {}).get("supporting_chunk_ids") if isinstance(rec.get("citation"), dict) else rec.get("supporting_chunk_ids"),
                                "supporting_chunks": (rec.get("citation") or {}).get("supporting_chunks") if isinstance(rec.get("citation"), dict) else rec.get("supporting_chunks"),
                                "evidence_quote": rec.get("evidence_quote"),
                                "ai_insight": rec.get("ai_insight"),
                                "ai_insight_details": rec.get("ai_insight_details"),
                            }
                            for rec in recs_raw if isinstance(rec, dict)
                        ],
                    }
                elif a_key == "agent_3":
                    verifs = fr.get("verification_summary") or rep_obj.verification_summary or []
                    ver_cnt = sum(1 for v in verifs if isinstance(v, dict) and (v.get("is_verified") is True or v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY")))
                    normalized_verifs = []
                    for v in verifs:
                        if not isinstance(v, dict):
                            continue
                        cit_chk = v.get("citation_checked") if isinstance(v.get("citation_checked"), dict) else {}
                        is_v = v.get("is_verified") if isinstance(v.get("is_verified"), bool) else (v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY"))
                        normalized_verifs.append({
                            "recommendation_title": v.get("recommendation_title") or v.get("title") or "Rekomendasi Klinis",
                            "is_verified": is_v,
                            "verification_status": v.get("verification_status") or ("VERIFIED" if is_v else "UNVERIFIED"),
                            "grounding_score": v.get("grounding_score", 1.0 if is_v else 0.0),
                            "source": v.get("source") or cit_chk.get("source"),
                            "section": v.get("section") or cit_chk.get("section"),
                            "page": v.get("page") or cit_chk.get("page"),
                            "chunk_id": v.get("chunk_id") or cit_chk.get("chunk_id"),
                            "additional_pages": v.get("additional_pages") or cit_chk.get("additional_pages"),
                            "supporting_chunk_ids": v.get("supporting_chunk_ids") or cit_chk.get("supporting_chunk_ids"),
                            "verification_note": v.get("verification_note") or v.get("reasoning"),
                        })
                    agent_work_detail = {
                        "verifier_mode": agent_tel.get("mode") or "LLM_JUDGE_AND_LEXICAL",
                        "verified_count": ver_cnt,
                        "grounding_rate_percent": round((ver_cnt / max(1, len(normalized_verifs))) * 100.0, 1) if normalized_verifs else 100.0,
                        "verification_details": normalized_verifs,
                    }

        # Normalisasi tambahan jika agent_work_detail berasal dari wb (work_breakdown)
        if agent_work_detail and a_key == "agent_2":
            for rec in (agent_work_detail.get("recommendations_trace") or []):
                if isinstance(rec, dict) and isinstance(rec.get("citation"), dict):
                    cit = rec["citation"]
                    rec.setdefault("source", cit.get("source"))
                    rec.setdefault("section", cit.get("section"))
                    rec.setdefault("page", cit.get("page"))
                    rec.setdefault("chunk_id", cit.get("chunk_id"))
                    rec.setdefault("additional_pages", cit.get("additional_pages"))
                    rec.setdefault("additional_sections", cit.get("additional_sections"))
                    rec.setdefault("supporting_chunk_ids", cit.get("supporting_chunk_ids"))
                    rec.setdefault("supporting_chunks", cit.get("supporting_chunks"))
        elif agent_work_detail and a_key == "agent_3":
            norm_list = []
            for v in (agent_work_detail.get("verification_details") or []):
                if not isinstance(v, dict):
                    continue
                cit_chk = v.get("citation_checked") if isinstance(v.get("citation_checked"), dict) else {}
                is_v = v.get("is_verified") if isinstance(v.get("is_verified"), bool) else (v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY"))
                norm_list.append({
                    **v,
                    "recommendation_title": v.get("recommendation_title") or v.get("title") or "Rekomendasi Klinis",
                    "is_verified": is_v,
                    "grounding_score": v.get("grounding_score", 1.0 if is_v else 0.0),
                    "source": v.get("source") or cit_chk.get("source"),
                    "section": v.get("section") or cit_chk.get("section"),
                    "page": v.get("page") or cit_chk.get("page"),
                    "chunk_id": v.get("chunk_id") or cit_chk.get("chunk_id"),
                    "additional_pages": v.get("additional_pages") or cit_chk.get("additional_pages"),
                    "supporting_chunk_ids": v.get("supporting_chunk_ids") or cit_chk.get("supporting_chunk_ids"),
                    "verification_note": v.get("verification_note") or v.get("reasoning"),
                })
            agent_work_detail["verification_details"] = norm_list

        # Fallback dari r.agent_output apabila laporan lama belum memiliki final_report_json
        if not agent_work_detail and r.agent_output:
            try:
                raw_out = _json.loads(r.agent_output)
                if a_key == "agent_1" and isinstance(raw_out, dict):
                    agent_work_detail = {
                        "phase": phase,
                        "plausibility": {"is_plausible": True},
                        "active_risk_flags": raw_out.get("risk_flags") or [],
                        "risk_narrative": raw_out.get("narrative") or "",
                    }
                elif a_key == "agent_2" and isinstance(raw_out, list):
                    agent_work_detail = {
                        "recommender_mode": "HYBRID_RAG",
                        "chunks_retrieved_count": len(raw_out),
                        "recommendations_trace": [
                            {
                                "title": rec.get("title"),
                                "category": rec.get("category"),
                                "recommendation_text": rec.get("recommendation_text"),
                                "source": (rec.get("citation") or {}).get("source") if isinstance(rec.get("citation"), dict) else None,
                                "section": (rec.get("citation") or {}).get("section") if isinstance(rec.get("citation"), dict) else None,
                                "page": (rec.get("citation") or {}).get("page") if isinstance(rec.get("citation"), dict) else None,
                                "chunk_id": (rec.get("citation") or {}).get("chunk_id") if isinstance(rec.get("citation"), dict) else None,
                                "evidence_quote": rec.get("evidence_quote"),
                            }
                            for rec in raw_out if isinstance(rec, dict)
                        ],
                    }
                elif a_key == "agent_3" and isinstance(raw_out, dict):
                    verifs_raw = raw_out.get("verification") or []
                    agent_work_detail = {
                        "verifier_mode": "GROUNDING_CHECK",
                        "verified_count": len(verifs_raw),
                        "grounding_rate_percent": 100.0,
                        "verification_details": [
                            {
                                "recommendation_title": v.get("title") or v.get("recommendation_title") or "Rekomendasi",
                                "is_verified": v.get("verification_status") in ("VERIFIED", "AUTO_GROUNDED_SECONDARY"),
                                "grounding_score": v.get("grounding_score", 1.0),
                                "source": (v.get("citation_checked") or {}).get("source") if isinstance(v.get("citation_checked"), dict) else v.get("source"),
                                "section": (v.get("citation_checked") or {}).get("section") if isinstance(v.get("citation_checked"), dict) else v.get("section"),
                                "page": (v.get("citation_checked") or {}).get("page") if isinstance(v.get("citation_checked"), dict) else v.get("page"),
                                "chunk_id": (v.get("citation_checked") or {}).get("chunk_id") if isinstance(v.get("citation_checked"), dict) else v.get("chunk_id"),
                                "verification_note": v.get("reasoning") or v.get("verification_note"),
                            }
                            for v in verifs_raw if isinstance(v, dict)
                        ],
                    }
            except Exception:
                pass

        is_comp = r.is_compliant
        eval_notes = r.evaluation_notes or ""

        eval_notes = (
            eval_notes
            .replace("PARALLEL EVALUATOR", "AUDIT PARALEL")
            .replace("Token Eval:", "Token Audit:")
            .replace("ParallelEval", "AuditWorker")
        )

        enriched_list.append(
            AuditLogResponse(
                id=r.id,
                report_id=r.report_id,
                agent_name=r.agent_name,
                input_instruction=r.input_instruction,
                agent_output=r.agent_output,
                reference_context=r.reference_context,
                is_compliant=is_comp,
                evaluation_notes=eval_notes,
                created_at=r.created_at,
                patient_name=patient_name,
                patient_nik=patient_nik,
                village_name=village_name,
                phase=phase,
                overall_status=overall_status,
                execution_order=agent_tel.get("execution_order", default_order),
                execution_pattern=agent_tel.get("execution_pattern"),
                parallel_worker=f"AuditWorker_{default_order}",
                spawned_at=agent_tel.get("spawned_at"),
                terminated_at=agent_tel.get("terminated_at"),
                lifetime_ms=agent_tel.get("lifetime_ms"),
                lifecycle_state=agent_tel.get("lifecycle_state"),
                complexity_rank=agent_tel.get("complexity_rank"),
                complexity_reason=agent_tel.get("complexity_reason"),
                token_usage=agent_tel.get("token_usage"),
                tools_invoked=agent_tel.get("tools_invoked"),
                thought_process=thought_process,
                agent_work_detail=agent_work_detail,
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
