"""
AI chat blocks — send messages to Open Source AI, Claude, OpenAI Codex, Codex CLI, or Azure GPT.

Each block handles credential sourcing, client construction, and API call.
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
from datetime import datetime, timezone
import time

import anthropic
import httpx
import openai

from .ai_credential_block import (
    read_azure_token_block,
    read_codex_credentials_block,
    read_claude_credentials_block,
    refresh_codex_token_block,
    refresh_claude_token_block,
)

CLAUDE_MAX_OUTPUT_TOKENS = 64000
CODEX_CLI_MODEL = "gpt-5.3-codex"
CODEX_CLI_RUNNER_TIMEOUT_MS = 180000
AI_WORKSPACE_DIR_NAME = "ai-thinking-space"
OPENSOURCE_AI_DEFAULT_BASE_URL = (os.getenv("OPEN_SOURCE_AI_BASE_URL") or "http://127.0.0.1:1234/v1").strip()
OPENSOURCE_AI_DEFAULT_MODEL = (os.getenv("OPEN_SOURCE_AI_MODEL") or "local-model").strip()
OPENSOURCE_AI_PROBE_TIMEOUT_SECONDS = 1.0


# ── Types ──


class ChatMessage:
    def __init__(self, role: str, content: str):
        self.role = role
        self.content = content


class ChatResponse:
    def __init__(self, role: str, content: str, provider: str, model: str):
        self.role = role
        self.content = content
        self.provider = provider
        self.model = model


def _repo_root_block() -> Path:
    return Path(__file__).resolve().parents[4]


def _frontend_root_block() -> Path:
    return _repo_root_block() / "frontend"


def _vite_node_exec_block(frontend_root: Path) -> Path:
    if os.name == "nt":
        return frontend_root / "node_modules" / ".bin" / "vite-node.cmd"
    return frontend_root / "node_modules" / ".bin" / "vite-node"


def _codex_cli_runner_script_block(frontend_root: Path) -> Path:
    return frontend_root / "scripts" / "ai" / "codexCliChat.ts"


def _vault_root_block() -> Path:
    raw = (
        os.getenv("LTM_VAULT_ROOT")
        or os.getenv("THINK_SPACE_VAULT_ROOT")
        or os.getenv("LTM_PILOT_VAULT_ROOT")
        or ""
    ).strip()
    if raw:
        return Path(raw).expanduser().resolve(strict=False)
    return _repo_root_block()


def _ai_workspace_root_block() -> Path:
    raw = (os.getenv("LTM_AI_WORKSPACE_ROOT") or "").strip()
    if raw:
        return Path(raw).expanduser().resolve(strict=False)
    return (_vault_root_block() / AI_WORKSPACE_DIR_NAME).resolve(strict=False)


def _ensure_ai_workspace_dirs_block() -> Path:
    root = _ai_workspace_root_block()
    root.mkdir(parents=True, exist_ok=True)
    (root / "chats").mkdir(parents=True, exist_ok=True)
    (root / "memory").mkdir(parents=True, exist_ok=True)
    (root / "sessions").mkdir(parents=True, exist_ok=True)
    return root


def is_codex_cli_available_block() -> bool:
    frontend_root = _frontend_root_block()
    vite_node = _vite_node_exec_block(frontend_root)
    runner_script = _codex_cli_runner_script_block(frontend_root)
    codex_bin = shutil.which("codex")
    return bool(codex_bin and vite_node.exists() and runner_script.exists())


def _normalize_opensource_ai_base_url_block(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        raw = OPENSOURCE_AI_DEFAULT_BASE_URL
    normalized = raw.rstrip("/")
    if not normalized:
        normalized = OPENSOURCE_AI_DEFAULT_BASE_URL
    if not normalized.endswith("/v1"):
        normalized = f"{normalized}/v1"
    return normalized


# ── Claude ──


_claude_cache = None  # (credentials, fetched_at)
_codex_cache = None  # (credentials, fetched_at)


def _is_token_valid(creds) -> bool:
    """Check if credentials have a non-expired access token."""
    if not creds.expires_at:
        return False
    try:
        exp = datetime.fromisoformat(creds.expires_at.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) < exp
    except ValueError:
        return False


def _get_claude_token() -> str:
    """Get a valid Claude access token, refreshing if needed."""
    global _claude_cache

    if _claude_cache:
        creds, _ = _claude_cache
        if _is_token_valid(creds):
            return creds.access_token
        # Try refresh
        if creds.refresh_token:
            try:
                refreshed = refresh_claude_token_block(creds.refresh_token)
                _claude_cache = (refreshed, datetime.now(timezone.utc))
                return refreshed.access_token
            except Exception:
                _claude_cache = None

    creds = read_claude_credentials_block()
    if not creds:
        raise RuntimeError("Claude credentials not available")

    # Check if freshly-read token is still valid
    if _is_token_valid(creds):
        _claude_cache = (creds, datetime.now(timezone.utc))
        return creds.access_token

    # Token expired — refresh it
    if not creds.refresh_token:
        raise RuntimeError("Claude token is expired and no refresh token is available")

    try:
        refreshed = refresh_claude_token_block(creds.refresh_token)
        _claude_cache = (refreshed, datetime.now(timezone.utc))
        return refreshed.access_token
    except Exception as e:
        raise RuntimeError(f"Claude token expired and refresh failed: {e}")


def _get_codex_credentials():
    """Get valid Codex credentials, refreshing token if needed."""
    global _codex_cache

    if _codex_cache:
        creds, _ = _codex_cache
        if _is_token_valid(creds):
            return creds
        try:
            refreshed = refresh_codex_token_block(creds.refresh_token)
            _codex_cache = (refreshed, datetime.now(timezone.utc))
            return refreshed
        except Exception:
            _codex_cache = None

    creds = read_codex_credentials_block()
    if not creds:
        raise RuntimeError("Codex credentials not available")

    # Check if freshly-read token is still valid
    if _is_token_valid(creds):
        _codex_cache = (creds, datetime.now(timezone.utc))
        return creds

    # Token expired — refresh it
    try:
        refreshed = refresh_codex_token_block(creds.refresh_token)
        _codex_cache = (refreshed, datetime.now(timezone.utc))
        return refreshed
    except Exception as e:
        raise RuntimeError(f"Codex token expired and refresh failed: {e}")


def _to_codex_input_item(message: dict) -> dict:
    role = message.get("role")
    text = message.get("content", "")
    content_type = "input_text" if role == "user" else "output_text"
    normalized_role = role if role in ("user", "assistant") else "user"
    return {
        "role": normalized_role,
        "content": [{"type": content_type, "text": str(text)}],
    }


def chat_claude_block(messages: list[dict], model: str | None = None) -> dict:
    """Send messages to Claude and return the response."""
    token = _get_claude_token()
    model = model.strip() if isinstance(model, str) and model.strip() else "claude-sonnet-4-5-20250929"
    requested_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()

    client = anthropic.Anthropic(
        auth_token=token,
        default_headers={"anthropic-beta": "oauth-2025-04-20"},
    )

    with client.messages.stream(
        model=model,
        # Anthropic Messages API requires an explicit max_tokens value.
        # Use a high ceiling so responses are effectively free-flowing.
        max_tokens=CLAUDE_MAX_OUTPUT_TOKENS,
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
    ) as stream:
        text = "".join(stream.text_stream)
        response = stream.get_final_message()
    responded_at = datetime.now(timezone.utc).isoformat()
    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "input_tokens", None) if usage is not None else None
    output_tokens = getattr(usage, "output_tokens", None) if usage is not None else None
    total_tokens = None
    if isinstance(input_tokens, int) and isinstance(output_tokens, int):
        total_tokens = input_tokens + output_tokens

    return {
        "role": "assistant",
        "content": text,
        "provider": "claude",
        "model": model,
        "requested_at": requested_at,
        "responded_at": responded_at,
        "latency_ms": latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


# ── OpenAI Codex ──


def chat_codex_block(messages: list[dict], model: str | None = None) -> dict:
    """Send messages to OpenAI Codex and return the response."""
    creds = _get_codex_credentials()
    model = model.strip() if isinstance(model, str) and model.strip() else "gpt-5.3-codex"
    requested_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()

    headers = {
        "Authorization": f"Bearer {creds.access_token}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "User-Agent": "think-space",
    }
    if creds.account_id:
        headers["ChatGPT-Account-Id"] = creds.account_id

    payload = {
        "model": model,
        "instructions": "You are a helpful assistant.",
        "input": [_to_codex_input_item(m) for m in messages],
        "store": False,
        "stream": True,
    }

    text_parts: list[str] = []
    usage: dict = {}
    with httpx.stream(
        "POST",
        "https://chatgpt.com/backend-api/codex/responses",
        headers=headers,
        json=payload,
        timeout=60,
    ) as response:
        if response.status_code < 200 or response.status_code >= 300:
            detail = response.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Codex request failed (HTTP {response.status_code}): {detail[:300]}")

        for line in response.iter_lines():
            if not line or not line.startswith("data: "):
                continue
            raw = line[6:].strip()
            if not raw:
                continue
            try:
                evt = json.loads(raw)
            except json.JSONDecodeError:
                continue
            evt_type = evt.get("type")
            if evt_type == "response.output_text.delta":
                delta = evt.get("delta")
                if isinstance(delta, str):
                    text_parts.append(delta)
            elif evt_type == "response.output_text.done" and not text_parts:
                done_text = evt.get("text")
                if isinstance(done_text, str):
                    text_parts.append(done_text)
            elif evt_type == "response.completed":
                usage = evt.get("response", {}).get("usage", {}) or {}

    text = "".join(text_parts)
    responded_at = datetime.now(timezone.utc).isoformat()
    latency_ms = int((time.perf_counter() - started) * 1000)
    input_tokens = usage.get("input_tokens") if isinstance(usage, dict) else None
    output_tokens = usage.get("output_tokens") if isinstance(usage, dict) else None
    total_tokens = usage.get("total_tokens") if isinstance(usage, dict) else None

    return {
        "role": "assistant",
        "content": text,
        "provider": "openai-codex",
        "model": model,
        "requested_at": requested_at,
        "responded_at": responded_at,
        "latency_ms": latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


def chat_codex_cli_block(
    messages: list[dict],
    thread_id: str | None = None,
    model: str | None = None,
) -> dict:
    """Send messages to Codex CLI via frontend TypeScript runner."""
    frontend_root = _frontend_root_block()
    vite_node_exec = _vite_node_exec_block(frontend_root)
    runner_script = _codex_cli_runner_script_block(frontend_root)

    if not is_codex_cli_available_block():
        raise RuntimeError(
            "Codex CLI provider unavailable. Ensure `codex` is installed and "
            "`frontend/node_modules/.bin/vite-node` plus `frontend/scripts/ai/codexCliChat.ts` exist."
        )

    requested_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()
    ai_workspace_root = _ensure_ai_workspace_dirs_block()
    requested_model = model.strip() if isinstance(model, str) and model.strip() else CODEX_CLI_MODEL
    payload = {
        "messages": messages,
        "model": requested_model,
        "timeoutMs": CODEX_CLI_RUNNER_TIMEOUT_MS,
        "workingDirectory": str(_repo_root_block()),
        "storageDirectory": str(ai_workspace_root),
        "threadId": thread_id.strip() if isinstance(thread_id, str) and thread_id.strip() else None,
    }

    try:
        result = subprocess.run(
            [str(vite_node_exec), str(runner_script)],
            cwd=str(frontend_root),
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            timeout=max(1, int(CODEX_CLI_RUNNER_TIMEOUT_MS / 1000) + 30),
            env={**os.environ, "LTM_CODEX_CLI_RUNNER": "1"},
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Codex CLI runner timed out after {CODEX_CLI_RUNNER_TIMEOUT_MS}ms"
        ) from exc
    except OSError as exc:
        raise RuntimeError(f"Failed to launch Codex CLI runner: {exc}") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(
            f"Codex CLI runner failed (exit {result.returncode}): {detail[:500]}"
        )

    raw = (result.stdout or "").strip()
    if not raw:
        raise RuntimeError("Codex CLI runner returned empty output")

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Codex CLI runner returned invalid JSON: {exc}") from exc

    text = parsed.get("text", "") if isinstance(parsed, dict) else ""
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("Codex CLI runner returned no assistant text")

    responded_at = datetime.now(timezone.utc).isoformat()
    latency_ms = int((time.perf_counter() - started) * 1000)
    model = (
        parsed.get("model")
        if isinstance(parsed, dict) and isinstance(parsed.get("model"), str) and parsed.get("model")
        else requested_model
    )
    input_tokens = (
        parsed.get("input_tokens")
        if isinstance(parsed, dict) and isinstance(parsed.get("input_tokens"), int)
        else None
    )
    output_tokens = (
        parsed.get("output_tokens")
        if isinstance(parsed, dict) and isinstance(parsed.get("output_tokens"), int)
        else None
    )
    total_tokens = (
        parsed.get("total_tokens")
        if isinstance(parsed, dict) and isinstance(parsed.get("total_tokens"), int)
        else None
    )
    response_thread_id = (
        parsed.get("thread_id")
        if isinstance(parsed, dict) and isinstance(parsed.get("thread_id"), str) and parsed.get("thread_id").strip()
        else (thread_id.strip() if isinstance(thread_id, str) and thread_id.strip() else None)
    )

    return {
        "role": "assistant",
        "content": text,
        "provider": "codex-cli",
        "model": model,
        "requested_at": requested_at,
        "responded_at": responded_at,
        "latency_ms": latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "thread_id": response_thread_id,
    }


# ── Open Source AI ──


def is_opensource_ai_available_block(base_url: str | None = None, api_key: str | None = None) -> bool:
    normalized_base_url = _normalize_opensource_ai_base_url_block(base_url)
    headers = {}
    token = (api_key or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        response = httpx.get(
            f"{normalized_base_url}/models",
            headers=headers,
            timeout=OPENSOURCE_AI_PROBE_TIMEOUT_SECONDS,
        )
        return 200 <= response.status_code < 300
    except Exception:
        return False


def get_opensource_ai_model_identifier_block(base_url: str | None = None, api_key: str | None = None) -> str | None:
    """Return first model id from an OpenAI-compatible /v1/models response."""
    normalized_base_url = _normalize_opensource_ai_base_url_block(base_url)
    headers = {}
    token = (api_key or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        response = httpx.get(
            f"{normalized_base_url}/models",
            headers=headers,
            timeout=OPENSOURCE_AI_PROBE_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, list):
            return None
        for row in data:
            if isinstance(row, dict):
                model_id = row.get("id")
                if isinstance(model_id, str) and model_id.strip():
                    return model_id.strip()
        return None
    except Exception:
        return None


def chat_opensource_ai_block(messages: list[dict], model: str | None = None, config: dict | None = None) -> dict:
    """Send messages to an OpenAI-compatible local endpoint (LM Studio by default)."""
    config = config or {}
    base_url = _normalize_opensource_ai_base_url_block(config.get("base_url") if isinstance(config, dict) else None)
    api_key = (config.get("api_key") if isinstance(config, dict) else None) or os.getenv("OPEN_SOURCE_AI_API_KEY") or ""
    configured_model = ((config.get("model") or "").strip() if isinstance(config, dict) else "")
    requested_model = model.strip() if isinstance(model, str) and model.strip() else ""
    model = (
        requested_model
        if requested_model and requested_model != OPENSOURCE_AI_DEFAULT_MODEL
        else (
            configured_model
            or requested_model
            or get_opensource_ai_model_identifier_block(base_url=base_url, api_key=api_key)
            or OPENSOURCE_AI_DEFAULT_MODEL
        )
    )
    requested_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()

    client = openai.OpenAI(
        api_key=api_key or "local-not-required",
        base_url=base_url,
    )
    payload = {
        "model": model,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }
    try:
        response = client.chat.completions.create(**payload)
    except Exception as exc:
        host_hint = ""
        if "127.0.0.1" in base_url or "localhost" in base_url:
            host_hint = (
                " If backend is not running on the same host as LM Studio, use "
                "host.docker.internal or your host LAN IP in Open Source AI base URL."
            )
        raise RuntimeError(f"Open Source AI connection failed at {base_url}: {exc}.{host_hint}") from exc

    text = response.choices[0].message.content or ""
    responded_at = datetime.now(timezone.utc).isoformat()
    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "prompt_tokens", None) if usage is not None else None
    output_tokens = getattr(usage, "completion_tokens", None) if usage is not None else None
    total_tokens = getattr(usage, "total_tokens", None) if usage is not None else None

    return {
        "role": "assistant",
        "content": text,
        "provider": "opensource-ai",
        "model": getattr(response, "model", None) or model,
        "requested_at": requested_at,
        "responded_at": responded_at,
        "latency_ms": latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }


# ── Azure GPT ──


def chat_azure_block(messages: list[dict], model: str | None = None) -> dict:
    """Send messages to Azure GPT and return the response."""
    creds = read_azure_token_block()
    if not creds:
        raise RuntimeError("Azure credentials not available")

    model = model.strip() if isinstance(model, str) and model.strip() else "gpt-5"
    requested_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()

    client = openai.AzureOpenAI(
        azure_endpoint="https://fuchs-lab-openai.openai.azure.com/",
        azure_deployment=model,
        api_version="2024-12-01-preview",
        azure_ad_token=creds.access_token,
    )

    payload = {
        "model": model,
        "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
    }

    response = client.chat.completions.create(**payload)

    text = response.choices[0].message.content or ""
    responded_at = datetime.now(timezone.utc).isoformat()
    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "prompt_tokens", None) if usage is not None else None
    output_tokens = getattr(usage, "completion_tokens", None) if usage is not None else None
    total_tokens = getattr(usage, "total_tokens", None) if usage is not None else None

    return {
        "role": "assistant",
        "content": text,
        "provider": "azure-gpt",
        "model": model,
        "requested_at": requested_at,
        "responded_at": responded_at,
        "latency_ms": latency_ms,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }
