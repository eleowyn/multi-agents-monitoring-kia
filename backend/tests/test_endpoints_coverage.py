import os
import sys
from datetime import date, timedelta

import pytest
from fastapi import BackgroundTasks, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.services.eval_logger as eval_logger
from app.api.v1.endpoints import (
    admin,
    auth,
    kader,
    patients,
    reports,
    revisions,
    schedules,
    visits,
)
from app.core.database import Base
from app.models.patient import Gender, PatientType
from app.models.report import ReportStatus
from app.models.revision import RevisionStatus
from app.models.user import User, UserRole
from app.models.visit import PhaseEnum
from app.schemas.admin import BulkDeleteRequest
from app.schemas.patient import PatientCreate
from app.schemas.report import ReportValidationRequest
from app.schemas.revision import RevisionCreate, RevisionValidationRequest
from app.schemas.visit import VisitCreate

engine_cov = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
CovSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_cov)


@pytest.fixture(scope="module")
def db():
    orig_session = eval_logger.SessionLocal
    eval_logger.SessionLocal = CovSessionLocal
    Base.metadata.create_all(bind=engine_cov)
    session = CovSessionLocal()
    auth.seed_default_users(session)
    # Kader desa lain untuk menguji isolasi wilayah (cross-village scoping)
    other_kader = User(
        username="kader_sukur",
        email="kader_sukur@test.local",
        hashed_password=auth.get_password_hash("kader123"),
        full_name="Kader Sukur",
        role=UserRole.KADER,
        is_active=True,
        posyandu_name="Kelurahan Sukur",
        village_name="Sukur",
    )
    session.add(other_kader)
    session.commit()
    yield session
    session.close()
    eval_logger.SessionLocal = orig_session
    Base.metadata.drop_all(bind=engine_cov)


def test_auth_token_form_and_me(db):
    res = auth.login_form(
        form_data=OAuth2PasswordRequestForm(username="kader1", password="kader123", scope=""),
        db=db,
    )
    assert res["access_token"]
    kader_u = db.query(User).filter(User.username == "kader1").first()
    me = auth.get_me(current_user=kader_u)
    assert me.username == "kader1"


