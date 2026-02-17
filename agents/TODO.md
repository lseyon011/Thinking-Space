# TODO Board

Last updated: 2026-02-17

## Architecture Note
As of 2026-02-14, architecture pivoted from SQLite to YAML frontmatter + IndexedDB.
See `docs/ADR-004-YAML-Architecture.md` for full details.
Tasks LTM-003/004/005 are now obsolete (completed under old architecture, will be removed in Phase 6).
Tasks LTM-017/020 are obsolete (SQLite-specific debt no longer applies).

## Priority Queue

| ID | Title | Status | Owner | Depends On | Acceptance Criteria |
|---|---|---|---|---|---|
| LTM-001 | Thought Edit UX + Save Flow | DONE | codex-gpt5 | none | User can edit thought from view and save replacement safely |
| LTM-002 | Conflict Safety + Revisions | DONE | codex-gpt5 | LTM-001 | Save detects stale content and preserves recoverable snapshot |
| LTM-013 | Unified Markdown Viewer + Editor | DONE | codex-gpt5 | LTM-001,LTM-002 | One shared responsive markdown component handles view+edit across surfaces |
| LTM-014 | Frontend Architecture Conformance Refactor | DONE | codex-gpt5 | LTM-013 | Calendar/timeline and metric UI duplication replaced by shared lego-block primitives with thin orchestrators |
| LTM-003 | SQLite Schema Bootstrap | DONE (OBSOLETE) | codex-gpt5 | none | ~~DB initializes with migrations~~ Superseded by YAML architecture |
| LTM-004 | Hierarchy CRUD API + Services | DONE (OBSOLETE) | codex-gpt5 | LTM-003 | ~~Web API + Electron IPC~~ Superseded by YAML architecture |
| LTM-005 | Mirrored Folder Path Manager | DONE (OBSOLETE) | codex-gpt5 | LTM-004 | ~~Canonical paths with mirrored folders~~ Superseded by YAML architecture |
| LTM-015 | Test Safety Net for Data-Writing Paths | DONE | codex-gpt5 | none | Automated tests for VaultFS, markdown conflict, hierarchy, revisions |
| LTM-018 | Consolidate EXCLUDED_DIRS | DONE | codex-gpt5 | none | Single source of truth for excluded dirs |
| LTM-019 | Centralized App State + localStorage Key Registry | DONE | codex-gpt5 | none | Typed localStorage key registry, no scattered string-key access |
| LTM-021 | Install YAML Architecture Dependencies | DONE | claude-opus | none | `js-yaml`, `dexie`, `uuid`, `fake-indexeddb` installed; types available |
| LTM-022 | YAML Note Block (yamlNoteBlock.ts) | DONE | claude-opus | LTM-021 | `yamlNoteBlock.ts` with parse, stringify, validate, generateKey, createNote, suggestFilename; 30 unit tests + 5 integration tests pass |
| LTM-023 | Update NewThoughtOrch for YAML Frontmatter | DONE | codex-gpt5 | LTM-022 | New thoughts created with YAML frontmatter; backward compatible with existing plain thoughts |
| LTM-024 | IndexedDB Cache Block (dbBlock.ts) | DONE | claude-opus | LTM-021 | `dbBlock.ts` with Dexie.js schema, upsertNode, getChildren, getNodeByKey/Uuid/Path, getRootNodes, getAllNodes, searchNodes, deleteNode, clearAll |
| LTM-025 | Vault Sync Orchestrator (vaultSyncOrch.ts) | DONE | claude-opus | LTM-022,LTM-024 | `vaultSyncOrch.ts` with fullSync, incrementalSync, syncSingleFile, smartSync; 8 tests pass including delete detection |
| LTM-026 | Tree View Block (TreeViewBlock.tsx) | READY | unassigned | LTM-024 | Recursive tree rendering, collapsible nodes, drag-and-drop reparenting, breadcrumb navigation |
| LTM-027 | Hierarchy Tree UI in ThinkingOrganizer | DONE | codex-gpt5 | LTM-025,LTM-026 | ThinkingOrganizer shows tree view from IndexedDB; reparent updates YAML files + IndexedDB |
| LTM-028 | Thought Editor Orchestrator | READY | unassigned | LTM-022,LTM-027 | Click thought in tree opens editor; edit title/body/frontmatter; save with conflict detection |
| LTM-029 | AI Action Block (aiBlock.ts) | READY | unassigned | LTM-025 | `aiBlock.ts` with findRelated (lexical), summarize, cleanup functions; Ollama for Electron |
| LTM-030 | Related Thoughts Sidebar | READY | unassigned | LTM-028,LTM-029 | Related thoughts sidebar shown while editing; click to navigate |
| LTM-031 | Migration Script (Old Thoughts -> YAML) | READY | unassigned | LTM-022 | One-time migration converts existing plain thoughts to YAML frontmatter format |
| LTM-032 | Remove Obsolete SQLite Code | READY | unassigned | LTM-027 | Delete backend hierarchy services, electron SQLite code, frontend SQLite adapters; clean imports |
| LTM-016 | Decompose ThinkingOrganizerOrch | READY | unassigned | LTM-027 | CreateTab, ViewTab, TraceTab extracted into separate orchestrators; no file exceeds ~400 lines |
| LTM-033 | Jira-Style Create Flow + Project Organizer Storage | DONE | codex-gpt5 | LTM-027 | Backlog supports explicit idea-bucket/idea/thought-bucket creation flow and writes nodes under `<project>/thinking-organizer/*`; linking remains a separate tab |
| LTM-006 | Local Extension Manifest + Permissions | READY | unassigned | LTM-027 | Extensions have explicit scoped permissions and lifecycle |
| LTM-007 | In-App Feature Builder Scaffolding | READY | unassigned | LTM-006 | Generate/review/enable extension from in-app flow |
| LTM-008 | Shared AI Text Action Bar | READY | unassigned | LTM-029 | Summarize/Cleanup/Related usable in all major text surfaces |
| LTM-009 | Shared AI Text Action Bar (All Surfaces) | READY | unassigned | LTM-008 | Every major textbox/editor gets the same AI action UX |
| LTM-010 | Agent Workspace Domain Model (local-first) | READY | unassigned | LTM-024 | Agent/work/run entities exist and can be linked to hierarchy nodes |
| LTM-011 | Agent Timeline + Run Tracking UI | READY | unassigned | LTM-010 | Users can view agent run history and outcomes in thinking context |
| LTM-012 | Basic Test Harness (frontend+backend critical paths) | READY | unassigned | LTM-022,LTM-024 | CI-ready smoke tests for core YAML parsing, IndexedDB operations, and agent model flows |

