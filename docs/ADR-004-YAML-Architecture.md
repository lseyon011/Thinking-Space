# ADR-004: YAML Frontmatter + IndexedDB Architecture

**Status:** Accepted
**Date:** 2026-02-14
**Supersedes:** Previous SQLite + mirrored folders plan

## Context

The original architecture used SQLite for hierarchy metadata with mirrored folder structure enforcing the hierarchy on disk. This created:
- Dual implementation burden (Python backend + TypeScript Electron)
- File/DB divergence risks requiring integrity scans
- Folder structure coupling that restricted user organization freedom
- Backend dependency for core features

## Decision

Switch to **YAML frontmatter in Markdown files** as source of truth, with **IndexedDB** (via Dexie.js) as an in-browser cache layer.

### Core Principles
- **Hierarchy lives in metadata**, not folders
- **Folders are arbitrary / pragmatic** (user organizes by date, domain, inbox/archive, etc.)
- **No backend required** for core features
- **No SQLite / native DB**
- Everything in plain Markdown + YAML frontmatter
- Fully local, portable, git-friendly, inspectable

## YAML Frontmatter Schema (per .md file = one node)

```yaml
---
# IDENTITY
uuid:         "550e8400-e29b-41d4-a716-446655440000"   # v4 UUID, stable, never changes
key:          "build-thinking-space"                    # stable human-readable slug (from title)
title:        "Build Thinking Space App"

# TYPE & LEVEL
type:         "epic"             # enum: program | epic | idea_bucket | idea | thought_bucket | thought
level:        1                  # 0=program ... 5=thought (sorting & validation)

# HIERARCHY (logical tree, independent of filesystem)
parent:       "personal-growth"                          # parent's key (NOT path)
parent_uuid:  "a1b2c3d4-..."                             # optional: parent's UUID
parent_type:  "program"                                  # denormalized for speed

# DISCOVERY & STATUS
tags:         ["project/app", "ai/pkm", "2026-q1"]
categories:   ["active-projects"]                        # optional multi-category
progress:     0.42
status:       "active"           # active | paused | completed | archived
priority:     "high"

# TIMESTAMPS
created_at:   "2026-02-14T17:30:00Z"
updated_at:   "2026-02-14T18:15:00Z"

# AI LAYER
ai_summary:   "Core app to organize hierarchical thinking with ambient AI"
ai_generated: true
last_ai_update: "2026-02-14T18:15:00Z"
ai_suggestions:
  related:
    - key:      "obsidian-canvas-integration"
      reason:   "Similar visual + structured hybrid approach"
      score:    0.82
  suggested_move:
    parent:   "idea_buckets/visual-pkm-tools"

# INTEGRATIONS
excalidraw:   "canvases/thinking-space-hierarchy.excalidraw.md"   # optional link
wiki_links:
  - "[[projects/delta/thinking-organizer/programs/program-delta-initiative]]" # optional generated graph-visible links
---
```

`parent` / `parent_uuid` / `parent_type` remain the source-of-truth hierarchy fields. When Thinking Space creates or reparents nodes, it may also generate `wiki_links` as a derived field so Obsidian graph/backlinks can see structural connections without changing the metadata-driven hierarchy model.

### Agent Orchestration Extensions

For agent-native task/run management, nodes may include optional orchestration fields:

```yaml
# TASK FIELDS
task_id: "LTM-200"
task_status: "in_progress"
depends_on: ["LTM-150"]
blocked_by: []
acceptance_criteria: ["all checks passing"]
owner: "codex-gpt5"

# RUN FIELDS
run_id: "run-20260217-001"
session_id: "session-abc123"
agent_name: "codex-gpt5"
model: "gpt-5"
started_at: "2026-02-17T10:00:00Z"
ended_at: "2026-02-17T10:10:00Z"
result: "success"

# TRACEABILITY
source_repo: "Thinking-Space"
branch: "main"
commit: "2c78a0a"
artifacts: ["docs/CAPABILITY_ROLLOUT_MATRIX.md"]
related_nodes: ["build-thinking-space"]

# GOVERNANCE
schema_version: "2"
record_kind: "task"   # e.g. task | run | handoff | decision
state_history:
  - at: "2026-02-17T10:00:00Z"
    from: "ready"
    to: "in_progress"
```

## File Naming

Recommended (not enforced): `{type}-{key}.md` or `{key}.md`
Examples: `epic-build-thinking-space.md`, `thought-ollama-in-browser.md`

## In-Browser Fast Access Layer

- **IndexedDB** via Dexie.js
  - Caches parsed frontmatter + hierarchy indexes (parent-key lookups)
  - Stores: nodes table, full-text excerpts, optional embeddings for semantic "related"
  - Incremental sync: on vault open / file change, scan updated .md files only
  - Source of truth remains YAML — IndexedDB is pure cache (can be rebuilt anytime)

## Views & Interaction

- **Primary**: Tree / outline view (ThinkingOrganizer tab)
  - Derived from IndexedDB, falls back to YAML scan
  - Drag-and-drop reparenting updates `parent` fields in affected files

- **Secondary (optional)**: Excalidraw visualization
  - "Visualize Epic" generates `.excalidraw.md` in `canvases/`
  - Parse back changes to update YAML files

## AI Integration

- Reads YAML frontmatter + body text
- Writes back updated YAML (create files, update parent, add suggestions)
- Ambient actions: summarize, cleanup, suggest bucket, related thoughts, auto-reparent
- Local-first: Ollama (Electron) or WASM LLM (web/PWA)

## What Gets Removed

- All SQLite schema/migration code (backend + electron)
- Backend hierarchy DB services
- Mirrored folder structure enforcement
- `spawnSync('sqlite3')` in Electron

## What Gets Kept

- `fsBlock` (critical cross-platform filesystem abstraction)
- Lego/Orchestrator pattern
- Agents folder and multi-agent workflow
- Excalidraw++ tools
- Markdown conflict detection + revision snapshots

## What Gets Added

- `yamlNoteBlock.ts` — parse/stringify/validate YAML frontmatter notes
- `dbBlock.ts` — Dexie.js IndexedDB cache layer
- `vaultSyncOrch.ts` — vault scan to IndexedDB sync
- `TreeViewBlock.tsx` — recursive hierarchy tree UI
- `aiBlock.ts` — local AI action primitives

## Consequences

**Positive:**
- Single implementation (TypeScript only)
- No backend dependency for core features
- User-owned, git-friendly, inspectable files
- Simpler mental model (files ARE the data)

**Negative:**
- Existing SQLite hierarchy code (LTM-003 through LTM-005) becomes obsolete
- IndexedDB queries less powerful than SQL (mitigated by Dexie.js)

## Non-Negotiable Constraints

1. No backend required for core features
2. No SQLite / native DB
3. Vault layout untouched (folders are user's choice)
4. Everything in plain Markdown + YAML frontmatter
5. Fully local, portable, git-friendly, inspectable
6. Extensible via in-app feature builder (dynamic YAML fields, scripts, UI)
