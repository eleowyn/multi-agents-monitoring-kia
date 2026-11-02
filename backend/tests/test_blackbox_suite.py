import io
import pytest
import sys
import os
from datetime import date, datetime
from fastapi import HTTPException, BackgroundTasks
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import openpyxl

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import Base
from app.models.user import User, UserRole
from app.models.patient import Patient, PatientType, Gender
from app.models.visit import Visit, PhaseEnum
from app.models.report import Report, ReportStatus
from app.core.security import get_password_hash

# Schemas
from app.schemas.auth import LoginRequest
from app.schemas.patient import PatientCreate
from app.schemas.visit import VisitCreate
from app.schemas.report import ReportValidationRequest

# Endpoint Handlers (Black Box SUT Interface)
from app.api.v1.endpoints.auth import login
from app.api.v1.endpoints.patients import create_patient, get_patients
from app.api.v1.endpoints.visits import create_visit_and_analyze
from app.api.v1.endpoints.reports import validate_report_by_kader, list_reports
from app.api.v1.endpoints.doctor import get_doctor_monitoring_summary, _require_doctor_or_admin
from app.services.export_service import generate_puskesmas_excel_report


# -----------------------------------------------------------------------------
# Database In-Memory Terisolasi untuk Black Box Test Suite
# -----------------------------------------------------------------------------
SQLITE_TEST_URL = "sqlite:///:memory:"
engine_test = create_engine(
    SQLITE_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


@pytest.fixture(scope="module")
def db_session():
    """Menyiapkan schema dan sesi database untuk pengujian black box."""
    Base.metadata.create_all(bind=engine_test)
    db = TestingSessionLocal()

    # Seed User Peran Standar
    kader = User(
        username="kader1",
        email="kader1@posyandu-airmadidi.go.id",
        hashed_password=get_password_hash("kader123"),
        full_name="Kader Posyandu Airmadidi",
        role=UserRole.KADER,
        is_active=True,
        posyandu_name="Posyandu Mawar",
        village_name="Airmadidi Atas",
    )
    dokter = User(
        username="dokter",
        email="dokter@puskesmas-airmadidi.go.id",
        hashed_password=get_password_hash("dokter123"),
        full_name="Penanggung Jawab KIA",
        role=UserRole.DOKTER,
        is_active=True,
        posyandu_name="Puskesmas Airmadidi",
        village_name="Kecamatan Airmadidi",
    )
    admin = User(
        username="admin",
        email="admin@puskesmas-airmadidi.go.id",
        hashed_password=get_password_hash("admin123"),
        full_name="Administrator Sistem",
        role=UserRole.ADMIN,
        is_active=True,
        posyandu_name="Puskesmas Airmadidi",
        village_name="Kecamatan Airmadidi",
    )
    db.add_all([kader, dokter, admin])
    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine_test)


