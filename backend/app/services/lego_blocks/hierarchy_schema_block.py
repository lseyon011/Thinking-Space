from dataclasses import dataclass


@dataclass(frozen=True)
class SqlMigrationBlock:
    migration_id: str
    sql: str


HIERARCHY_MIGRATIONS_BLOCK = [
    SqlMigrationBlock(
        migration_id="0001_hierarchy_core",
        sql="""
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('project', 'epic', 'idea')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  parent_id TEXT REFERENCES nodes(id) ON DELETE RESTRICT,
  file_path TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(type, slug)
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent_id ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);

CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY,
  title TEXT,
  slug TEXT NOT NULL UNIQUE,
  file_path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts(status);

CREATE TABLE IF NOT EXISTS thought_node_links (
  id TEXT PRIMARY KEY,
  thought_id TEXT NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  link_kind TEXT NOT NULL DEFAULT 'context',
  created_at TEXT NOT NULL,
  UNIQUE(thought_id, node_id, link_kind)
);

CREATE INDEX IF NOT EXISTS idx_thought_node_links_thought_id ON thought_node_links(thought_id);
CREATE INDEX IF NOT EXISTS idx_thought_node_links_node_id ON thought_node_links(node_id);

CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  edge_kind TEXT NOT NULL DEFAULT 'related',
  created_at TEXT NOT NULL,
  UNIQUE(from_node_id, to_node_id, edge_kind)
);

CREATE INDEX IF NOT EXISTS idx_edges_from_node_id ON edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_to_node_id ON edges(to_node_id);

CREATE TABLE IF NOT EXISTS path_aliases (
  id TEXT PRIMARY KEY,
  alias_path TEXT NOT NULL UNIQUE,
  target_type TEXT NOT NULL CHECK (target_type IN ('node', 'thought')),
  target_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_path_aliases_target ON path_aliases(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_path_aliases_active ON path_aliases(is_active);

CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('node', 'thought')),
  target_id TEXT NOT NULL,
  revision_path TEXT NOT NULL,
  base_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revisions_target ON revisions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON revisions(created_at);
""".strip(),
    ),
    SqlMigrationBlock(
        migration_id="0002_move_content_to_thinking_organizer",
        sql="""
UPDATE nodes SET file_path = '.ltm-pilot/thinking_organizer/' || file_path
WHERE file_path NOT LIKE '.ltm-pilot/thinking_organizer/%';

UPDATE path_aliases SET alias_path = '.ltm-pilot/thinking_organizer/' || alias_path
WHERE alias_path NOT LIKE '.ltm-pilot/%';
""".strip(),
    ),
    SqlMigrationBlock(
        migration_id="0003_add_node_kind",
        sql="""
ALTER TABLE nodes ADD COLUMN node_kind TEXT NOT NULL DEFAULT '';

UPDATE nodes
SET node_kind = CASE type
  WHEN 'project' THEN 'Project'
  WHEN 'epic' THEN 'Epic'
  ELSE 'Idea'
END
WHERE node_kind = '';

CREATE INDEX IF NOT EXISTS idx_nodes_node_kind ON nodes(node_kind);
""".strip(),
    ),
]
