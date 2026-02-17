import os
from pathlib import Path


def get_vault_root_block() -> Path:
    env_value = os.getenv("LTM_PILOT_VAULT_ROOT")
    if env_value:
        return Path(env_value).expanduser().resolve()
    return Path(__file__).resolve().parents[5]