def test_full_uncovered_endpoints_and_revisions_lifecycle(db):
    kader_u = db.query(User).filter(User.username == "kader1").first()
    other_kader = db.query(User).filter(User.username == "kader_sukur").first()
    admin_u = db.query(User).filter(User.username == "admin").first()

    # 1. Patient create, get, longitudinal
    p = patients.create_patient(
        PatientCreate(
            nik="7106010101246001",
            name="Anak Coverage Uji",
            patient_type=PatientType.CHILD,
            gender=Gender.MALE,
            birth_date=date.today() - timedelta(days=365),
            village_name="Airmadidi Atas",
            posyandu_name="Posyandu Mawar",
        ),
        db=db,
        current_user=kader_u,
    )
    assert patients.get_patient(p.id, db=db, current_user=kader_u).id == p.id
    longit = patients.get_longitudinal_history(p.id, db=db, current_user=kader_u)
    assert longit["patient"].id == p.id

    # Cross-village access rejected
    with pytest.raises(HTTPException) as exc:
        patients.get_patient(p.id, db=db, current_user=other_kader)
    assert exc.value.status_code == 403

    # 2. Visit create, eval_logger parallel run, get_visit
    bg = BackgroundTasks()
    rep = visits.create_visit_and_analyze(
        VisitCreate(
            patient_id=p.id,
            visit_date=date.today(),
            phase=PhaseEnum.BADUTA,
            child_length_cm=68.0,
            child_weight_kg=6.8,
            weight_trend_kms="T",
            feeding_status="MPASI_DEFISIT",
        ),
        background_tasks=bg,
        db=db,
        current_user=kader_u,
    )
    for t in bg.tasks:
        t.func(*t.args, **t.kwargs)

    assert visits.get_visit(rep.visit_id, db=db, current_user=kader_u).id == rep.visit_id
    with pytest.raises(HTTPException) as exc_v:
        visits.get_visit(rep.visit_id, db=db, current_user=other_kader)
    assert exc_v.value.status_code == 403

    # Confidence label uses PERLU_TINJAUAN_KLINIS instead of DOKTER when score < 70
    conf = (rep.final_report_json or {}).get("confidence") or {}
    if conf.get("confidence_score", 100) < 70:
        assert conf.get("confidence_label") == "PERLU_TINJAUAN_KLINIS"

    # 3. Reports get, get_by_visit, approve, download_pdf
    assert reports.get_report(rep.id, db=db, current_user=kader_u).id == rep.id
    assert reports.get_report_by_visit(rep.visit_id, db=db, current_user=kader_u).id == rep.id
    # Admin dilarang memvalidasi / meminta revisi laporan (khusus KADER)
    with pytest.raises(HTTPException) as exc_adm_val:
        reports.validate_report_by_kader(
            rep.id,
            ReportValidationRequest(status=ReportStatus.APPROVED),
            background_tasks=BackgroundTasks(),
            db=db,
            current_user=admin_u,
        )
    assert exc_adm_val.value.status_code == 403

    reports.validate_report_by_kader(
        rep.id,
        ReportValidationRequest(status=ReportStatus.APPROVED),
        background_tasks=BackgroundTasks(),
        db=db,
        current_user=kader_u,
    )
    pdf_resp = reports.download_report_pdf(rep.id, db=db, current_user=kader_u)
    assert pdf_resp.media_type == "application/pdf"
    if pdf_resp.path and os.path.exists(pdf_resp.path):
        os.remove(pdf_resp.path)

    # 4. Kader dashboard, Admin patient-trend, audit-logs, knowledge-chunks, report-citations, schedules
    kd = kader.get_kader_dashboard_summary(db=db, current_user=kader_u)
    assert kd.total_patients >= 1

    trend = admin.get_patient_trend(p.id, db=db, current_user=admin_u)
    assert len(trend.points) == 1

    logs = admin.get_audit_logs(db=db, admin=admin_u)
    assert len(logs) == 3

    kb = admin.admin_list_knowledge_chunks(limit=5, admin=admin_u)
    assert kb["total_collection_chunks"] > 0

    cits = admin.admin_get_report_rag_citations(report_id=rep.id, db=db, admin=admin_u)
    assert cits["total_reports"] == 1

    assert len(admin.get_kaders(db=db, admin=admin_u)) >= 1
    schedules.ensure_default_schedules_seeded(db)
    assert len(schedules.list_schedules(db=db, current_user=admin_u)) >= 14

    # 5. Revisions: submit, list, detail, cross-village guard, validate edit (APPROVED & REJECTED)
    rev_edit = revisions.submit_revision_request(
        RevisionCreate(
            visit_id=rep.visit_id,
            reason="Koreksi berat badan",
            proposed_data={"child_weight_kg": 9.1},
        ),
        db=db,
        current_user=kader_u,
    )
    assert len(revisions.get_revision_requests(db=db, current_user=kader_u)) == 1
    assert revisions.get_revision_detail(rev_edit.id, db=db, current_user=kader_u).id == rev_edit.id

    with pytest.raises(HTTPException) as exc_rev:
        revisions.get_revision_detail(rev_edit.id, db=db, current_user=other_kader)
    assert exc_rev.value.status_code == 403

    bg_rev = BackgroundTasks()
    approved_rev = revisions.validate_revision_by_admin(
        rev_edit.id,
        RevisionValidationRequest(status=RevisionStatus.APPROVED, admin_notes="Disetujui"),
        background_tasks=bg_rev,
        db=db,
        admin=admin_u,
    )
    assert approved_rev.status == RevisionStatus.APPROVED
    for t in bg_rev.tasks:
        t.func(*t.args, **t.kwargs)

    # Setelah Admin approve revisi data, report kembali DRAFT & kuota 1x Minta Revisi Kader terkunci
    db.refresh(rep)
    assert rep.status == ReportStatus.DRAFT
    assert rep.revision_count >= 1
    # Simulasikan laporan lama di DB (revision_count masih 0 walau sudah punya RevisionRequest APPROVED)
    rep.revision_count = 0
    db.commit()
    fetched_rep = reports.get_report(rep.id, db=db, current_user=kader_u)
    assert fetched_rep.revision_count == 1
    with pytest.raises(HTTPException) as exc_locked:
        reports.validate_report_by_kader(
            rep.id,
            ReportValidationRequest(status=ReportStatus.REJECTED, rejection_reason="Coba revisi lagi"),
            background_tasks=BackgroundTasks(),
            db=db,
            current_user=kader_u,
        )
    assert exc_locked.value.status_code == 400

    rev_rej = revisions.submit_revision_request(
        RevisionCreate(
            visit_id=rep.visit_id,
            reason="Tes ditolak",
            proposed_data={"child_weight_kg": 9.3},
        ),
        db=db,
        current_user=kader_u,
    )
    rejected_rev = revisions.validate_revision_by_admin(
        rev_rej.id,
        RevisionValidationRequest(status=RevisionStatus.REJECTED, admin_notes="Data sudah sesuai"),
        background_tasks=BackgroundTasks(),
        db=db,
        admin=admin_u,
    )
    assert rejected_rev.status == RevisionStatus.REJECTED

    # 6. Revisions DELETE approval must preserve RevisionRequest row cleanly without cascade crash
    rev_del = revisions.submit_revision_request(
        RevisionCreate(
            visit_id=rep.visit_id,
            reason="Hapus kunjungan ganda",
            proposed_data={"_action": "DELETE"},
        ),
        db=db,
        current_user=kader_u,
    )
    deleted_rev = revisions.validate_revision_by_admin(
        rev_del.id,
        RevisionValidationRequest(status=RevisionStatus.APPROVED, admin_notes="Dihapus"),
        background_tasks=BackgroundTasks(),
        db=db,
        admin=admin_u,
    )
    assert deleted_rev.status == RevisionStatus.APPROVED
    assert deleted_rev.visit_id is None

    # 7. Cleanup & bulk endpoints
    p2 = patients.create_patient(
        PatientCreate(
            nik="7106010101246002",
            name="Anak Bulk Hapus",
            patient_type=PatientType.CHILD,
            gender=Gender.FEMALE,
            birth_date=date.today() - timedelta(days=200),
            village_name="Airmadidi Atas",
        ),
        db=db,
        current_user=kader_u,
    )
    bg2 = BackgroundTasks()
    rep2 = visits.create_visit_and_analyze(
        VisitCreate(
            patient_id=p2.id,
            visit_date=date.today(),
            phase=PhaseEnum.BADUTA,
            child_length_cm=67.0,
            child_weight_kg=7.5,
        ),
        background_tasks=bg2,
        db=db,
        current_user=kader_u,
    )
    for t in bg2.tasks:
        t.func(*t.args, **t.kwargs)
    logs2 = admin.get_audit_logs(db=db, admin=admin_u)
    assert len(logs2) >= 3
    assert admin.bulk_delete_audit_logs(BulkDeleteRequest(ids=[logs2[0].id]), db=db, admin=admin_u)["deleted_count"] == 1
    assert admin.clear_all_audit_logs(db=db, admin=admin_u)["deleted_count"] >= 2

    assert reports.bulk_delete_reports(BulkDeleteRequest(ids=[rep2.id]), db=db, current_user=admin_u)["deleted_count"] == 1
    assert patients.bulk_delete_patients(BulkDeleteRequest(ids=[p.id, p2.id]), db=db, current_user=admin_u)["deleted_count"] == 2
    assert admin.bulk_delete_kaders(BulkDeleteRequest(ids=[other_kader.id]), db=db, admin=admin_u)["deleted_count"] == 1


