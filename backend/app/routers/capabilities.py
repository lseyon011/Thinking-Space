"""
Capability API router.

This router is intentionally a thin transport proxy:
- capability execution remains in frontend TypeScript
- Python backend does not implement YAML hierarchy/domain logic
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.lego_blocks.vault_path_block import get_vault_root_block

router = APIRouter()

VAULT_ROOT = get_vault_root_block()
RATE_WINDOW_SECONDS = 60
_rate_window: dict[str, list[float]] = {}


class CapabilityActor(BaseModel):
    kind: str
    id: str | None = None


class CapabilityInvokeRequest(BaseModel):
    capability: str = Field(..., min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)
    actor: CapabilityActor | None = None
    requestId: str | None = None
    dryRun: bool = False
    vaultRoot: str | None = None


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _adapter_enabled() -> bool:
    return _env_bool("LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED", default=False)


def _auth_token() -> str:
    return os.getenv("LTM_CAPABILITY_BEARER_TOKEN", "").strip()


def _rate_limit_per_minute() -> int:
    raw = os.getenv("LTM_CAPABILITY_RATE_LIMIT_PER_MINUTE", "60").strip()
    try:
        value = int(raw)
        return max(1, value)
    except ValueError:
        return 60


def _payload_limit_bytes() -> int:
    raw = os.getenv("LTM_CAPABILITY_MAX_PAYLOAD_BYTES", "65536").strip()
    try:
        value = int(raw)
        return max(1024, value)
    except ValueError:
        return 65536


def _enforce_adapter_enabled() -> None:
    if not _adapter_enabled():
        raise HTTPException(
            status_code=404,
            detail=(
                "Capability adapter is disabled. "
                "Enable with LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED=true."
            ),
        )


def _enforce_auth(request: Request) -> None:
    token = _auth_token()
    if not token:
        return

    auth_header = request.headers.get("Authorization", "").strip()
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    presented = auth_header[7:].strip()
    if presented != token:
        raise HTTPException(status_code=401, detail="Invalid bearer token.")


def _enforce_rate_limit(request: Request) -> None:
    limit = _rate_limit_per_minute()
    client = request.client.host if request.client else "unknown"
    now = time.time()
    cutoff = now - RATE_WINDOW_SECONDS
    bucket = [ts for ts in _rate_window.get(client, []) if ts >= cutoff]
    if len(bucket) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({limit} requests/minute).",
        )
    bucket.append(now)
    _rate_window[client] = bucket


def _frontend_root_block() -> Path:
    return Path(__file__).resolve().parents[3] / "frontend"


def _vite_node_exec_block(frontend_root: Path) -> str:
    if os.name == "nt":
        return str(frontend_root / "node_modules" / ".bin" / "vite-node.cmd")
    return str(frontend_root / "node_modules" / ".bin" / "vite-node")


async def run_capability_runner_block(command: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    frontend_root = _frontend_root_block()
    runner_script = frontend_root / "scripts" / "agent" / "capabilityRunner.ts"
    vite_node_exec = Path(_vite_node_exec_block(frontend_root))

    if not vite_node_exec.exists():
        raise HTTPException(
            status_code=500,
            detail=(
                "Frontend capability runner is unavailable: missing vite-node binary. "
                "Run `npm install` in `frontend/`."
            ),
        )
    if not runner_script.exists():
        raise HTTPException(
            status_code=500,
            detail="Frontend capability runner script is missing.",
        )

    stdin_bytes = None
    if payload is not None:
        stdin_bytes = json.dumps(payload).encode("utf-8")

    process = await asyncio.create_subprocess_exec(
        str(vite_node_exec),
        str(runner_script),
        command,
        cwd=str(frontend_root),
        env={**os.environ, "LTM_CAPABILITY_RUNNER_CLI": "1"},
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate(stdin_bytes)

    if process.returncode != 0:
        err = stderr.decode("utf-8", errors="replace").strip()
        raise HTTPException(
            status_code=500,
            detail=f"Capability runner failed (command={command}): {err or 'unknown error'}",
        )

    raw = stdout.decode("utf-8", errors="replace").strip()
    if not raw:
        raise HTTPException(status_code=500, detail="Capability runner returned an empty response.")

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Capability runner returned invalid JSON: {exc}",
        ) from exc


@router.get("")
async def list_capabilities(request: Request):
    _enforce_adapter_enabled()
    _enforce_auth(request)
    _enforce_rate_limit(request)
    return await run_capability_runner_block("list")


@router.post("/invoke")
async def invoke_capability(request: Request):
    _enforce_adapter_enabled()
    _enforce_auth(request)
    _enforce_rate_limit(request)

    raw_body = await request.body()
    if len(raw_body) > _payload_limit_bytes():
        raise HTTPException(
            status_code=413,
            detail=f"Payload too large. Max bytes: {_payload_limit_bytes()}",
        )

    try:
        parsed = CapabilityInvokeRequest.model_validate_json(raw_body)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid request payload: {exc}")

    vault_root = parsed.vaultRoot or str(VAULT_ROOT)
    payload = {
        "vaultRoot": vault_root,
        "apiBaseUrl": str(request.base_url).rstrip("/"),
        "request": {
            "capability": parsed.capability,
            "input": parsed.input,
            "actor": parsed.actor.model_dump() if parsed.actor else None,
            "requestId": parsed.requestId,
            "dryRun": parsed.dryRun,
        },
    }
    return await run_capability_runner_block("invoke", payload)
