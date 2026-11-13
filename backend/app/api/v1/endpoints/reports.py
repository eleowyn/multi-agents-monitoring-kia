import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.models.report import Report, ReportStatus
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.revision import RevisionRequest
from app.schemas.report import ReportResponse, ReportValidationRequest, ReportListItemResponse
from app.schemas.admin import BulkDeleteRequest
from app.api.v1.endpoints.auth import get_current_user
from app.services.pdf_service import generate_visit_report_pdf
from app.multiagent.graph import kia_multiagent_app
from app.services.aggregates import in_kader_scope, same_village, scoped_patient_ids

router = APIRouter()


def _check_report_scope(report: Report, current_user: User) -> None:
    """Kader hanya boleh mengakses laporan pasien di wilayahnya (P4-23)."""
    if report.patient and not in_kader_scope(report.patient, current_user):
        raise HTTPException(status_code=403, detail="Akses ditolak: Laporan ini milik Posyandu desa lain.")


@router.get("/", response_model=List[ReportListItemResponse])
def list_reports(
    status: Optional[ReportStatus] = None,
    overall_status: Optional[str] = None,
    search: Optional[str] = None,
    village_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mengambil daftar laporan KIA untuk arsip kader dan kelola laporan admin (Bab 4 Tabel 19).
    Mendukung filter status, risiko, wilayah/desa, dan rentang tanggal kunjungan.
    """
    query = (
        db.query(Report)
        .join(Patient, Report.patient_id == Patient.id)
        .join(Visit, Report.visit_id == Visit.id)
    )

    scope_ids = scoped_patient_ids(db, current_user)
    if scope_ids is not None:
        query = query.filter(Report.patient_id.in_(scope_ids))
    elif village_name:
        ids = [p.id for p in db.query(Patient.id, Patient.village_name).all() if same_village(p.village_name, village_name)]
        query = query.filter(Report.patient_id.in_(ids))

    if status:
        query = query.filter(Report.status == status)

    if overall_status:
        query = query.filter(Report.overall_status == overall_status)

    if start_date:
        query = query.filter(Visit.visit_date >= start_date)

    if end_date:
        query = query.filter(Visit.visit_date <= end_date)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter((Patient.name.ilike(s)) | (Patient.nik.like(s)))

    reports = query.order_by(Report.id.desc()).all()

    results = []
    for r in reports:
        p = r.patient
        v = r.visit
        latest_rev = None
        if v and v.revisions:
            latest_rev = v.revisions[-1].status.value if hasattr(v.revisions[-1].status, "value") else str(v.revisions[-1].status)
        results.append(
            ReportListItemResponse(
                id=r.id,
                visit_id=r.visit_id,
                patient_id=r.patient_id,
                patient_name=p.name if p else None,
                patient_nik=p.nik if p else None,
                patient_type=p.patient_type.value if (p and hasattr(p.patient_type, "value")) else (str(p.patient_type) if p else None),
                village_name=p.village_name if p else None,
                posyandu_name=p.posyandu_name if p else None,
                phase=v.phase.value if (v and hasattr(v.phase, "value")) else (str(v.phase) if v else None),
                visit_date=str(v.visit_date) if v else None,
                overall_status=r.overall_status,
                status=r.status,
                risk_count=len(r.risk_flags) if r.risk_flags else 0,
                revision_count=r.revision_count,
                validated_at=r.validated_at,
                has_pdf=(r.status == ReportStatus.APPROVED),
                latest_revision_status=latest_rev
            )
        )
    return results


def _extract_visit_data(visit: Optional[Visit], db: Optional[Session] = None, risk_flags: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    if not visit:
        return None
    phase_str = visit.phase.value if hasattr(visit.phase, "value") else str(visit.phase)
    patient = visit.patient
    p_type_str = (patient.patient_type.value if hasattr(patient.patient_type, "value") else str(patient.patient_type)) if patient else None

    from app.multiagent.tools.hpk_tracker import calculate_1000_hpk_status
    hpk_status = calculate_1000_hpk_status(
        phase=phase_str,
        patient_type=p_type_str,
        birth_date=patient.birth_date if patient else None,
        visit_date=visit.visit_date,
        gestational_age_weeks=visit.gestational_age_weeks,
        trimester=visit.trimester,
        age_in_months=visit.age_in_months,
    )

    longitudinal_summary = None
    mat_hist: Dict[str, Any] = {}
    raw_v = {
        "visit_date": str(visit.visit_date),
        "phase": phase_str,
        "trimester": visit.trimester,
        "gestational_age_weeks": visit.gestational_age_weeks,
        "maternal_weight_kg": visit.maternal_weight_kg,
        "lila_cm": visit.lila_cm,
        "hb_level": visit.hb_level,
        "age_in_months": visit.age_in_months,
        "child_weight_kg": visit.child_weight_kg,
        "child_length_cm": visit.child_length_cm,
        "birth_weight_gram": visit.birth_weight_gram,
        "birth_length_cm": visit.birth_length_cm,
    }
    if db is not None and patient is not None:
        from app.multiagent.state_builder import build_longitudinal_history, build_maternal_history
        from app.multiagent.agents.risk_detector import build_visit_comparison_summary
        past = build_longitudinal_history(db, patient.id, visit)
        mat_hist = build_maternal_history(db, patient) or {}
        longitudinal_summary = build_visit_comparison_summary(
            phase=phase_str,
            longitudinal=past,
            visit_data=raw_v,
            maternal_history=mat_hist,
            hpk_status=hpk_status,
        )

    from app.multiagent.agents.recommender import build_comprehensive_care_plan
    care_plan = build_comprehensive_care_plan(
        phase=phase_str,
        visit_data=raw_v,
        risk_flags=risk_flags or [],
        deterministic_results={"hpk_status": hpk_status},
        maternal_history=mat_hist,
    )

    return {
        "visit_date": str(visit.visit_date),
        "phase": phase_str,
        "gestational_age_weeks": visit.gestational_age_weeks,
        "trimester": visit.trimester,
        "maternal_weight_kg": visit.maternal_weight_kg,
        "maternal_height_cm": visit.maternal_height_cm,
        "lila_cm": visit.lila_cm,
        "hb_level": visit.hb_level,
        "systolic_bp": visit.systolic_bp,
        "diastolic_bp": visit.diastolic_bp,
        "fundal_height_cm": visit.fundal_height_cm,
        "kspr_answers": visit.kspr_answers,
        "birth_weight_gram": visit.birth_weight_gram,
        "birth_length_cm": visit.birth_length_cm,
        "head_circumference_cm": visit.head_circumference_cm,
        "gestational_age_at_birth_weeks": visit.gestational_age_at_birth_weeks,
        "early_initiation_breastfeeding": visit.early_initiation_breastfeeding,
        "age_in_months": visit.age_in_months,
        "child_weight_kg": visit.child_weight_kg,
        "child_length_cm": visit.child_length_cm,
        "child_head_circumference_cm": visit.child_head_circumference_cm,
        "weight_trend_kms": visit.weight_trend_kms,
        "feeding_status": visit.feeding_status,
        "vitamin_a": visit.vitamin_a,
        "immunization_status": visit.immunization_status,
        "clinical_notes": visit.clinical_notes,
        "hpk_status": hpk_status,
        "longitudinal_summary": longitudinal_summary,
        "care_plan": care_plan,
    }


def _norm_text(t: Any) -> str:
    import re as _re
    return _re.sub(r"\s+", " ", str(t or "")).strip().lower()


def _mark_legacy_quotes(recs: list) -> list:
    """
    Laporan lama menyimpan kutipan versi lama. Isinya TIDAK diubah; hanya diberi
    status: CHUNK_DOKUMEN bila kutipan masih ada di chunk ChromaDB yang dirujuk,
    selain itu KUTIPAN_VERSI_LAMA (belum terverifikasi terhadap chunk asli).
    """
    pending = [r for r in recs if isinstance(r, dict) and not r.get("evidence_status")]
    if not pending:
        return recs
    chunk_ids = [(r.get("citation") or {}).get("chunk_id") for r in pending]
    chunk_ids = [c for c in chunk_ids if c]
    chunk_text: Dict[str, str] = {}
    if chunk_ids:
        try:
            from app.multiagent.rag.vectorstore import get_or_create_collection
            got = get_or_create_collection().get(ids=list(set(chunk_ids)), include=["documents"])
            chunk_text = dict(zip(got["ids"], got["documents"]))
        except Exception:
            chunk_text = {}
    out = []
    for r in recs:
        if isinstance(r, dict) and not r.get("evidence_status"):
            r = dict(r)
            quote = _norm_text(r.get("evidence_quote"))
            doc = _norm_text(chunk_text.get((r.get("citation") or {}).get("chunk_id")))
            if not quote:
                r["evidence_status"] = "TANPA_KUTIPAN"
            elif doc and quote.rstrip(". ") in doc:
                r["evidence_status"] = "CHUNK_DOKUMEN"
            else:
                r["evidence_status"] = "KUTIPAN_VERSI_LAMA"
        out.append(r)
    return out


def _enrich_report_telemetry(report: Report, db: Session) -> None:
    """
    Melengkapi tampilan laporan TANPA mengarang data:
    - Status kutipan laporan lama ditandai (lihat _mark_legacy_quotes).
    - Telemetri agent hanya yang benar-benar tercatat saat analisis. Laporan lama yang
      tidak punya telemetri ditandai `available: False` (tidak dibuat angka sintetis).
    - Log evaluator paralel hanya dari tabel audit_logs; is_compliant NULL tetap NULL
      ("Tidak dievaluasi").
    """
    fr_json = dict(report.final_report_json or {})
    recs = list(report.recommendations or fr_json.get("recommendations") or [])
    if recs:
        recs = _mark_legacy_quotes(recs)
        report.recommendations = recs
        fr_json["recommendations"] = recs

    is_approved = report.status == ReportStatus.APPROVED
    rev_cnt = report.revision_count or 0

    existing_tel = dict(fr_json.get("agent_telemetry") or {})
    if not existing_tel or "agents" not in existing_tel:
        existing_tel = {
            "available": False,
            "note": "Telemetri agent tidak tercatat untuk laporan ini (dibuat sebelum pencatatan telemetri).",
            "agents": {},
        }
    else:
        existing_tel["available"] = True
        arch = existing_tel.get("architecture_pattern") or {}
        arch["thread_checkpoint_status"] = (
            "THREAD_CLOSED (Laporan Disetujui Kader - Siklus Hidup Selesai Permanen)"
            if is_approved
            else f"CHECKPOINT_STANDBY (Menunggu Validasi Kader • Iterasi Revisi: {rev_cnt}/1)"
        )
        existing_tel["architecture_pattern"] = arch

    audit_rows = (
        db.query(AuditLog)
        .filter(AuditLog.report_id == report.id)
        .order_by(AuditLog.id.asc())
        .all()
    )
    existing_tel["parallel_evaluator_logs"] = [
        {
            "id": row.id,
            "worker_thread": f"ParallelEval_{idx}",
            "agent_name": row.agent_name,
            "is_compliant": row.is_compliant,
            "evaluation_notes": row.evaluation_notes,
            "created_at": str(row.created_at),
        }
        for idx, row in enumerate(audit_rows)
    ]
    fr_json["agent_telemetry"] = existing_tel
    report.final_report_json = fr_json


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    _check_report_scope(report, current_user)
    _enrich_report_telemetry(report, db)
    report.visit_data = _extract_visit_data(report.visit, db, report.risk_flags)
    return report


@router.get("/visit/{visit_id}", response_model=ReportResponse)
def get_report_by_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.visit_id == visit_id).order_by(Report.id.desc()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan untuk kunjungan ini belum tersedia.")
    _check_report_scope(report, current_user)
    _enrich_report_telemetry(report, db)
    report.visit_data = _extract_visit_data(report.visit, db, report.risk_flags)
    return report


@router.post("/{report_id}/validate", response_model=ReportResponse)
def validate_report_by_kader(
    report_id: int,
    val_req: ReportValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")

    visit = db.query(Visit).filter(Visit.id == report.visit_id).first()
    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()

    _check_report_scope(report, current_user)

    if report.status != ReportStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail="Hanya laporan berstatus DRAFT yang dapat divalidasi. Perubahan laporan yang sudah disahkan dilakukan melalui pengajuan revisi ke Admin Puskesmas.",
        )

    if val_req.status == ReportStatus.APPROVED:
        report.status = ReportStatus.APPROVED
        report.validated_at = datetime.utcnow()
        report.rejection_reason = None

        filename = f"Laporan_KIA_{patient.nik}_{visit.visit_date}.pdf"
        visit_dict = _extract_visit_data(visit, db, report.risk_flags)
        pdf_path = generate_visit_report_pdf(
            report_data=report.final_report_json,
            visit_date=str(visit.visit_date),
            kader_name=current_user.full_name,
            validated_date=datetime.now().strftime("%d %B %Y"),
            filename=filename,
            visit_data=visit_dict
        )
        report.pdf_path = pdf_path

    elif val_req.status == ReportStatus.REJECTED:
        if report.revision_count >= 1:
            raise HTTPException(
                status_code=400,
                detail="Batas maksimal 1 kali revisi AI telah digunakan. Silakan sahkan laporan atau lakukan rujukan manual ke Puskesmas."
            )

        report.status = ReportStatus.REJECTED
        report.rejection_reason = val_req.rejection_reason
        report.revision_count += 1
        report.validated_at = datetime.utcnow()

        from app.multiagent.state_builder import build_initial_state

        initial_state = build_initial_state(
            db=db,
            visit=visit,
            patient=patient,
            village_fallback=current_user.village_name or "Airmadidi",
            kader_feedback=val_req.rejection_reason,
            iteration_count=report.revision_count,
        )

        # Thread baru per iterasi agar state analisis sebelumnya tidak terbawa (Bab 4.2.3 no.3)
        thread_config = {"configurable": {"thread_id": f"visit_{report.visit_id}_r{report.revision_count}"}}
        revised_state = kia_multiagent_app.invoke(initial_state, config=thread_config)

        report.risk_flags = revised_state.get("risk_flags", [])
        report.risk_narrative = revised_state.get("risk_narrative", "")
        report.recommendations = revised_state.get("recommendations", [])
        report.verification_summary = revised_state.get("verification_details", [])
        report.overall_status = revised_state.get("overall_status", report.overall_status)
        report.final_report_json = revised_state.get("final_report_json", {})
        report.status = ReportStatus.DRAFT

    db.commit()
    db.refresh(report)
    _enrich_report_telemetry(report, db)
    report.visit_data = _extract_visit_data(report.visit, db, report.risk_flags)
    return report


@router.get("/{report_id}/download-pdf")
def download_report_pdf(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.pdf_service import render_report_html, write_pdf_strict, PdfEngineUnavailable

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    _check_report_scope(report, current_user)
    if report.status != ReportStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Dokumen PDF hanya tersedia untuk laporan yang telah disahkan.")

    pdf_path = report.pdf_path
    needs_render = (
        not pdf_path
        or not pdf_path.lower().endswith(".pdf")
        or not os.path.exists(pdf_path)
    )

    if needs_render:
        visit = report.visit
        patient = report.patient
        if not visit or not patient:
            raise HTTPException(status_code=404, detail="Data kunjungan/pasien untuk laporan ini tidak ditemukan.")

        validated_dt = report.validated_at or datetime.now()
        kader_name = report.kader.full_name if report.kader else current_user.full_name
        try:
            html_out = render_report_html(
                report_data=report.final_report_json,
                visit_date=str(visit.visit_date),
                kader_name=kader_name,
                validated_date=validated_dt.strftime("%d %B %Y"),
                visit_data=_extract_visit_data(visit, db, report.risk_flags),
            )
            pdf_path = write_pdf_strict(html_out, f"Laporan_KIA_{patient.nik}_{visit.visit_date}_r{report.id}.pdf")
        except PdfEngineUnavailable as e:
            raise HTTPException(status_code=503, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gagal membuat dokumen PDF: {e}")

        report.pdf_path = pdf_path
        db.commit()

    patient = report.patient
    visit = report.visit
    safe_name = (patient.name if patient else "Pasien").replace(" ", "_")
    download_name = f"Laporan_KIA_{safe_name}_{visit.visit_date if visit else report.id}.pdf"
    return FileResponse(
        path=pdf_path,
        filename=download_name,
        media_type="application/pdf"
    )


@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang menghapus laporan.")

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")

    db.query(RevisionRequest).filter(RevisionRequest.report_id == report_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.report_id == report_id).delete(synchronize_session=False)

    if report.pdf_path and os.path.exists(report.pdf_path):
        try:
            os.remove(report.pdf_path)
        except Exception:
            pass

    db.delete(report)
    db.commit()
    return {"message": f"Laporan #{report_id} berhasil dihapus."}


@router.post("/bulk-delete")
def bulk_delete_reports(
    req: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Hanya Administrator Puskesmas yang berwenang menghapus laporan.")

    if not req.ids:
        return {"deleted_count": 0, "message": "Tidak ada laporan yang dipilih."}

    db.query(RevisionRequest).filter(RevisionRequest.report_id.in_(req.ids)).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.report_id.in_(req.ids)).delete(synchronize_session=False)

    reports = db.query(Report).filter(Report.id.in_(req.ids)).all()
    for r in reports:
        if r.pdf_path and os.path.exists(r.pdf_path):
            try:
                os.remove(r.pdf_path)
            except Exception:
                pass

    deleted_count = db.query(Report).filter(Report.id.in_(req.ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted_count, "message": f"{deleted_count} laporan berhasil dihapus."}