def test_pantauan_berisiko_includes_stunting_sedang_and_graduation_distinguishes_obesity(db):
    from app.multiagent.agents.recommender import build_comprehensive_care_plan

    kader_u = db.query(User).filter(User.username == "kader1").first()
    admin_u = db.query(User).filter(User.username == "admin").first()

    # Anak 12 bulan PB 70.0 cm (Z = -2.32 SD -> RISIKO_STUNTING / PERLU_PERHATIAN) + BB 9.6 kg (normal)
    p = patients.create_patient(
        PatientCreate(
            nik="7106010101246099",
            name="Anak Stunting Sedang",
            patient_type=PatientType.CHILD,
            gender=Gender.MALE,
            birth_date=date.today() - timedelta(days=365),
            village_name="Airmadidi Atas",
            posyandu_name="Posyandu Mawar",
        ),
        db=db,
        current_user=kader_u,
    )
    rep = visits.create_visit_and_analyze(
        VisitCreate(
            patient_id=p.id,
            visit_date=date.today(),
            phase=PhaseEnum.BADUTA,
            child_length_cm=70.0,
            child_weight_kg=9.6,
        ),
        background_tasks=BackgroundTasks(),
        db=db,
        current_user=kader_u,
    )
    assert rep.overall_status == "PERLU_PERHATIAN"
    kd = kader.get_kader_dashboard_summary(db=db, current_user=kader_u)
    assert kd.high_risk_count >= 1
    assert any(item.patient_id == p.id for item in kd.priority_patients)

    # Uji Kelulusan 1.000 HPK (24 bulan): Obesitas saja vs Stunting + Obesitas
    plan_obese = build_comprehensive_care_plan(
        phase="BADUTA",
        visit_data={"age_in_months": 24, "child_weight_kg": 18.0, "child_length_cm": 87.0},
        risk_flags=[{"flag": "RISIKO_OBESITAS", "detail": "BB/PB > +3 SD"}],
    )
    assert plan_obese["graduation_package"]["graduation_status"] == "PERHATIAN_KHUSUS_GIZI_LEBIH"
    assert plan_obese["graduation_package"]["status_type"] == "ALERT"

    plan_both = build_comprehensive_care_plan(
        phase="BADUTA",
        visit_data={"age_in_months": 24, "child_weight_kg": 18.0, "child_length_cm": 79.0},
        risk_flags=[
            {"flag": "RISIKO_STUNTING", "detail": "PB/U < -2 SD"},
            {"flag": "RISIKO_OBESITAS", "detail": "BB/PB > +3 SD"},
        ],
    )
    assert plan_both["graduation_package"]["graduation_status"] == "PERHATIAN_KHUSUS_STUNTING_DAN_GIZI_LEBIH"

    assert reports.delete_report(rep.id, db=db, current_user=admin_u)
    assert patients.delete_patient(p.id, db=db, current_user=admin_u)
