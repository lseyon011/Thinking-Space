from fastapi.testclient import TestClient

from app.main import app
from app.routers import capabilities as capabilities_router


def reset_rate_window():
    capabilities_router._rate_window.clear()  # type: ignore[attr-defined]


def test_capabilities_list_uses_runner(monkeypatch):
    reset_rate_window()
    async def fake_runner(command: str, payload: dict | None = None):
        assert command == "list"
        assert payload is None
        return {
            "ok": True,
            "capabilities": [
                {
                    "name": "organizer.nodes.list_roots",
                    "description": "List roots.",
                    "readOnly": True,
                }
            ],
        }

    monkeypatch.setattr(capabilities_router, "run_capability_runner_block", fake_runner)
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    client = TestClient(app)

    response = client.get("/api/capabilities")
    assert response.status_code == 200

    body = response.json()
    assert body["ok"] is True
    assert body["capabilities"][0]["name"] == "organizer.nodes.list_roots"


def test_capabilities_invoke_passes_frontend_contract(monkeypatch, tmp_path):
    reset_rate_window()
    captured: dict = {}

    async def fake_runner(command: str, payload: dict | None = None):
        captured["command"] = command
        captured["payload"] = payload
        return {
            "ok": True,
            "capability": "organizer.nodes.list_roots",
            "requestId": "cap-test-001",
            "actor": {"kind": "agent", "id": "pytest"},
            "dryRun": False,
            "data": {"nodes": []},
        }

    monkeypatch.setattr(capabilities_router, "run_capability_runner_block", fake_runner)
    monkeypatch.setattr(capabilities_router, "VAULT_ROOT", tmp_path)
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    client = TestClient(app)

    response = client.post(
        "/api/capabilities/invoke",
        json={
            "capability": "organizer.nodes.list_roots",
            "input": {"typeFilter": "program"},
            "actor": {"kind": "agent", "id": "pytest"},
            "requestId": "cap-test-001",
            "dryRun": False,
        },
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    payload = captured["payload"]
    assert captured["command"] == "invoke"
    assert payload["vaultRoot"] == str(tmp_path)
    assert payload["request"]["capability"] == "organizer.nodes.list_roots"
    assert payload["request"]["input"]["typeFilter"] == "program"
    assert payload["request"]["requestId"] == "cap-test-001"
    assert payload["request"]["dryRun"] is False


def test_capabilities_invoke_allows_vault_root_override(monkeypatch, tmp_path):
    reset_rate_window()
    captured: dict = {}

    async def fake_runner(command: str, payload: dict | None = None):
        captured["payload"] = payload
        return {"ok": True}

    monkeypatch.setattr(capabilities_router, "run_capability_runner_block", fake_runner)
    monkeypatch.setattr(capabilities_router, "VAULT_ROOT", tmp_path / "default")
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    client = TestClient(app)

    custom_root = tmp_path / "custom"
    response = client.post(
        "/api/capabilities/invoke",
        json={
            "capability": "organizer.nodes.list_all",
            "input": {},
            "vaultRoot": str(custom_root),
        },
    )

    assert response.status_code == 200
    assert captured["payload"]["vaultRoot"] == str(custom_root)


def test_capabilities_adapter_disabled_by_default(monkeypatch):
    reset_rate_window()
    monkeypatch.delenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", raising=False)
    client = TestClient(app)

    response = client.get("/api/capabilities")
    assert response.status_code == 404


def test_capabilities_auth_enforced_when_token_configured(monkeypatch):
    reset_rate_window()
    async def fake_runner(command: str, payload: dict | None = None):
        return {"ok": True}

    monkeypatch.setattr(capabilities_router, "run_capability_runner_block", fake_runner)
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    monkeypatch.setenv("LTM_CAPABILITY_BEARER_TOKEN", "secret-token")
    client = TestClient(app)

    denied = client.get("/api/capabilities")
    assert denied.status_code == 401

    allowed = client.get("/api/capabilities", headers={"Authorization": "Bearer secret-token"})
    assert allowed.status_code == 200
    assert allowed.json()["ok"] is True


def test_capabilities_payload_limit_enforced(monkeypatch):
    reset_rate_window()
    async def fake_runner(command: str, payload: dict | None = None):
        return {"ok": True}

    monkeypatch.setattr(capabilities_router, "run_capability_runner_block", fake_runner)
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    monkeypatch.setenv("LTM_CAPABILITY_MAX_PAYLOAD_BYTES", "1024")
    client = TestClient(app)

    response = client.post(
        "/api/capabilities/invoke",
        json={
            "capability": "organizer.nodes.list_all",
            "input": {"query": "x" * 4000},
        },
    )
    assert response.status_code == 413


def test_capabilities_rate_limit_enforced(monkeypatch):
    reset_rate_window()
    async def fake_runner(command: str, payload: dict | None = None):
        return {"ok": True}

    monkeypatch.setattr(capabilities_router, "run_capability_runner_block", fake_runner)
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    monkeypatch.setenv("LTM_CAPABILITY_RATE_LIMIT_PER_MINUTE", "1")
    client = TestClient(app)

    first = client.get("/api/capabilities")
    assert first.status_code == 200

    second = client.get("/api/capabilities")
    assert second.status_code == 429
