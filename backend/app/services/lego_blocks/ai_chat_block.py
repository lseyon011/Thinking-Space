"""
AI chat blocks — send messages to Claude or Azure GPT.

Each block handles credential sourcing, client construction, and API call.
"""

from datetime import datetime, timezone
import time

import anthropic
import openai

from .ai_credential_block import (
    read_azure_token_block,
    read_claude_credentials_block,
    refresh_claude_token_block,
)

CLAUDE_MAX_OUTPUT_TOKENS = 64000


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


# ── Claude ──


_claude_cache = None  # (credentials, fetched_at)


def _get_claude_token() -> str:
    """Get a valid Claude access token, refreshing if needed."""
    global _claude_cache

    if _claude_cache:
        creds, _ = _claude_cache
        if creds.expires_at:
            try:
                exp = datetime.fromisoformat(creds.expires_at.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) < exp:
                    return creds.access_token
            except ValueError:
                pass
        # Try refresh
        try:
            refreshed = refresh_claude_token_block(creds.refresh_token)
            _claude_cache = (refreshed, datetime.now(timezone.utc))
            return refreshed.access_token
        except Exception:
            _claude_cache = None

    creds = read_claude_credentials_block()
    if not creds:
        raise RuntimeError("Claude credentials not available")

    _claude_cache = (creds, datetime.now(timezone.utc))
    return creds.access_token


def chat_claude_block(messages: list[dict]) -> dict:
    """Send messages to Claude and return the response."""
    token = _get_claude_token()
    model = "claude-sonnet-4-5-20250929"
    requested_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()

    client = anthropic.Anthropic(
        api_key=token,
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


# ── Azure GPT ──


def chat_azure_block(messages: list[dict]) -> dict:
    """Send messages to Azure GPT and return the response."""
    creds = read_azure_token_block()
    if not creds:
        raise RuntimeError("Azure credentials not available")

    model = "gpt-5"
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
