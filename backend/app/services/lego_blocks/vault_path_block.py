import os
from pathlib import Path


def get_vault_root_block() -> Path:
    env_value = os.getenv("THINK_SPACE_VAULT_ROOT") or os.getenv("LTM_VAULT_ROOT")
    if env_value:
        return Path(env_value).expanduser().resolve()
    return Path(__file__).resolve().parents[5]
