"""
AI credential reading — macOS Keychain / az CLI.

Same credential sources as the Electron main process,
but accessed from the Python backend for web app support.
"""

import json
import hashlib
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx


# ── Types ──


@dataclass
class ClaudeCredentials:
    access_token: str
    refresh_token: str
    expires_at: str


@dataclass
class AzureCredentials:
    access_token: str
    expires_on: str


@dataclass
class CodexCredentials:
    access_token: str
    refresh_token: str
    expires_at: str
    account_id: str | None = None


# ── Constants ──

_KEYCHAIN_SERVICE = "Claude Code-credentials"
_CREDENTIALS_FILE = Path.home() / ".claude" / ".credentials.json"
_CLAUDE_TOKEN_ENDPOINT = "https://platform.claude.com/v1/oauth/token"
_CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
_AZURE_RESOURCE = "https://cognitiveservices.azure.com"
_CODEX_KEYCHAIN_SERVICE = "Codex Auth"
_CODEX_TOKEN_ENDPOINT = os.getenv("CODEX_REFRESH_TOKEN_URL_OVERRIDE", "https://auth.openai.com/oauth/token")
_CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"


# ── Claude ──


def _normalize_expires_at(value) -> str:
    """Convert expiresAt to ISO string — handles ms timestamps, numeric strings, or ISO strings."""
    if not value:
        return ""
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc).isoformat()
    if isinstance(value, str) and value.isdigit():
        return datetime.fromtimestamp(int(value) / 1000, tz=timezone.utc).isoformat()
    return str(value)


def _parse_claude_payload(raw: str) -> ClaudeCredentials | None:
    try:
        data = json.loads(raw)
        oauth = data.get("claudeAiOauth", {})
        access_token = oauth.get("accessToken")
        refresh_token = oauth.get("refreshToken", "")
        if not access_token:
            return None
        return ClaudeCredentials(
            access_token=access_token,
            refresh_token=refresh_token if isinstance(refresh_token, str) else "",
            expires_at=_normalize_expires_at(oauth.get("expiresAt", "")),
        )
    except (json.JSONDecodeError, AttributeError):
        return None


def read_claude_credentials_block() -> ClaudeCredentials | None:
    """Read Claude OAuth credentials from Keychain or fallback file."""
    # macOS Keychain
    try:
        raw = subprocess.check_output(
            ["security", "find-generic-password", "-s", _KEYCHAIN_SERVICE, "-w"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL,
        ).strip()
        creds = _parse_claude_payload(raw)
        if creds:
            return creds
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # Fallback file
    try:
        raw = _CREDENTIALS_FILE.read_text()
        return _parse_claude_payload(raw)
    except (OSError, ValueError):
        return None


def refresh_claude_token_block(refresh_token: str) -> ClaudeCredentials:
    """Refresh a Claude OAuth token."""
    resp = httpx.post(
        _CLAUDE_TOKEN_ENDPOINT,
        json={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": _CLAUDE_CLIENT_ID,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    expires_at = data.get("expires_at", "")
    if not expires_at and data.get("expires_in"):
        from datetime import timedelta
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"])).isoformat()
    return ClaudeCredentials(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", refresh_token),
        expires_at=expires_at,
    )


# ── Codex ──


def _resolve_codex_home_path() -> Path:
    configured = (os.getenv("CODEX_HOME") or "").strip()
    if configured:
        return Path(configured).expanduser().resolve(strict=False)
    return (Path.home() / ".codex").resolve(strict=False)


def _compute_codex_keychain_account(codex_home: Path) -> str:
    digest = hashlib.sha256(str(codex_home).encode("utf-8")).hexdigest()
    return f"cli|{digest[:16]}"


def _parse_timestamp_ms(value) -> float:
    if isinstance(value, (int, float)):
        numeric = float(value)
        return numeric if numeric > 1_000_000_000_000 else numeric * 1000
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            numeric = float(stripped)
            return numeric if numeric > 1_000_000_000_000 else numeric * 1000
        try:
            dt = datetime.fromisoformat(stripped.replace("Z", "+00:00"))
            return dt.timestamp() * 1000
        except ValueError:
            return float("nan")
    return float("nan")


def _codex_expires_at(last_refresh, fallback_mtime_ms: float | None = None) -> str:
    last_refresh_ms = _parse_timestamp_ms(last_refresh)
    if not (last_refresh_ms == last_refresh_ms):  # NaN check
        last_refresh_ms = fallback_mtime_ms if fallback_mtime_ms is not None else (datetime.now(timezone.utc).timestamp() * 1000)
    expires_dt = datetime.fromtimestamp((last_refresh_ms + 60 * 60 * 1000) / 1000, tz=timezone.utc)
    return expires_dt.isoformat()


def _parse_codex_payload(raw: str, fallback_mtime_ms: float | None = None) -> CodexCredentials | None:
    try:
        data = json.loads(raw)
        tokens = data.get("tokens", {})
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        if not access_token or not refresh_token:
            return None
        return CodexCredentials(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=_codex_expires_at(data.get("last_refresh"), fallback_mtime_ms=fallback_mtime_ms),
            account_id=tokens.get("account_id") if isinstance(tokens.get("account_id"), str) else None,
        )
    except (json.JSONDecodeError, AttributeError):
        return None


def read_codex_credentials_block() -> CodexCredentials | None:
    """Read Codex OAuth credentials from Keychain or fallback file."""
    codex_home = _resolve_codex_home_path()
    auth_file = codex_home / "auth.json"

    # macOS Keychain
    if os.name == "posix" and os.uname().sysname == "Darwin":
        try:
            account = _compute_codex_keychain_account(codex_home)
            raw = subprocess.check_output(
                ["security", "find-generic-password", "-s", _CODEX_KEYCHAIN_SERVICE, "-a", account, "-w"],
                text=True,
                timeout=5,
                stderr=subprocess.DEVNULL,
            ).strip()
            creds = _parse_codex_payload(raw)
            if creds:
                return creds
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            pass

    # Fallback file
    try:
        stat = auth_file.stat()
        raw = auth_file.read_text()
        return _parse_codex_payload(raw, fallback_mtime_ms=stat.st_mtime * 1000)
    except (OSError, ValueError):
        return None


def refresh_codex_token_block(refresh_token: str) -> CodexCredentials:
    """Refresh an OpenAI Codex OAuth token."""
    resp = httpx.post(
        _CODEX_TOKEN_ENDPOINT,
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": _CODEX_CLIENT_ID,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("access_token"):
        raise RuntimeError("Codex token refresh response missing access_token")
    expires_at = _normalize_expires_at(data.get("expires_at", ""))
    if not expires_at:
        from datetime import timedelta
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=int(data.get("expires_in", 3600)))).isoformat()
    return CodexCredentials(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", refresh_token),
        expires_at=expires_at,
        account_id=data.get("account_id") if isinstance(data.get("account_id"), str) else None,
    )


# ── Azure ──


def read_azure_token_block() -> AzureCredentials | None:
    """Read Azure AD token via az CLI."""
    try:
        raw = subprocess.check_output(
            ["az", "account", "get-access-token", "--resource", _AZURE_RESOURCE, "--output", "json"],
            text=True,
            timeout=15,
            stderr=subprocess.DEVNULL,
        ).strip()
        data = json.loads(raw)
        access_token = data.get("accessToken")
        if not access_token:
            return None
        return AzureCredentials(
            access_token=access_token,
            expires_on=data.get("expiresOn", ""),
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError):
        return None
