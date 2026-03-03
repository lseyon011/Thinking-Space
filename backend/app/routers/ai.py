"""AI chat router — providers, chat, and connection testing."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.orchestrators.ai_chat_orch import (
    list_providers_orch,
    send_chat_orch,
    test_provider_orch,
)

router = APIRouter()

Provider = Literal["opensource-ai", "claude", "openai-codex", "codex-cli", "azure-gpt"]


class OpenSourceAiConfig(BaseModel):
    base_url: str | None = None
    api_key: str | None = None
    model: str | None = None


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    provider: Provider
    messages: list[ChatMessageIn]
    model: str | None = None
    opensource_ai: OpenSourceAiConfig | None = None


class TestProviderRequest(BaseModel):
    provider: Provider


class ProviderStatus(BaseModel):
    provider: str
    available: bool
    label: str
    model: str


class ChatResponse(BaseModel):
    role: str
    content: str
    provider: str
    model: str
    requested_at: str | None = None
    responded_at: str | None = None
    latency_ms: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    thread_id: str | None = None


class CodexCliChatRequest(BaseModel):
    messages: list[ChatMessageIn]
    thread_id: str | None = None
    model: str | None = None


@router.get("/providers", response_model=list[ProviderStatus])
async def get_providers():
    """List available AI providers with credential status."""
    return list_providers_orch()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Send messages to an AI provider and return the response."""
    try:
        result = send_chat_orch(
            req.provider,
            [m.model_dump() for m in req.messages],
            model=req.model,
            opensource_ai=req.opensource_ai.model_dump() if req.opensource_ai else None,
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/codex-cli", response_model=ChatResponse)
async def chat_codex_cli(req: CodexCliChatRequest):
    """Send messages to Codex CLI (frontend TypeScript runner)."""
    try:
        result = send_chat_orch(
            "codex-cli",
            [m.model_dump() for m in req.messages],
            req.thread_id,
            req.model,
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/providers/test")
async def test_provider(req: TestProviderRequest):
    """Test connection to a specific provider."""
    return test_provider_orch(req.provider)