# =============================================================================
# MODUL 1: AUTENTIKASI DAN OTORISASI RBAC (ROLE-BASED ACCESS CONTROL)
# =============================================================================
class TestModule1AuthRBAC:
    """Menguji modul autentikasi dan penegakan hak akses berbasis peran."""

    def test_tc_auth_01_login_kader_valid(self, db_session):
        """TC-AUTH-01: Login Kader dengan kredensial valid menghasilkan JWT token dan profil peran KADER."""
        req = LoginRequest(username="kader1", password="kader123")
        res = login(login_req=req, db=db_session)
        assert res["access_token"] is not None
        assert len(res["access_token"]) > 20
        assert res["user"].role == UserRole.KADER

    def test_tc_auth_02_login_dokter_valid(self, db_session):
        """TC-AUTH-02: Login Dokter dengan kredensial valid menghasilkan JWT token dan peran DOKTER."""
        req = LoginRequest(username="dokter", password="dokter123")
        res = login(login_req=req, db=db_session)
        assert res["access_token"] is not None
        assert res["user"].role == UserRole.DOKTER

    def test_tc_auth_03_login_admin_valid(self, db_session):
        """TC-AUTH-03: Login Admin dengan kredensial valid menghasilkan JWT token dan peran ADMIN."""
        req = LoginRequest(username="admin", password="admin123")
        res = login(login_req=req, db=db_session)
        assert res["access_token"] is not None
        assert res["user"].role == UserRole.ADMIN

    def test_tc_auth_04_login_password_salah_ditolak(self, db_session):
        """TC-AUTH-04 (Negative): Login dengan password salah ditolak dengan HTTP 401 Unauthorized."""
        req = LoginRequest(username="kader1", password="password_salah_total")
        with pytest.raises(HTTPException) as exc_info:
            login(login_req=req, db=db_session)
        assert exc_info.value.status_code == 401
        assert "salah" in exc_info.value.detail.lower()

    def test_tc_auth_05_kader_dilarang_akses_portal_dokter(self, db_session):
        """TC-AUTH-05 (Negative): Otorisasi RBAC menolak peran Kader saat mengakses fungsi Dokter (HTTP 403 Forbidden)."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        with pytest.raises(HTTPException) as exc_info:
            _require_doctor_or_admin(user=kader)
        assert exc_info.value.status_code == 403
        assert "khusus dokter" in exc_info.value.detail.lower()


# =============================================================================
# MODUL 2: PENDAFTARAN PASIEN & VALIDASI INPUT (EQUIVALENCE PARTITIONING)
# =============================================================================
class TestModule2PatientManagement:
    """Menguji pendaftaran sasaran 1.000 HPK (Balita & Ibu Hamil) serta integritas NIK."""

    def test_tc_pat_01_daftar_balita_sukses(self, db_session):
        """TC-PAT-01: Pendaftaran balita baru dengan NIK 16 digit berhasil disimpan dengan benar."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        p_in = PatientCreate(
            nik="7106010101230001",
            name="Balita Uji Coba A",
            patient_type=PatientType.CHILD,
            gender=Gender.MALE,
            birth_date=date(2025, 1, 15),
            address="Jaga 2 Airmadidi Atas",
            village_name="Airmadidi Atas",
            posyandu_name="Posyandu Mawar",
        )
        patient = create_patient(patient_in=p_in, db=db_session, current_user=kader)
        assert patient.id is not None
        assert patient.nik == "7106010101230001"
        assert patient.patient_type == PatientType.CHILD

    def test_tc_pat_02_daftar_ibu_hamil_sukses(self, db_session):
        """TC-PAT-02: Pendaftaran ibu hamil baru berhasil disimpan dengan relasi wilayah Posyandu."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        p_in = PatientCreate(
            nik="7106014502980002",
            name="Ibu Hamil Uji B",
            patient_type=PatientType.MOTHER,
            gender=Gender.FEMALE,
            birth_date=date(1998, 2, 15),
            address="Jaga 1 Airmadidi Atas",
            village_name="Airmadidi Atas",
            posyandu_name="Posyandu Mawar",
        )
        patient = create_patient(patient_in=p_in, db=db_session, current_user=kader)
        assert patient.id is not None
        assert patient.patient_type == PatientType.MOTHER

    def test_tc_pat_03_duplikasi_nik_ditolak(self, db_session):
        """TC-PAT-03 (Negative): Pendaftaran dengan NIK yang sama (duplikat) wajib ditolak dengan HTTP 400."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        p_in = PatientCreate(
            nik="7106010101230001",  # NIK sama dengan TC-PAT-01
            name="Balita Duplikat NIK",
            patient_type=PatientType.CHILD,
            gender=Gender.MALE,
            birth_date=date(2025, 1, 15),
        )
        with pytest.raises(HTTPException) as exc_info:
            create_patient(patient_in=p_in, db=db_session, current_user=kader)
        assert exc_info.value.status_code == 400
        assert "sudah terdaftar" in exc_info.value.detail.lower()


