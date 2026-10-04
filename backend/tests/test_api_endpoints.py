import pytest
import sys
import os
import time
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from app.core.database import Base, engine, SessionLocal
from app.api.v1.endpoints.auth import seed_default_users

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_default_users(db)
    db.close()


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
