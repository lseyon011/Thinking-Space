from __future__ import annotations

import json
from pathlib import Path
from typing import Final

# Canonical exclusion list is shared with frontend/electron.
_SHARED_EXCLUDED_DIRS_PATH: Final[Path] = (
    Path(__file__).resolve().parents[4] / "frontend" / "electron" / "src" / "config" / "vaultExcludedDirs.json"
)


def _load_excluded_dirs() -> frozenset[str]:
    try:
        payload = json.loads(_SHARED_EXCLUDED_DIRS_PATH.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            cleaned = [str(item).strip() for item in payload if str(item).strip()]
            return frozenset(cleaned)
    except Exception:
        pass
    # Safe fallback if shared config is missing/unreadable.
    return frozenset({".obsidian", "node_modules", "__pycache__", ".venv", "think-space", ".git", ".trash"})


EXCLUDED_DIRS: Final[frozenset[str]] = _load_excluded_dirs()
