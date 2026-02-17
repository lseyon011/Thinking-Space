from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import re
import sqlite3
from uuid import uuid4

from app.services.lego_blocks.hierarchy_path_block import (
    PathResolutionBlock,
    copy_and_archive_path_transition_block,
    ensure_node_markdown_file_block,
    normalize_relative_path_block,
    resolve_path_block,
    upsert_path_alias_block,
)


NODE_TYPES_BLOCK = ("project", "epic", "idea")
HIERARCHY_CONTENT_PREFIX = ".ltm-pilot/thinking_organizer"
PARENT_TYPE_RULES_BLOCK = {
    "project": None,
    "epic": ("project", "epic", "idea"),
    "idea": ("project", "epic", "idea"),
}


class HierarchyRepoError(Exception):
    pass


class HierarchyNotFoundError(HierarchyRepoError):
    pass


class HierarchyValidationError(HierarchyRepoError):
    pass


@dataclass(frozen=True)
class HierarchyNodeBlock:
    id: str
    type: str
    node_kind: str
    title: str
    slug: str
    parent_id: str | None
    file_path: str
    sort_order: int
    created_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class HierarchyThoughtBlock:
    id: str
    title: str | None
    slug: str
    file_path: str
    status: str
    created_at: str
    updated_at: str
    link_count: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class HierarchyThoughtLinkBlock:
    id: str
    thought_id: str
    node_id: str
    link_kind: str
    created_at: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class HierarchyEdgeBlock:
    id: str
    from_node_id: str
    to_node_id: str
    edge_kind: str
    created_at: str

    def to_dict(self) -> dict:
        return asdict(self)


