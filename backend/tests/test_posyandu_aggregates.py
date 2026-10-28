import os
import sys
import pytest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.endpoints.patients import router, get_posyandu_aggregates
from app.models.user import User, UserRole
from app.models.patient import Patient, PatientType
from app.models.visit import Visit
from app.models.report import Report


def test_route_ordering():
    """Memastikan /posyandu-aggregates berada SEBELUM /{patient_id} di router FastAPI."""
    paths = [r.path for r in router.routes]
    assert "/posyandu-aggregates" in paths, "Route /posyandu-aggregates harus terdaftar"
    assert "/{patient_id}" in paths, "Route /{patient_id} harus terdaftar"

    idx_aggregates = paths.index("/posyandu-aggregates")
    idx_patient_id = paths.index("/{patient_id}")
    assert idx_aggregates < idx_patient_id, (
        f"Route /posyandu-aggregates (index {idx_aggregates}) HARUS SEBELUM "
        f"/{{patient_id}} (index {idx_patient_id}) agar tidak menghasilkan HTTP 422!"
    )


def test_posyandu_aggregates_computation():
    """Memastikan agregasi menghitung data ibu hamil dan anak baduta secara akurat."""
    fake_user = User(
        id=1,
        username="kader_test",
        role=UserRole.KADER,
        village_name="Airmadidi Atas",
        full_name="Kader Test"
    )

    class DummyMother:
        id = 1
        name = "Ny. Maria"
        patient_type = PatientType.MOTHER
        village_name = "Airmadidi Atas"
        birth_date = None

    class DummyChild:
        id = 2
        name = "Anak Budi"
        patient_type = PatientType.CHILD
        village_name = "Airmadidi Atas"
        birth_date = None

    mock_db = MagicMock()
    def query_mock(model):
        q = MagicMock()
        if model == Patient:
            q.all.return_value = [DummyMother(), DummyChild()]
        elif model == Visit:
            q.all.return_value = []
        elif model == Report:
            q.all.return_value = []
        return q

    mock_db.query.side_effect = query_mock

    result = get_posyandu_aggregates(db=mock_db, current_user=fake_user)
    assert result is not None
    summary = result["summary"]
    villages = result["villages"]

    assert summary["total_target_all"] == 2
    assert summary["total_mothers_all"] == 1
    assert summary["total_children_all"] == 1
    assert len(villages) == 9

    # Desa Airmadidi Atas harus memiliki 1 ibu dan 1 anak
    airmadidi_atas = next(v for v in villages if v["village_name"] == "Airmadidi Atas")
    assert airmadidi_atas["total_patients"] == 2
    assert airmadidi_atas["total_mothers"] == 1
    assert airmadidi_atas["total_children"] == 1

