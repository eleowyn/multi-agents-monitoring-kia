import pytest
import sys
import os
import time
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.database import Base, get_db
from app.api.v1.endpoints.auth import seed_default_users
import app.services.eval_logger as eval_logger

# Database SQLite di memori: pengujian tidak boleh menulis ke database MySQL aplikasi
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _get_test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = _get_test_db
    original_session = eval_logger.SessionLocal
    eval_logger.SessionLocal = SessionLocal  # log evaluator latar belakang ikut ke DB uji
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_default_users(db)
    db.close()
    yield
    app.dependency_overrides.pop(get_db, None)
    eval_logger.SessionLocal = original_session
    Base.metadata.drop_all(bind=engine)


def test_auth_login_kader():
    """Menguji login kader dengan kredensial demo."""
    response = client.post("/api/v1/auth/login", json={
        "username": "kader1",
        "password": "kader123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "KADER"


def test_auth_login_admin():
    """Menguji login admin dengan kredensial demo."""
    response = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"


def test_create_patient_and_visit_flow():
    """Menguji pendaftaran pasien, pencatatan kunjungan, dan validasi approval."""
    # 1. Login Kader
    login_res = client.post("/api/v1/auth/login", json={
        "username": "kader1",
        "password": "kader123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Generate unique 16-digit NIK
    unique_nik = f"7106{int(time.time()*1000)%1000000000000:012d}"

    # 2. Buat Pasien Ibu Hamil
    patient_res = client.post("/api/v1/patients/", headers=headers, json={
        "nik": unique_nik,
        "name": "Ibu Uji Endpoints",
        "patient_type": "MOTHER",
        "birth_date": "1998-05-12",
        "gender": None,
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Posyandu Mawar"
    })
    assert patient_res.status_code == 200
    patient_id = patient_res.json()["id"]

    # 3. Buat Kunjungan KEK & Anemia
    visit_res = client.post("/api/v1/visits/", headers=headers, json={
        "patient_id": patient_id,
        "visit_date": "2026-08-25",
        "phase": "IBU_HAMIL",
        "trimester": 1,
        "lila_cm": 22.0,
        "hb_level": 9.5
    })
    assert visit_res.status_code == 200
    report_data = visit_res.json()
    assert report_data["overall_status"] in ["PERLU_PERHATIAN", "RISIKO_TINGGI"]
    assert len(report_data["risk_flags"]) >= 1
    report_id = report_data["id"]

    # 4. Validasi Approval oleh Kader
    val_res = client.post(f"/api/v1/reports/{report_id}/validate", headers=headers, json={
        "status": "APPROVED"
    })
    assert val_res.status_code == 200
    assert val_res.json()["status"] == "APPROVED"
    assert val_res.json()["pdf_path"] is not None


def test_admin_crud_patient_and_revision_limit():
    """Menguji CRUD Update/Delete Pasien oleh Admin dan pembatasan 1x revisi."""
    # 1. Login Admin
    admin_login = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Login Kader
    kader_login = client.post("/api/v1/auth/login", json={
        "username": "kader1",
        "password": "kader123"
    })
    kader_token = kader_login.json()["access_token"]
    kader_headers = {"Authorization": f"Bearer {kader_token}"}

    unique_nik = f"7106{int(time.time()*1000+555)%1000000000000:012d}"
    
    # 3. Create Patient
    create_res = client.post("/api/v1/patients/", headers=admin_headers, json={
        "nik": unique_nik,
        "name": "Pasien Uji CRUD",
        "patient_type": "CHILD",
        "birth_date": "2025-06-01",
        "gender": "L",
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Posyandu Mawar"
    })
    assert create_res.status_code == 200
    p_id = create_res.json()["id"]

    # 4. Admin Update Patient
    update_res = client.put(f"/api/v1/patients/{p_id}", headers=admin_headers, json={
        "name": "Pasien Uji CRUD Terupdate",
        "posyandu_name": "Posyandu Melati"
    })
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Pasien Uji CRUD Terupdate"

    # 5. Kader Visit & Test 1x Revision Limit
    visit_res = client.post("/api/v1/visits/", headers=kader_headers, json={
        "patient_id": p_id,
        "visit_date": "2026-08-28",
        "phase": "BADUTA",
        "age_in_months": 14,
        "child_weight_kg": 7.0,
        "child_length_cm": 68.0,
        "weight_trend_kms": "TIDAK_NAIK",
        "feeding_status": "TIDAK_ADEKUAT"
    })
    assert visit_res.status_code == 200
    rep_id = visit_res.json()["id"]

    # Reject 1 (Harus Sukses)
    rej1_res = client.post(f"/api/v1/reports/{rep_id}/validate", headers=kader_headers, json={
        "status": "REJECTED",
        "rejection_reason": "Pasien alergi telur, ganti menu protein hewani."
    })
    assert rej1_res.status_code == 200
    assert rej1_res.json()["revision_count"] == 1

    # Reject 2 (Harus Gagal - 400 Bad Request karena batas 1x revisi)
    rej2_res = client.post(f"/api/v1/reports/{rep_id}/validate", headers=kader_headers, json={
        "status": "REJECTED",
        "rejection_reason": "Penolakan kedua kalinya."
    })
    assert rej2_res.status_code == 400
    assert "1 kali revisi" in rej2_res.json()["detail"]

    # 6. Admin Delete Patient
    del_res = client.delete(f"/api/v1/patients/{p_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_admin_dashboard_stats():
    """Menguji dashboard agregat admin."""
    login_res = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/admin/dashboard-summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_patients"] >= 1
    assert len(data["village_breakdown"]) == 9


def test_admin_toggle_kader_status_and_deactivated_login():
    """Menguji fitur toggle nonaktifkan akun kader dan penolakan login saat nonaktif (Bab 4 Tabel 20)."""
    # 1. Login Admin
    admin_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Buat kader baru untuk pengujian
    test_username = f"kader_test_{int(time.time())}"
    create_res = client.post("/api/v1/admin/kaders", headers=admin_headers, json={
        "username": test_username,
        "email": f"{test_username}@test.com",
        "password": "password123",
        "full_name": "Kader Uji Status",
        "posyandu_name": "Posyandu Cempaka",
        "village_name": "Sukur"
    })
    assert create_res.status_code == 200
    kader_data = create_res.json()
    kader_id = kader_data["id"]
    assert kader_data["is_active"] is True

    # 3. Nonaktifkan kader via toggle endpoint
    toggle_off_res = client.put(f"/api/v1/admin/kaders/{kader_id}/toggle-status", headers=admin_headers)
    assert toggle_off_res.status_code == 200
    assert toggle_off_res.json()["is_active"] is False

    # 4. Coba login sebagai kader yang dinonaktifkan -> Harus ditolak 403 Forbidden
    inactive_login = client.post("/api/v1/auth/login", json={
        "username": test_username,
        "password": "password123"
    })
    assert inactive_login.status_code == 403
    assert "telah dinonaktifkan" in inactive_login.json()["detail"]

    # 5. Aktifkan kembali via toggle endpoint
    toggle_on_res = client.put(f"/api/v1/admin/kaders/{kader_id}/toggle-status", headers=admin_headers)
    assert toggle_on_res.status_code == 200
    assert toggle_on_res.json()["is_active"] is True

    # 6. Login kembali setelah aktif -> Harus berhasil 200 OK
    active_login = client.post("/api/v1/auth/login", json={
        "username": test_username,
        "password": "password123"
    })
    assert active_login.status_code == 200

    # 7. Uji bulk status update
    bulk_res = client.post("/api/v1/admin/kaders/bulk-status", headers=admin_headers, json={
        "ids": [kader_id],
        "is_active": False
    })
    assert bulk_res.status_code == 200
    assert bulk_res.json()["updated_count"] == 1

    # 8. Bersihkan data uji
    del_res = client.delete(f"/api/v1/admin/kaders/{kader_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_posyandu_schedules_crud_and_conflict_validation():
    """Menguji Manajemen Jadwal Posyandu (Bab 4 Tabel 23, Gambar 36, dan Gambar 53) serta 14 titik Posyandu."""
    # 1. Endpoint publik harus mengembalikan minimal 14 jadwal ter-seed di 9 kelurahan/desa
    pub_res = client.get("/api/v1/schedules/public")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["total_villages"] == 9
    assert pub_data["total_posyandu"] == 14
    assert len(pub_data["schedules"]) >= 14

    # 2. Login sebagai Admin
    admin_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Buat jadwal baru pada tanggal yang belum bentrok
    create_res = client.post("/api/v1/schedules/", headers=admin_headers, json={
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Kel. Airmadidi Atas (SBY)",
        "schedule_date": "2026-12-01",
        "start_time": "08:00",
        "end_time": "11:30",
        "routine_pattern": "Selasa Minggu ke-1",
        "service_agenda": "Penimbangan Balita, Pemeriksaan ANC & Konseling 1.000 HPK",
        "kader_name_fallback": "Kader Posyandu SBY",
        "status": "TERJADWAL",
        "notes": "Wajib Membawa FC Kartu Keluarga & Buku KIA"
    })
    assert create_res.status_code == 200
    created_schedule = create_res.json()
    schedule_id = created_schedule["id"]

    # 4. Uji Skenario Alternatif 4a (Tabel 23): Jadwal bentrok di tanggal, jam, dan lokasi Posyandu yang sama -> 400 Bad Request
    conflict_res = client.post("/api/v1/schedules/", headers=admin_headers, json={
        "village_name": "Airmadidi Atas",
        "posyandu_name": "Kel. Airmadidi Atas (SBY)",
        "schedule_date": "2026-12-01",
        "start_time": "09:00",
        "end_time": "12:00",
        "routine_pattern": "Selasa Minggu ke-1",
        "service_agenda": "Jadwal Duplikat Bentrok",
        "status": "TERJADWAL"
    })
    assert conflict_res.status_code == 400
    assert "bentrok" in conflict_res.json()["detail"].lower()

    # 5. Update jadwal (mis. ubah jam dan agenda) dan pastikan tersinkronisasi ke endpoint publik
    update_res = client.put(f"/api/v1/schedules/{schedule_id}", headers=admin_headers, json={
        "start_time": "08:30",
        "service_agenda": "Penimbangan Balita & Imunisasi Terpadu"
    })
    assert update_res.status_code == 200
    assert update_res.json()["start_time"] == "08:30"
    assert update_res.json()["service_agenda"] == "Penimbangan Balita & Imunisasi Terpadu"

    # 6. Hapus jadwal uji
    del_res = client.delete(f"/api/v1/schedules/{schedule_id}", headers=admin_headers)
    assert del_res.status_code == 200