## Obsolete Tasks (Architecture Pivot)
| ID | Title | Status | Reason |
|---|---|---|---|
| LTM-017 | Migrate Electron SQLite from spawnSync | OBSOLETE | SQLite being removed entirely |
| LTM-020 | Hierarchy Code Unification (Python/TS) | OBSOLETE | SQLite code being deleted, not unified |

## Working Rules
- Set `Status=IN_PROGRESS` and `Owner=<agent>` before editing code.
- Move to `DONE` only after acceptance criteria are met and `agents/DONE.md` is updated.
- If blocked, set `Status=BLOCKED` and add unblock note in `agents/HANDOFFS.md`.
- Keep task sequencing aligned to phase order in `README.md`.

## Phase Mapping
- **Phase 1 (YAML Note Block)**: LTM-021, LTM-022, LTM-023
- **Phase 2 (IndexedDB Cache)**: LTM-024, LTM-025
- **Phase 3 (Hierarchy UI)**: LTM-026, LTM-027, LTM-016, LTM-033
- **Phase 4 (Edit Flow)**: LTM-028
- **Phase 5 (AI Actions)**: LTM-029, LTM-030
- **Phase 6 (Migration + Polish)**: LTM-031, LTM-032
- **EPIC-3 (Extensions)**: LTM-006, LTM-007
- **EPIC-5 (AI Everywhere)**: LTM-008, LTM-009
