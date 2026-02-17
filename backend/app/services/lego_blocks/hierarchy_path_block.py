from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
from uuid import uuid4


def _now_iso_block() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_relative_path_block(value: str) -> str:
    normalized = value.strip().replace("\\", "/")
    if not normalized:
        raise ValueError("Path cannot be empty")
    posix = PurePosixPath(normalized)
    if posix.is_absolute() or ".." in posix.parts:
        raise ValueError("Path must be vault-relative")
    return posix.as_posix()


def resolve_vault_relative_path_block(vault_root: Path, relative_path: str) -> Path:
    clean_rel = normalize_relative_path_block(relative_path)
    root = vault_root.resolve()
    resolved = (root / clean_rel).resolve()
    resolved.relative_to(root)
    return resolved


def ensure_node_markdown_file_block(
    vault_root: Path,
    *,
    relative_path: str,
    node_type: str,
    title: str,
) -> None:
    target = resolve_vault_relative_path_block(vault_root, relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    content = f"# {title.strip()}\n\n<!-- type: {node_type} -->\n"
    target.write_text(content, encoding="utf-8")


def copy_and_archive_path_transition_block(
    vault_root: Path,
    *,
    from_relative_path: str,
    to_relative_path: str,
) -> bool:
    from_abs = resolve_vault_relative_path_block(vault_root, from_relative_path)
    to_abs = resolve_vault_relative_path_block(vault_root, to_relative_path)
    if from_abs == to_abs:
        return False
    if not from_abs.exists():
        return False
    if to_abs.exists():
        raise FileExistsError(f"Cannot copy to existing path: {to_relative_path}")

    to_abs.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(from_abs, to_abs)

    now = datetime.now(timezone.utc)
    archive_rel = (
        Path(".ltm-pilot")
        / "archive"
        / now.strftime("%Y-%m-%d")
        / now.strftime("%H%M%S-%f")
        / normalize_relative_path_block(from_relative_path)
    )
    archive_abs = resolve_vault_relative_path_block(vault_root, str(archive_rel))
    archive_abs.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(from_abs), str(archive_abs))
    return True


def upsert_path_alias_block(
    conn: sqlite3.Connection,
    *,
    alias_path: str,
    target_type: str,
    target_id: str,
) -> None:
    clean_alias = normalize_relative_path_block(alias_path)
    conn.execute(
        """
INSERT INTO path_aliases (id, alias_path, target_type, target_id, is_active, created_at)
VALUES (?, ?, ?, ?, 1, ?)
ON CONFLICT(alias_path) DO UPDATE SET
  target_type = excluded.target_type,
  target_id = excluded.target_id,
  is_active = 1
""".strip(),
        (str(uuid4()), clean_alias, target_type, target_id, _now_iso_block()),
    )


@dataclass(frozen=True)
class PathResolutionBlock:
    requested_path: str
    resolved_path: str
    target_type: str
    target_id: str
    via_alias: bool

    def to_dict(self) -> dict:
        return {
            "requested_path": self.requested_path,
            "resolved_path": self.resolved_path,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "via_alias": self.via_alias,
        }


def resolve_path_block(conn: sqlite3.Connection, requested_path: str) -> PathResolutionBlock | None:
    clean_path = normalize_relative_path_block(requested_path)

    node = conn.execute(
        "SELECT id, file_path FROM nodes WHERE file_path = ? LIMIT 1",
        (clean_path,),
    ).fetchone()
    if node is not None:
        return PathResolutionBlock(
            requested_path=clean_path,
            resolved_path=str(node["file_path"]),
            target_type="node",
            target_id=str(node["id"]),
            via_alias=False,
        )

    thought = conn.execute(
        "SELECT id, file_path FROM thoughts WHERE file_path = ? LIMIT 1",
        (clean_path,),
    ).fetchone()
    if thought is not None:
        return PathResolutionBlock(
            requested_path=clean_path,
            resolved_path=str(thought["file_path"]),
            target_type="thought",
            target_id=str(thought["id"]),
            via_alias=False,
        )

    alias = conn.execute(
        """
SELECT alias_path, target_type, target_id
FROM path_aliases
WHERE alias_path = ? AND is_active = 1
LIMIT 1
""".strip(),
        (clean_path,),
    ).fetchone()
    if alias is None:
        return None

    target_type = str(alias["target_type"])
    target_id = str(alias["target_id"])
    if target_type == "node":
        target = conn.execute("SELECT file_path FROM nodes WHERE id = ? LIMIT 1", (target_id,)).fetchone()
    else:
        target = conn.execute("SELECT file_path FROM thoughts WHERE id = ? LIMIT 1", (target_id,)).fetchone()
    if target is None:
        return None

    return PathResolutionBlock(
        requested_path=clean_path,
        resolved_path=str(target["file_path"]),
        target_type=target_type,
        target_id=target_id,
        via_alias=True,
    )
