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

Provider = Literal["claude", "openai-codex", "azure-gpt"]


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    provider: Provider
    messages: list[ChatMessageIn]


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
