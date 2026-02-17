import asyncio
import json
import shutil
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.routers import capabilities as capabilities_router


def test_capability_invoke_parity_with_runner(monkeypatch):
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    monkeypatch.setenv("LTM_CAPABILITY_BEARER_TOKEN", "parity-token")
    monkeypatch.setenv("LTM_CAPABILITY_RATE_LIMIT_PER_MINUTE", "200")
    capabilities_router._rate_window.clear()  # type: ignore[attr-defined]

    fixtures = _load_fixtures()
    vault_root = _repo_root() / "test-fixtures" / "vault"
    client = TestClient(app)

    for fixture in fixtures:
        runner_tmp, runner_root = _clone_fixture_vault(vault_root)
        api_tmp, api_root = _clone_fixture_vault(vault_root)
        try:
            payload = {
                "vaultRoot": str(runner_root),
                "request": fixture["request"],
            }
            runner_response = asyncio.run(capabilities_router.run_capability_runner_block("invoke", payload))

            api_response = client.post(
                "/api/capabilities/invoke",
                headers={"Authorization": "Bearer parity-token"},
                json={**fixture["request"], "vaultRoot": str(api_root)},
            )
            assert api_response.status_code == 200, fixture["id"]

            assert _normalize(api_response.json()) == _normalize(runner_response), fixture["id"]
        finally:
            shutil.rmtree(runner_tmp, ignore_errors=True)
            shutil.rmtree(api_tmp, ignore_errors=True)


def test_capability_list_parity_with_runner(monkeypatch):
    monkeypatch.setenv("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", "true")
    monkeypatch.setenv("LTM_CAPABILITY_BEARER_TOKEN", "parity-token")
    monkeypatch.setenv("LTM_CAPABILITY_RATE_LIMIT_PER_MINUTE", "200")
    capabilities_router._rate_window.clear()  # type: ignore[attr-defined]

    client = TestClient(app)
    runner_response = asyncio.run(capabilities_router.run_capability_runner_block("list"))
    api_response = client.get(
        "/api/capabilities",
        headers={"Authorization": "Bearer parity-token"},
    )
    assert api_response.status_code == 200
    assert _normalize(api_response.json()) == _normalize(runner_response)


def _load_fixtures() -> list[dict]:
    fixture_path = _repo_root() / "tests" / "fixtures" / "capability_parity_fixtures.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


def _clone_fixture_vault(source_vault_root: Path) -> tuple[Path, Path]:
    temp_root = Path(tempfile.mkdtemp(prefix="ltm-cap-parity-"))
    cloned_vault = temp_root / "vault"
    shutil.copytree(source_vault_root, cloned_vault)
    return temp_root, cloned_vault


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _normalize(value):
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    if isinstance(value, dict):
        out = {}
        for key, inner in value.items():
            if key in {"requestId", "auditId", "id"}:
                continue
            if key in {"updatedAt", "updated_at"}:
                continue
            out[key] = _normalize(inner)
        return out
    return value
