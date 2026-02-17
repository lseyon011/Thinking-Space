from dataclasses import dataclass, asdict
from pathlib import Path
import shutil
import sqlite3

from app.services.lego_blocks.hierarchy_schema_block import HIERARCHY_MIGRATIONS_BLOCK


MIGRATIONS_TABLE_BLOCK = "schema_migrations"
LTM_DB_RELATIVE_PATH_BLOCK = Path(".ltm-pilot") / "ltm.db"


@dataclass(frozen=True)
class HierarchyDbStatusBlock:
    db_path: str
    exists: bool
    initialized: bool
    schema_version: int
    applied_migrations: list[str]
    last_migration_id: str | None

    def to_dict(self) -> dict:
        return asdict(self)


def resolve_hierarchy_db_path_block(vault_root: Path) -> Path:
    return (vault_root / LTM_DB_RELATIVE_PATH_BLOCK).resolve()


def _connect_hierarchy_db_block(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def _ensure_migrations_table_block(conn: sqlite3.Connection) -> None:
    conn.execute(
        f"""
CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE_BLOCK} (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)
""".strip()
    )


def _migration_table_exists_block(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
        (MIGRATIONS_TABLE_BLOCK,),
    ).fetchone()
    return row is not None


def _read_applied_migrations_block(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        f"SELECT migration_id FROM {MIGRATIONS_TABLE_BLOCK} ORDER BY migration_id"
    ).fetchall()
    return [str(row["migration_id"]) for row in rows]


def _apply_migrations_block(conn: sqlite3.Connection) -> list[str]:
    _ensure_migrations_table_block(conn)
    applied = set(_read_applied_migrations_block(conn))
    for migration in HIERARCHY_MIGRATIONS_BLOCK:
        if migration.migration_id in applied:
            continue
        conn.executescript(migration.sql)
        conn.execute(
            f"INSERT INTO {MIGRATIONS_TABLE_BLOCK} (migration_id) VALUES (?)",
            (migration.migration_id,),
        )
    conn.commit()
    return _read_applied_migrations_block(conn)


_CONTENT_PREFIX_BLOCK = ".ltm-pilot/thinking_organizer"


def _migrate_files_to_thinking_organizer_block(vault_root: Path, conn: sqlite3.Connection) -> None:
    rows = conn.execute("SELECT file_path FROM nodes").fetchall()
    for row in rows:
        new_rel = str(row["file_path"])
        if not new_rel.startswith(_CONTENT_PREFIX_BLOCK + "/"):
            continue
        old_rel = new_rel[len(_CONTENT_PREFIX_BLOCK) + 1:]
        old_abs = vault_root / old_rel
        new_abs = vault_root / new_rel
        if old_abs.exists() and not new_abs.exists():
            new_abs.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old_abs), str(new_abs))


def init_hierarchy_db_block(vault_root: Path) -> HierarchyDbStatusBlock:
    db_path = resolve_hierarchy_db_path_block(vault_root)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with _connect_hierarchy_db_block(db_path) as conn:
        applied_before = set(
            _read_applied_migrations_block(conn) if _migration_table_exists_block(conn) else []
        )
        applied_migrations = _apply_migrations_block(conn)

        if (
            "0002_move_content_to_thinking_organizer" not in applied_before
            and "0002_move_content_to_thinking_organizer" in applied_migrations
        ):
            _migrate_files_to_thinking_organizer_block(vault_root, conn)

    return HierarchyDbStatusBlock(
        db_path=str(db_path),
        exists=db_path.exists(),
        initialized=len(applied_migrations) > 0,
        schema_version=len(applied_migrations),
        applied_migrations=applied_migrations,
        last_migration_id=applied_migrations[-1] if applied_migrations else None,
    )


def get_hierarchy_db_status_block(vault_root: Path) -> HierarchyDbStatusBlock:
    db_path = resolve_hierarchy_db_path_block(vault_root)
    if not db_path.exists():
        return HierarchyDbStatusBlock(
            db_path=str(db_path),
            exists=False,
            initialized=False,
            schema_version=0,
            applied_migrations=[],
            last_migration_id=None,
        )

    with _connect_hierarchy_db_block(db_path) as conn:
        if not _migration_table_exists_block(conn):
            return HierarchyDbStatusBlock(
                db_path=str(db_path),
                exists=True,
                initialized=False,
                schema_version=0,
                applied_migrations=[],
                last_migration_id=None,
            )
        applied_migrations = _read_applied_migrations_block(conn)

    return HierarchyDbStatusBlock(
        db_path=str(db_path),
        exists=True,
        initialized=len(applied_migrations) > 0,
        schema_version=len(applied_migrations),
        applied_migrations=applied_migrations,
        last_migration_id=applied_migrations[-1] if applied_migrations else None,
    )


def connect_hierarchy_db_block(vault_root: Path) -> sqlite3.Connection:
    db_path = resolve_hierarchy_db_path_block(vault_root)
    if not db_path.exists():
        init_hierarchy_db_block(vault_root)
    conn = _connect_hierarchy_db_block(db_path)
    if not _migration_table_exists_block(conn):
        _apply_migrations_block(conn)
    return conn
