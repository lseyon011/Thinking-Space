from fastapi.testclient import TestClient

from app.main import app


def test_hierarchy_init_bootstraps_db(tmp_path, monkeypatch):
    monkeypatch.setenv("LTM_PILOT_VAULT_ROOT", str(tmp_path))
    client = TestClient(app)

    status_before = client.get("/api/hierarchy/status")
    assert status_before.status_code == 200
    data_before = status_before.json()
    assert data_before["exists"] is False
    assert data_before["schema_version"] == 0

    init = client.post("/api/hierarchy/init")
    assert init.status_code == 200
    data_init = init.json()
    assert data_init["exists"] is True
    assert data_init["initialized"] is True
    assert data_init["schema_version"] >= 1
    assert "0001_hierarchy_core" in data_init["applied_migrations"]


def test_hierarchy_init_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setenv("LTM_PILOT_VAULT_ROOT", str(tmp_path))
    client = TestClient(app)

    first = client.post("/api/hierarchy/init")
    assert first.status_code == 200
    first_data = first.json()

    second = client.post("/api/hierarchy/init")
    assert second.status_code == 200
    second_data = second.json()

    assert second_data["schema_version"] == first_data["schema_version"]
    assert second_data["applied_migrations"] == first_data["applied_migrations"]