# =============================================================================
# MODUL 3 & 4: PENCATATAN KUNJUNGAN & PIPELINE MULTI-AGENT AI REAL-TIME
# =============================================================================
class TestModule3And4MultiAgentOrchestration:
    """Menguji eksekusi orkestrasi 3 Agent AI (Deteksi Risiko, Rekomendasi ReAct/RAG, Verifikasi)."""

    def test_tc_mag_01_analisis_balita_stunting_dan_gizi_kurang(self, db_session):
        """TC-MAG-01: Pencatatan kunjungan balita stunting memicu Agent 1, Agent 2, dan Agent 3 secara berurutan."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        patient = db_session.query(Patient).filter(Patient.nik == "7106010101230001").first()

        # Usia 12 bulan, PB 68.0 cm (Z < -3.0 SD -> Severely Stunted), BB 6.5 kg (Z < -2.0 SD -> Underweight)
        v_in = VisitCreate(
            patient_id=patient.id,
            visit_date=date.today(),
            phase=PhaseEnum.BADUTA,
            age_in_months=12,
            child_length_cm=68.0,
            child_weight_kg=6.5,
            weight_trend_kms="T",
            feeding_status="MPASI_DEFISIT",
            vitamin_a="BELUM",
        )
        bg = BackgroundTasks()
        report = create_visit_and_analyze(visit_in=v_in, background_tasks=bg, db=db_session, current_user=kader)

        assert report.id is not None
        assert report.status == ReportStatus.DRAFT  # Menunggu validasi Kader
        assert report.overall_status in ("RISIKO_TINGGI", "PERLU_INTERVENSI")

        # Bukti Agent 1 (Deteksi Risiko): Flag STUNTING teridentifikasi
        risk_flags = [f.get("flag", "") for f in (report.risk_flags or [])]
        assert any("STUNTING" in f for f in risk_flags), f"Flag stunting tidak terdeteksi: {risk_flags}"

        # Bukti Agent 2 (Rekomendasi ReAct): Rekomendasi pangan lokal & porsi tersedia
        recs = report.recommendations or []
        assert len(recs) > 0, "Rekomendasi klinis kosong"
        assert "food_guide" in recs[0]
        assert "citation" in recs[0]

        # Bukti Agent 3 (Verifikasi): JSON lengkap siap evaluasi
        assert report.final_report_json is not None
        assert "clinical_findings" in report.final_report_json

    def test_tc_mag_02_analisis_ibu_hamil_kek_dan_anemia(self, db_session):
        """TC-MAG-02: Pencatatan kunjungan bumil dengan LiLA < 23.5 cm & Hb < 11.0 g/dL memicu deteksi KEK & Anemia."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        patient = db_session.query(Patient).filter(Patient.nik == "7106014502980002").first()

        v_in = VisitCreate(
            patient_id=patient.id,
            visit_date=date.today(),
            phase=PhaseEnum.IBU_HAMIL,
            gestational_age_weeks=22,
            trimester=2,
            maternal_weight_kg=44.5,
            maternal_height_cm=149.0,
            lila_cm=21.5,     # < 23.5 cm -> KEK Maternal
            hb_level=9.5,      # < 11.0 g/dL -> Anemia Maternal
            ttd_consumption="30_TABLET",
        )
        bg = BackgroundTasks()
        report = create_visit_and_analyze(visit_in=v_in, background_tasks=bg, db=db_session, current_user=kader)

        assert report.id is not None
        flags = [f.get("flag", "") for f in (report.risk_flags or [])]
        assert any("KEK" in f for f in flags), "Agent 1 gagal mendeteksi KEK Maternal"
        assert any("ANEMIA" in f for f in flags), "Agent 1 gagal mendeteksi Anemia Maternal"

    def test_tc_mag_03_pertumbuhan_balita_normal_bypasses_rag(self, db_session):
        """TC-MAG-03: Kunjungan anak normal menghasilkan status KONDISI_BAIK tanpa flag risiko gawat."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        p_in = PatientCreate(
            nik="7106010505240003",
            name="Balita Sehat Standar WHO",
            patient_type=PatientType.CHILD,
            gender=Gender.MALE,
            birth_date=date(2025, 1, 1),
            village_name="Airmadidi Atas",
        )
        patient = create_patient(patient_in=p_in, db=db_session, current_user=kader)

        # 12 bulan dengan parameter ideal (PB 76.0 cm, BB 9.8 kg)
        v_in = VisitCreate(
            patient_id=patient.id,
            visit_date=date.today(),
            phase=PhaseEnum.BADUTA,
            age_in_months=12,
            child_length_cm=76.0,
            child_weight_kg=9.8,
            weight_trend_kms="N",
            feeding_status="ASI_DAN_MPASI_LOKAL",
            vitamin_a="SUDAH",
        )
        bg = BackgroundTasks()
        report = create_visit_and_analyze(visit_in=v_in, background_tasks=bg, db=db_session, current_user=kader)
        assert report.overall_status == "KONDISI_BAIK"
        assert len(report.risk_flags or []) == 0


# =============================================================================
# MODUL 5: HUMAN-IN-THE-LOOP KADER (REVISI, VALIDASI & BOUNDARY SAFEGUARD)
# =============================================================================
class TestModule5HumanInTheLoopKader:
    """Menguji siklus validasi Kader, penolakan revisi, dan penegakan batas maksimal 1x revisi."""

    def test_tc_hitl_01_kader_tolak_dan_minta_revisi_pertama(self, db_session):
        """TC-HITL-01: Kader melakukan penolakan draf dengan catatan revisi alergi telur; sistem merevisi dan revision_count = 1."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        # Ambil laporan draf pertama
        report = db_session.query(Report).filter(Report.status == ReportStatus.DRAFT).first()
        assert report is not None

        val_req = ReportValidationRequest(
            status=ReportStatus.REJECTED,
            rejection_reason="Anak alergi telur ayam, tolong ganti rekomendasi lauk hewani dengan ikan tude atau hati ayam.",
        )
        updated_report = validate_report_by_kader(
            report_id=report.id,
            val_req=val_req,
            db=db_session,
            current_user=kader
        )
        assert updated_report.revision_count == 1
        assert updated_report.rejection_reason == val_req.rejection_reason

    def test_tc_hitl_02_kader_dilarang_revisi_kedua_kali(self, db_session):
        """TC-HITL-02 (Boundary Safeguard): Upaya revisi kedua (>1x revisi) WAJIB ditolak oleh sistem dengan HTTP 400."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        report = db_session.query(Report).filter(Report.revision_count >= 1).first()
        assert report is not None

        val_req = ReportValidationRequest(
            status=ReportStatus.REJECTED,
            rejection_reason="Permintaan revisi ke-2 yang harus ditolak demi integritas asuhan medis.",
        )
        with pytest.raises(HTTPException) as exc_info:
            validate_report_by_kader(
                report_id=report.id,
                val_req=val_req,
                db=db_session,
                current_user=kader
            )
        assert exc_info.value.status_code == 400
        assert "Batas maksimal 1 kali revisi" in exc_info.value.detail

    def test_tc_hitl_03_kader_mengesahkan_laporan_approved(self, db_session):
        """TC-HITL-03: Kader menyetujui (APPROVE) laporan; status menjadi APPROVED dan tanggal pengesahan tercatat."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        report = db_session.query(Report).filter(Report.status != ReportStatus.APPROVED).first()
        assert report is not None

        val_req = ReportValidationRequest(status=ReportStatus.APPROVED)
        approved_report = validate_report_by_kader(
            report_id=report.id,
            val_req=val_req,
            db=db_session,
            current_user=kader
        )
        assert approved_report.status == ReportStatus.APPROVED
        assert approved_report.validated_at is not None


