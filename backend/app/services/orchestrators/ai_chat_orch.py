"""
AI chat orchestrator — routes to correct provider block and checks availability.
"""

from app.services.lego_blocks.ai_chat_block import chat_azure_block, chat_claude_block
from app.services.lego_blocks.ai_credential_block import (
    read_azure_token_block,
    read_claude_credentials_block,
)


def send_chat_orch(provider: str, messages: list[dict]) -> dict:
    """Route a chat request to the appropriate provider block."""
    if provider == "claude":
        return chat_claude_block(messages)
    elif provider == "azure-gpt":
        return chat_azure_block(messages)
    else:
        raise ValueError(f"Unknown provider: {provider}")


def list_providers_orch() -> list[dict]:
    """Check which AI providers have valid credentials available."""
    providers = []

    # Claude
    try:
        claude_available = read_claude_credentials_block() is not None
    except Exception:
        claude_available = False
    providers.append({
        "provider": "claude",
        "available": claude_available,
        "label": "Claude",
        "model": "claude-sonnet-4-5-20250929",
    })

    # Azure GPT
    try:
        azure_available = read_azure_token_block() is not None
    except Exception:
        azure_available = False
    providers.append({
        "provider": "azure-gpt",
        "available": azure_available,
        "label": "Azure GPT",
        "model": "gpt-5",
    })

    return providers


def test_provider_orch(provider: str) -> dict:
    """Test a provider connection with a minimal request."""
    try:
        result = send_chat_orch(provider, [{"role": "user", "content": "Say 'ok'."}])
        return {"provider": provider, "success": True, "response": result["content"][:100]}
    except Exception as e:
        return {"provider": provider, "success": False, "error": str(e)}