def _now_iso_block() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify_block(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not cleaned:
        return "item"
    return cleaned[:80].strip("-") or "item"


def _row_to_node_block(row: sqlite3.Row) -> HierarchyNodeBlock:
    fallback_kind = "Project" if str(row["type"]) == "project" else "Epic" if str(row["type"]) == "epic" else "Idea"
    return HierarchyNodeBlock(
        id=str(row["id"]),
        type=str(row["type"]),
        node_kind=str(row["node_kind"]) if "node_kind" in row.keys() and row["node_kind"] is not None else fallback_kind,
        title=str(row["title"]),
        slug=str(row["slug"]),
        parent_id=str(row["parent_id"]) if row["parent_id"] is not None else None,
        file_path=str(row["file_path"]),
        sort_order=int(row["sort_order"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


def _row_to_thought_block(row: sqlite3.Row) -> HierarchyThoughtBlock:
    return HierarchyThoughtBlock(
        id=str(row["id"]),
        title=str(row["title"]) if row["title"] is not None else None,
        slug=str(row["slug"]),
        file_path=str(row["file_path"]),
        status=str(row["status"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        link_count=int(row["link_count"]) if "link_count" in row.keys() else 0,
    )


def _row_to_thought_link_block(row: sqlite3.Row) -> HierarchyThoughtLinkBlock:
    return HierarchyThoughtLinkBlock(
        id=str(row["id"]),
        thought_id=str(row["thought_id"]),
        node_id=str(row["node_id"]),
        link_kind=str(row["link_kind"]),
        created_at=str(row["created_at"]),
    )


def _row_to_edge_block(row: sqlite3.Row) -> HierarchyEdgeBlock:
    return HierarchyEdgeBlock(
        id=str(row["id"]),
        from_node_id=str(row["from_node_id"]),
        to_node_id=str(row["to_node_id"]),
        edge_kind=str(row["edge_kind"]),
        created_at=str(row["created_at"]),
    )


def _get_node_row_required_block(conn: sqlite3.Connection, node_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
    if row is None:
        raise HierarchyNotFoundError(f"Node not found: {node_id}")
    return row


def _validate_parent_type_block(conn: sqlite3.Connection, node_type: str, parent_id: str | None) -> None:
    expected_parent_types = PARENT_TYPE_RULES_BLOCK[node_type]
    if expected_parent_types is None:
        if parent_id is not None:
            raise HierarchyValidationError("Project nodes cannot have a parent")
        return

    if parent_id is None:
        raise HierarchyValidationError(f"{node_type} nodes require a parent")

    parent = _get_node_row_required_block(conn, parent_id)
    if parent["type"] not in expected_parent_types:
        expected = ", ".join(expected_parent_types)
        raise HierarchyValidationError(
            f"Invalid parent type for {node_type}: expected one of [{expected}], got {parent['type']}"
        )


def _ensure_unique_node_slug_block(
    conn: sqlite3.Connection,
    node_type: str,
    base_slug: str,
    exclude_node_id: str | None = None,
) -> str:
    candidate = base_slug
    suffix = 2
    while True:
        if exclude_node_id:
            row = conn.execute(
                "SELECT id FROM nodes WHERE type = ? AND slug = ? AND id <> ? LIMIT 1",
                (node_type, candidate, exclude_node_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id FROM nodes WHERE type = ? AND slug = ? LIMIT 1",
                (node_type, candidate),
            ).fetchone()
        if row is None:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def _ensure_unique_thought_slug_block(
    conn: sqlite3.Connection,
    base_slug: str,
    exclude_thought_id: str | None = None,
) -> str:
    candidate = base_slug
    suffix = 2
    while True:
        if exclude_thought_id:
            row = conn.execute(
                "SELECT id FROM thoughts WHERE slug = ? AND id <> ? LIMIT 1",
                (candidate, exclude_thought_id),
            ).fetchone()
        else:
            row = conn.execute("SELECT id FROM thoughts WHERE slug = ? LIMIT 1", (candidate,)).fetchone()
        if row is None:
            return candidate
        candidate = f"{base_slug}-{suffix}"
        suffix += 1


def _compute_node_file_path_block(conn: sqlite3.Connection, node_type: str, slug: str, parent_id: str | None) -> str:
    if node_type == "project":
        return f"{HIERARCHY_CONTENT_PREFIX}/projects/{slug}/project.md"

    if not parent_id:
        raise HierarchyValidationError(f"{node_type.capitalize()} node requires a parent")
    parent = _get_node_row_required_block(conn, parent_id)
    parent_type = str(parent["type"])

    if parent_type == "project":
        project_slug = str(parent["slug"])
        if node_type == "epic":
            return f"{HIERARCHY_CONTENT_PREFIX}/projects/{project_slug}/epics/{slug}/epic.md"
        if node_type == "idea":
            return f"{HIERARCHY_CONTENT_PREFIX}/projects/{project_slug}/ideas/{slug}.md"

    parent_path = PurePosixPath(str(parent["file_path"]))
    parent_dir = parent_path.parent
    parent_slug = str(parent["slug"])

    if node_type == "epic":
        child_path = parent_dir / parent_slug / "epics" / slug / "epic.md"
        return child_path.as_posix()

    if node_type == "idea":
        if parent_type == "idea":
            child_path = parent_dir / parent_slug / f"{slug}.md"
            return child_path.as_posix()
        child_path = parent_dir / parent_slug / "ideas" / f"{slug}.md"
        return child_path.as_posix()

    raise HierarchyValidationError(f"Unsupported node type: {node_type}")


def _is_descendant_block(conn: sqlite3.Connection, ancestor_id: str, candidate_descendant_id: str) -> bool:
    row = conn.execute(
        """
WITH RECURSIVE subtree(id) AS (
  SELECT id FROM nodes WHERE id = ?
  UNION ALL
  SELECT n.id FROM nodes n
  JOIN subtree s ON n.parent_id = s.id
)
SELECT 1 FROM subtree WHERE id = ? LIMIT 1
""".strip(),
        (ancestor_id, candidate_descendant_id),
    ).fetchone()
    return row is not None


def _refresh_subtree_paths_block(conn: sqlite3.Connection, node_id: str) -> None:
    node_row = _get_node_row_required_block(conn, node_id)
    node_type = str(node_row["type"])
    slug = str(node_row["slug"])
    parent_id = str(node_row["parent_id"]) if node_row["parent_id"] is not None else None
    new_path = _compute_node_file_path_block(conn, node_type, slug, parent_id)
    if str(node_row["file_path"]) != new_path:
        conn.execute(
            "UPDATE nodes SET file_path = ?, updated_at = ? WHERE id = ?",
            (new_path, _now_iso_block(), node_id),
        )

    child_rows = conn.execute("SELECT id FROM nodes WHERE parent_id = ? ORDER BY sort_order, id", (node_id,)).fetchall()
    for child_row in child_rows:
        _refresh_subtree_paths_block(conn, str(child_row["id"]))


def _read_subtree_rows_block(conn: sqlite3.Connection, node_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        """
WITH RECURSIVE subtree(id) AS (
  SELECT id FROM nodes WHERE id = ?
  UNION ALL
  SELECT n.id FROM nodes n
  JOIN subtree s ON n.parent_id = s.id
)
SELECT n.*
FROM nodes n
JOIN subtree s ON n.id = s.id
ORDER BY n.id
""".strip(),
        (node_id,),
    ).fetchall()


def _sync_subtree_path_transitions_block(
    conn: sqlite3.Connection,
    *,
    vault_root: Path,
    before_paths: dict[str, str],
    after_paths: dict[str, str],
) -> None:
    for target_id, old_path in before_paths.items():
        new_path = after_paths.get(target_id)
        if not new_path or new_path == old_path:
            continue

        old_rel = normalize_relative_path_block(old_path)
        new_rel = normalize_relative_path_block(new_path)
        try:
            copy_and_archive_path_transition_block(
                vault_root,
                from_relative_path=old_rel,
                to_relative_path=new_rel,
            )
        except FileExistsError as err:
            raise HierarchyValidationError(str(err)) from err
        except (OSError, ValueError) as err:
            raise HierarchyRepoError(str(err)) from err

        upsert_path_alias_block(
            conn,
            alias_path=old_rel,
            target_type="node",
            target_id=target_id,
        )


def list_nodes_block(
    conn: sqlite3.Connection,
    *,
    parent_id: str | None,
    node_type: str | None,
) -> list[HierarchyNodeBlock]:
    where_clauses = []
    params: list[str] = []

    if parent_id is None:
        where_clauses.append("parent_id IS NULL")
    else:
        where_clauses.append("parent_id = ?")
        params.append(parent_id)

    if node_type:
        where_clauses.append("type = ?")
        params.append(node_type)

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
    rows = conn.execute(
        f"SELECT * FROM nodes WHERE {where_sql} ORDER BY sort_order, created_at, id",
        params,
    ).fetchall()
    return [_row_to_node_block(row) for row in rows]


def get_node_block(conn: sqlite3.Connection, node_id: str) -> HierarchyNodeBlock:
    row = _get_node_row_required_block(conn, node_id)
    return _row_to_node_block(row)


def create_node_block(
    conn: sqlite3.Connection,
    *,
    vault_root: Path,
    node_type: str,
    node_kind: str | None,
    title: str,
    parent_id: str | None,
    slug: str | None,
    sort_order: int,
) -> HierarchyNodeBlock:
    if node_type not in NODE_TYPES_BLOCK:
        raise HierarchyValidationError(f"Invalid node type: {node_type}")
    if not title.strip():
        raise HierarchyValidationError("Node title cannot be empty")
    clean_node_kind = (node_kind or "").strip() or ("Project" if node_type == "project" else "Epic" if node_type == "epic" else "Idea")

    _validate_parent_type_block(conn, node_type, parent_id)

    base_slug = _slugify_block(slug if slug else title)
    unique_slug = _ensure_unique_node_slug_block(conn, node_type, base_slug)
    file_path = _compute_node_file_path_block(conn, node_type, unique_slug, parent_id)
    now = _now_iso_block()
    node_id = str(uuid4())

    conn.execute(
        """
INSERT INTO nodes (id, type, node_kind, title, slug, parent_id, file_path, sort_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""".strip(),
        (
            node_id,
            node_type,
            clean_node_kind,
            title.strip(),
            unique_slug,
            parent_id,
            file_path,
            sort_order,
            now,
            now,
        ),
    )
    try:
        ensure_node_markdown_file_block(
            vault_root,
            relative_path=file_path,
            node_type=node_type,
            title=title.strip(),
        )
    except (OSError, ValueError) as err:
        conn.rollback()
        raise HierarchyRepoError(str(err)) from err

    conn.commit()
    return get_node_block(conn, node_id)


def update_node_block(
    conn: sqlite3.Connection,
    *,
    vault_root: Path,
    node_id: str,
    node_type: str | None,
    node_kind: str | None,
    title: str | None,
    slug: str | None,
    sort_order: int | None,
) -> HierarchyNodeBlock:
    node = _get_node_row_required_block(conn, node_id)
    current_node_type = str(node["type"])
    next_node_type = current_node_type if node_type is None else node_type.strip()
    current_slug = str(node["slug"])
    current_title = str(node["title"])
    parent_id = str(node["parent_id"]) if node["parent_id"] is not None else None
    if next_node_type not in NODE_TYPES_BLOCK:
        raise HierarchyValidationError(f"Unsupported node type: {next_node_type}")
    _validate_parent_type_block(conn, next_node_type, parent_id)

    next_title = title.strip() if title is not None else current_title
    if not next_title:
        raise HierarchyValidationError("Node title cannot be empty")
    current_node_kind = str(node["node_kind"]) if "node_kind" in node.keys() and node["node_kind"] is not None else (
        "Project" if current_node_type == "project" else "Epic" if current_node_type == "epic" else "Idea"
    )
    default_kind = "Project" if next_node_type == "project" else "Epic" if next_node_type == "epic" else "Idea"
    next_node_kind = current_node_kind if node_kind is None else (node_kind.strip() or default_kind)

    next_slug = current_slug
    if slug is not None or next_node_type != current_node_type:
        slug_source = slug if slug is not None else current_slug
        next_slug = _ensure_unique_node_slug_block(
            conn,
            next_node_type,
            _slugify_block(slug_source),
            exclude_node_id=node_id,
        )

    next_sort_order = int(node["sort_order"]) if sort_order is None else sort_order
    now = _now_iso_block()

    before_paths = {
        str(row["id"]): str(row["file_path"])
        for row in _read_subtree_rows_block(conn, node_id)
    }

    conn.execute(
        """
UPDATE nodes
SET type = ?, node_kind = ?, title = ?, slug = ?, sort_order = ?, updated_at = ?
WHERE id = ?
""".strip(),
        (next_node_type, next_node_kind, next_title, next_slug, next_sort_order, now, node_id),
    )

    if next_slug != current_slug or next_node_type != current_node_type:
        # Slug changes require path refresh for this node + descendants.
        _refresh_subtree_paths_block(conn, node_id)
    else:
        new_path = _compute_node_file_path_block(conn, next_node_type, next_slug, parent_id)
        if str(node["file_path"]) != new_path:
            conn.execute(
                "UPDATE nodes SET file_path = ?, updated_at = ? WHERE id = ?",
                (new_path, _now_iso_block(), node_id),
            )

    after_paths = {
        str(row["id"]): str(row["file_path"])
        for row in _read_subtree_rows_block(conn, node_id)
    }
    _sync_subtree_path_transitions_block(
        conn,
        vault_root=vault_root,
        before_paths=before_paths,
        after_paths=after_paths,
    )

    updated_node = get_node_block(conn, node_id)
    try:
        ensure_node_markdown_file_block(
            vault_root,
            relative_path=updated_node.file_path,
            node_type=updated_node.type,
            title=updated_node.title,
        )
    except (OSError, ValueError) as err:
        conn.rollback()
        raise HierarchyRepoError(str(err)) from err

    conn.commit()
    return updated_node


def move_node_block(
    conn: sqlite3.Connection,
    *,
    vault_root: Path,
    node_id: str,
    new_parent_id: str | None,
    sort_order: int | None,
) -> HierarchyNodeBlock:
    node = _get_node_row_required_block(conn, node_id)
    node_type = str(node["type"])
    current_parent_id = str(node["parent_id"]) if node["parent_id"] is not None else None
    if new_parent_id == node_id:
        raise HierarchyValidationError("Node cannot be moved under itself")
    if new_parent_id and _is_descendant_block(conn, node_id, new_parent_id):
        raise HierarchyValidationError("Node cannot be moved under its own descendant")

    _validate_parent_type_block(conn, node_type, new_parent_id)

    if current_parent_id == new_parent_id and sort_order is None:
        return get_node_block(conn, node_id)

    before_paths = {
        str(row["id"]): str(row["file_path"])
        for row in _read_subtree_rows_block(conn, node_id)
    }

    next_sort_order = int(node["sort_order"]) if sort_order is None else sort_order
    conn.execute(
        "UPDATE nodes SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?",
        (new_parent_id, next_sort_order, _now_iso_block(), node_id),
    )
    _refresh_subtree_paths_block(conn, node_id)

    after_paths = {
        str(row["id"]): str(row["file_path"])
        for row in _read_subtree_rows_block(conn, node_id)
    }
    _sync_subtree_path_transitions_block(
        conn,
        vault_root=vault_root,
        before_paths=before_paths,
        after_paths=after_paths,
    )

    moved_node = get_node_block(conn, node_id)
    try:
        ensure_node_markdown_file_block(
            vault_root,
            relative_path=moved_node.file_path,
            node_type=moved_node.type,
            title=moved_node.title,
        )
    except (OSError, ValueError) as err:
        conn.rollback()
        raise HierarchyRepoError(str(err)) from err

    conn.commit()
    return moved_node


def delete_node_block(conn: sqlite3.Connection, node_id: str) -> None:
    _get_node_row_required_block(conn, node_id)
    child_row = conn.execute(
        "SELECT id FROM nodes WHERE parent_id = ? LIMIT 1",
        (node_id,),
    ).fetchone()
    if child_row is not None:
        raise HierarchyValidationError("Cannot delete node with children")

    conn.execute("DELETE FROM nodes WHERE id = ?", (node_id,))
    conn.commit()


def upsert_thought_block(conn: sqlite3.Connection, *, file_path: str, title: str | None) -> HierarchyThoughtBlock:
    try:
        clean_path = normalize_relative_path_block(file_path)
    except ValueError as err:
        raise HierarchyValidationError(str(err)) from err

    now = _now_iso_block()
    existing = conn.execute("SELECT * FROM thoughts WHERE file_path = ? LIMIT 1", (clean_path,)).fetchone()
    if existing is not None:
        next_title = title.strip() if title is not None else existing["title"]
        conn.execute(
            "UPDATE thoughts SET title = ?, updated_at = ? WHERE id = ?",
            (next_title, now, existing["id"]),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM thoughts WHERE id = ?", (existing["id"],)).fetchone()
        return _row_to_thought_block(updated)

    stem = Path(clean_path).name
    stem = re.sub(r"\.(md|markdown|txt)$", "", stem, flags=re.IGNORECASE)
    base_slug = _slugify_block(stem)
    unique_slug = _ensure_unique_thought_slug_block(conn, base_slug)
    thought_id = str(uuid4())
    thought_title = title.strip() if title is not None and title.strip() else None

    conn.execute(
        """
INSERT INTO thoughts (id, title, slug, file_path, status, created_at, updated_at)
VALUES (?, ?, ?, ?, 'active', ?, ?)
""".strip(),
        (thought_id, thought_title, unique_slug, clean_path, now, now),
    )
    conn.commit()
    created = conn.execute("SELECT * FROM thoughts WHERE id = ?", (thought_id,)).fetchone()
    return _row_to_thought_block(created)


def list_thoughts_block(conn: sqlite3.Connection, *, unlinked_only: bool, limit: int) -> list[HierarchyThoughtBlock]:
    safe_limit = max(1, min(limit, 1000))
    if unlinked_only:
        rows = conn.execute(
            """
SELECT t.*, 0 AS link_count
FROM thoughts t
LEFT JOIN thought_node_links l ON l.thought_id = t.id
WHERE t.status = 'active' AND l.id IS NULL
ORDER BY t.updated_at DESC
LIMIT ?
""".strip(),
            (safe_limit,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
SELECT t.*, COUNT(l.id) AS link_count
FROM thoughts t
LEFT JOIN thought_node_links l ON l.thought_id = t.id
WHERE t.status = 'active'
GROUP BY t.id
ORDER BY t.updated_at DESC
LIMIT ?
""".strip(),
            (safe_limit,),
        ).fetchall()
    return [_row_to_thought_block(row) for row in rows]


def create_thought_link_block(
    conn: sqlite3.Connection,
    *,
    thought_id: str,
    node_id: str,
    link_kind: str,
) -> HierarchyThoughtLinkBlock:
    thought = conn.execute("SELECT id FROM thoughts WHERE id = ? LIMIT 1", (thought_id,)).fetchone()
    if thought is None:
        raise HierarchyNotFoundError(f"Thought not found: {thought_id}")
    _get_node_row_required_block(conn, node_id)

    clean_kind = link_kind.strip() if link_kind.strip() else "context"
    existing = conn.execute(
        """
SELECT * FROM thought_node_links
WHERE thought_id = ? AND node_id = ? AND link_kind = ?
LIMIT 1
""".strip(),
        (thought_id, node_id, clean_kind),
    ).fetchone()
    if existing is not None:
        return _row_to_thought_link_block(existing)

    link_id = str(uuid4())
    conn.execute(
        """
INSERT INTO thought_node_links (id, thought_id, node_id, link_kind, created_at)
VALUES (?, ?, ?, ?, ?)
""".strip(),
        (link_id, thought_id, node_id, clean_kind, _now_iso_block()),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM thought_node_links WHERE id = ? LIMIT 1", (link_id,)).fetchone()
    return _row_to_thought_link_block(row)


def list_thought_links_block(
    conn: sqlite3.Connection,
    *,
    thought_id: str | None,
    node_id: str | None,
) -> list[HierarchyThoughtLinkBlock]:
    where = []
    params: list[str] = []
    if thought_id:
        where.append("thought_id = ?")
        params.append(thought_id)
    if node_id:
        where.append("node_id = ?")
        params.append(node_id)

    where_sql = " AND ".join(where) if where else "1=1"
    rows = conn.execute(
        f"SELECT * FROM thought_node_links WHERE {where_sql} ORDER BY created_at DESC, id DESC",
        params,
    ).fetchall()
    return [_row_to_thought_link_block(row) for row in rows]


def delete_thought_link_block(conn: sqlite3.Connection, link_id: str) -> bool:
    cur = conn.execute("DELETE FROM thought_node_links WHERE id = ?", (link_id,))
    conn.commit()
    return cur.rowcount > 0


def create_edge_block(
    conn: sqlite3.Connection,
    *,
    from_node_id: str,
    to_node_id: str,
    edge_kind: str,
) -> HierarchyEdgeBlock:
    if from_node_id == to_node_id:
        raise HierarchyValidationError("Cannot link a node to itself")
    _get_node_row_required_block(conn, from_node_id)
    _get_node_row_required_block(conn, to_node_id)

    clean_kind = edge_kind.strip() if edge_kind.strip() else "related"
    existing = conn.execute(
        """
SELECT * FROM edges
WHERE from_node_id = ? AND to_node_id = ? AND edge_kind = ?
LIMIT 1
""".strip(),
        (from_node_id, to_node_id, clean_kind),
    ).fetchone()
    if existing is not None:
        return _row_to_edge_block(existing)

    edge_id = str(uuid4())
    conn.execute(
        """
INSERT INTO edges (id, from_node_id, to_node_id, edge_kind, created_at)
VALUES (?, ?, ?, ?, ?)
""".strip(),
        (edge_id, from_node_id, to_node_id, clean_kind, _now_iso_block()),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM edges WHERE id = ? LIMIT 1", (edge_id,)).fetchone()
    return _row_to_edge_block(row)


def list_edges_block(
    conn: sqlite3.Connection,
    *,
    from_node_id: str | None,
    to_node_id: str | None,
) -> list[HierarchyEdgeBlock]:
    where = []
    params: list[str] = []
    if from_node_id:
        where.append("from_node_id = ?")
        params.append(from_node_id)
    if to_node_id:
        where.append("to_node_id = ?")
        params.append(to_node_id)
    where_sql = " AND ".join(where) if where else "1=1"
    rows = conn.execute(
        f"SELECT * FROM edges WHERE {where_sql} ORDER BY created_at DESC, id DESC",
        params,
    ).fetchall()
    return [_row_to_edge_block(row) for row in rows]


def delete_edge_block(conn: sqlite3.Connection, edge_id: str) -> bool:
    cur = conn.execute("DELETE FROM edges WHERE id = ?", (edge_id,))
    conn.commit()
    return cur.rowcount > 0


def resolve_hierarchy_path_block(conn: sqlite3.Connection, requested_path: str) -> PathResolutionBlock | None:
    try:
        return resolve_path_block(conn, requested_path)
    except ValueError as err:
        raise HierarchyValidationError(str(err)) from err