# =============================================================================
# MODUL 6: SUPERVISI DOKTER PUSKESMAS & EKSPOR DINKES MULTI-SHEET
# =============================================================================
class TestModule6DoctorSupervisionAndExports:
    """Menguji modul supervisi Dokter, rekapitulasi posyandu, dan ekspor Excel resmi."""

    def test_tc_doc_01_dokter_akses_monitoring_summary(self, db_session):
        """TC-DOC-01: Dokter mengakses ringkasan prevalensi kasus dan daftar rekam pasien berisiko."""
        dokter = db_session.query(User).filter(User.username == "dokter").first()
        summary = get_doctor_monitoring_summary(
            posyandu=None,
            posyandu_name=None,
            village_name=None,
            month=None,
            db=db_session,
            current_user=dokter,
        )
        assert "summary_stats" in summary
        assert "risky_patients" in summary
        assert "posyandu_list" in summary
        assert len(summary["posyandu_list"]) >= 9

    def test_tc_doc_02_dokter_filter_posyandu_spesifik(self, db_session):
        """TC-DOC-02: Dokter menyaring data berdasarkan nama posyandu tertentu (Posyandu Mawar)."""
        dokter = db_session.query(User).filter(User.username == "dokter").first()
        summary = get_doctor_monitoring_summary(
            posyandu="Posyandu Mawar",
            posyandu_name=None,
            village_name=None,
            month=None,
            db=db_session,
            current_user=dokter,
        )
        assert summary["summary_stats"] is not None

    def test_tc_doc_03_ekspor_excel_resmi_3_sheet(self, db_session):
        """TC-DOC-03: Dokter mengunduh berkas Excel resmi 3 Sheet berstandar Dinkes Minahasa Utara."""
        stream = generate_puskesmas_excel_report(db=db_session)
        assert isinstance(stream, io.BytesIO)
        raw_bytes = stream.getvalue()
        assert len(raw_bytes) > 2000, "Ukuran file Excel terlalu kecil atau korup"

        # Verifikasi struktur sheet menggunakan openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(raw_bytes))
        sheet_names = wb.sheetnames
        assert "Balita_ePPGBM_ASIK" in sheet_names
        assert "Bumil_ANC_ASIK" in sheet_names
        assert "Rujukan_SIMPUS_SATUSEHAT" in sheet_names

        # Periksa kop surat pada sheet balita
        ws_balita = wb["Balita_ePPGBM_ASIK"]
        assert "MINAHASA UTARA" in str(ws_balita["A1"].value)
        assert "AIRMADIDI" in str(ws_balita["A2"].value)


