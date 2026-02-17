"""
AI credential reading — macOS Keychain / az CLI.

Same credential sources as the Electron main process,
but accessed from the Python backend for web app support.
"""

import json
import subprocess
from dataclasses import dataclass
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


# ── Constants ──

_KEYCHAIN_SERVICE = "Claude Code-credentials"
_CREDENTIALS_FILE = Path.home() / ".claude" / ".credentials.json"
_CLAUDE_TOKEN_ENDPOINT = "https://console.anthropic.com/v1/oauth/token"
_CLAUDE_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5f"
_AZURE_RESOURCE = "https://cognitiveservices.azure.com"


# ── Claude ──


def _parse_claude_payload(raw: str) -> ClaudeCredentials | None:
    try:
        data = json.loads(raw)
        oauth = data.get("claudeAiOauth", {})
        access_token = oauth.get("accessToken")
        refresh_token = oauth.get("refreshToken")
        if not access_token or not refresh_token:
            return None
        return ClaudeCredentials(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=oauth.get("expiresAt", ""),
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
    return ClaudeCredentials(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token", refresh_token),
        expires_at=data.get("expires_at", ""),
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
