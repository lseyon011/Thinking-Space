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
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.lego_blocks.vault_path_block import get_vault_root_block

router = APIRouter()

VAULT_ROOT = get_vault_root_block()


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
async def list_capabilities():
    return await run_capability_runner_block("list")


@router.post("/invoke")
async def invoke_capability(request: CapabilityInvokeRequest):
    vault_root = request.vaultRoot or str(VAULT_ROOT)
    payload = {
        "vaultRoot": vault_root,
        "request": {
            "capability": request.capability,
            "input": request.input,
            "actor": request.actor.model_dump() if request.actor else None,
            "requestId": request.requestId,
            "dryRun": request.dryRun,
        },
    }
    return await run_capability_runner_block("invoke", payload)