# =============================================================================
# MODUL 7: PENGUJIAN BATAS EKSTREM & KETAHANAN SISTEM (ROBUSTNESS TESTING)
# =============================================================================
class TestModule7RobustnessAndBoundaries:
    """Menguji ketahanan sistem saat menghadapi input tidak valid atau anomali."""

    def test_tc_rob_01_kunjungan_pasien_tidak_ditemukan(self, db_session):
        """TC-ROB-01 (Negative): Pencatatan kunjungan untuk ID pasien yang tidak terdaftar menghasilkan HTTP 404."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        v_in = VisitCreate(
            patient_id=999999,  # ID fiktif
            visit_date=date.today(),
            phase=PhaseEnum.BADUTA,
            age_in_months=6,
        )
        with pytest.raises(HTTPException) as exc_info:
            create_visit_and_analyze(visit_in=v_in, background_tasks=BackgroundTasks(), db=db_session, current_user=kader)
        assert exc_info.value.status_code == 404
        assert "tidak ditemukan" in exc_info.value.detail.lower()

    def test_tc_rob_02_validasi_laporan_tidak_ditemukan(self, db_session):
        """TC-ROB-02 (Negative): Kader memvalidasi ID laporan yang tidak ada menghasilkan HTTP 404."""
        kader = db_session.query(User).filter(User.username == "kader1").first()
        val_req = ReportValidationRequest(status=ReportStatus.APPROVED)
        with pytest.raises(HTTPException) as exc_info:
            validate_report_by_kader(report_id=999999, val_req=val_req, db=db_session, current_user=kader)
        assert exc_info.value.status_code == 404
        assert "tidak ditemukan" in exc_info.value.detail.lower()
