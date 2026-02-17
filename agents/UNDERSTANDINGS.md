# Key Understandings

Last updated: 2026-02-17

> Transition note (2026-02-17): this file is now a read-only snapshot during migration to the vault-native agent workspace. New principles/decisions should move to `coding-projects/thinking-space/thinking-organizer/*`.

## Product Direction
- The app must be one product supporting all three identities from the ground up:
  - Thinking space for individuals (`Programs -> Epics -> Ideas -> Thoughts`)
  - Place where humans and AI work together (contextual assistance in the same workspace)
  - AI agent management space for humans (agent runs/work tracked alongside thinking)
- These three identities are architecture constraints, not optional future add-ons.

## Locked Decisions
1. Electron-first execution for near-term milestones.
2. **YAML frontmatter in Markdown files** as source of truth for hierarchy and metadata.
3. **IndexedDB (Dexie.js)** as rebuildable in-browser cache for fast hierarchy queries.
4. **No SQLite / native DB** — previous SQLite plan is superseded (ADR-004).
5. **No backend required** for core features (hierarchy, editing, AI actions).
6. **Folders are arbitrary** — hierarchy lives in YAML `parent` fields, not folder structure.
7. Related suggestions MVP via lexical search in IndexedDB first.
8. Local-only extensions first; no early remote code execution.
9. AI local-first: Ollama (Electron) or WASM LLM (web/PWA).
10. Phase order is owned by `README.md` and must be respected by task planning.
11. `CLAUDE.md` and `AGENTS.md` in `ltm-pilot` must be kept consistent as project docs evolve.
12. Code design standard is lego blocks + orchestrators, with template-led orchestrator structure.
13. Thoughts are free-capture first; mapping to hierarchy happens later through organizer/linking flows.
14. Organizer-created program trees are project-scoped by default: nodes inherit `project_root` and write under `<project>/thinking-organizer/<type-folder>`.
15. Agent-capability HTTP transport uses a **frontend TypeScript runner** as execution source; FastAPI acts only as a transport proxy and must not implement duplicate YAML hierarchy domain services.
16. Capability rollout now includes Thoughts/Todos/Tools actions (not only organizer CRUD), with UI routes invoking capability router for create/toggle/preview/save paths.
17. FastAPI capability adapter is now safe-by-default behind env controls (enable flag + optional bearer token + rate limit + payload limit).
18. Adapter parity fixtures are shared under `tests/fixtures/capability_parity_fixtures.json` and validated in both frontend and backend test suites.
19. Agent-orchestration metadata is now first-class in YAML parsing (`task_*`, `run_*`, traceability, governance), and IndexedDB stores both typed fields and a generic `metadata` blob with searchable `metadataKeys`/`metadataText` for future schema growth.
20. Node detail panel now renders arbitrary YAML fields recursively (arrays/objects/primitives), so non-curated frontmatter is visible without custom UI code.
21. Agent-operation capability surface now includes task/run/handoff/comment primitives (`task.claim`, `task.update_status`, `run.log`, `handoff.create`, `comment.add`) and continues to route writes through capability audit logging.
22. Vault-native migration bootstrap exists at `frontend/scripts/agent/bootstrapAgentWorkspace.ts` and has imported repo-local `agents/*` artifacts into `coding-projects/thinking-space/thinking-organizer/*` with source traceability metadata.
23. Cutover has started: `agents/*.md` are read-only transition snapshots for one cycle while active operations move to the vault workspace.

## Architecture Pivot (2026-02-14)
- **FROM**: SQLite + mirrored folders + backend hierarchy services
- **TO**: YAML frontmatter + IndexedDB cache + no backend for core
- **Reason**: Simpler, single-implementation (TS only), truly portable/git-friendly, no file/DB divergence risk
- **Impact**: SQLite code (LTM-003 through LTM-005) is obsolete and will be removed in Phase 6
- **Full details**: `docs/ADR-004-YAML-Architecture.md`

## Current Architecture Snapshot
- Frontend: React/TypeScript/Vite (`frontend/src`)
- Backend (web mode): FastAPI (`backend/app`) — being phased out for core features
- Desktop runtime: Electron IPC bridge (`frontend/electron/src`)
- Storage: Markdown files with YAML frontmatter (source of truth) + IndexedDB cache (to be built)

## Critical File Map

### Existing (Keep)
- App routes/shell: `frontend/src/App.tsx`
- Thinking Organizer page route: `frontend/src/pages/ThinkingOrganizer.tsx`
- Thoughts page (create/view tabs): `frontend/src/pages/NewThought.tsx`
- Shared checklist calendar primitive: `frontend/src/components/lego_blocks/SectionChecklistBlock.tsx`
- Shared file tree primitive: `frontend/src/components/lego_blocks/FileTreeBlock.tsx`
- Shared metric primitive: `frontend/src/components/lego_blocks/MetricBlock.tsx`
- Shared markdown viewer/editor orchestrator + provider: `frontend/src/components/orchestrators/MarkdownViewerOrch.tsx`
- Thinking organizer orchestrator (creator/view): `frontend/src/components/orchestrators/ThinkingOrganizerOrch.tsx`
- Thoughts calendar orchestrator: `frontend/src/components/orchestrators/ThoughtsCalendarOrch.tsx`
- Todos calendar orchestrator: `frontend/src/components/orchestrators/TodoCalendarOrch.tsx`
- File activity orchestrator: `frontend/src/components/orchestrators/FileActivityOrch.tsx`
- Today activity orchestrator: `frontend/src/components/orchestrators/TodayFileActivityOrch.tsx`
- Shared folder selector: `frontend/src/components/lego_blocks/CascadingFolderPickerBlock.tsx`
- Vault explorer block: `frontend/src/components/lego_blocks/VaultExplorerBlock.tsx`
- Month calendar block: `frontend/src/components/lego_blocks/MonthCalendarBlock.tsx`
- Section breakdown block: `frontend/src/components/lego_blocks/SectionBreakdownBlock.tsx`
- Markdown edit service: `frontend/src/services/orchestrators/markdownDocumentsOrch.ts`
- Thought workflow service: `frontend/src/services/orchestrators/thoughtsOrch.ts`
- Todo workflow service: `frontend/src/services/orchestrators/todosOrch.ts`
- File activity workflow service: `frontend/src/services/orchestrators/fileActivityOrch.ts`
- Runtime vault service: `frontend/src/services/orchestrators/runtimeOrch.ts`
- FS primitive service: `frontend/src/services/lego_blocks/fsBlock.ts`
- Storage key registry: `frontend/src/services/lego_blocks/storageKeyBlock.ts`
- Vault constants: `frontend/src/services/lego_blocks/vaultConstantsBlock.ts`
- Thought scanner (ts): `frontend/src/services/lego_blocks/thoughtsScannerBlock.ts`
- Orchestrator template: `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`
- Electron IPC FS bridge: `frontend/electron/src/index.ts`, `frontend/electron/src/preload.ts`

### New Architecture (Implemented)
- YAML note parse/stringify: `frontend/src/services/lego_blocks/yamlNoteBlock.ts` (DONE)
- IndexedDB cache layer: `frontend/src/services/lego_blocks/dbBlock.ts` (DONE)
- Vault sync orchestrator: `frontend/src/services/orchestrators/vaultSyncOrch.ts` (DONE)

### To Be Created (New Architecture)
- Tree view component: `frontend/src/components/lego_blocks/TreeViewBlock.tsx`
- AI action primitives: `frontend/src/services/lego_blocks/aiBlock.ts`
- Thought editor orchestrator: `frontend/src/components/orchestrators/ThoughtEditorOrch.tsx`

### Obsolete (To Be Removed in Phase 6)
- Backend hierarchy DB services:
  - `backend/app/services/lego_blocks/hierarchy_schema_block.py`
  - `backend/app/services/lego_blocks/hierarchy_db_block.py`
  - `backend/app/services/lego_blocks/hierarchy_repo_block.py`
  - `backend/app/services/lego_blocks/hierarchy_path_block.py`
  - `backend/app/services/orchestrators/hierarchy_db_orch.py`
  - `backend/app/services/orchestrators/hierarchy_orch.py`
  - `backend/app/routers/hierarchy.py`
- Electron SQLite hierarchy services:
  - `frontend/electron/src/lego_blocks/hierarchySchemaBlock.ts`
  - `frontend/electron/src/lego_blocks/hierarchyDbBlock.ts`
  - `frontend/electron/src/lego_blocks/hierarchyRepoBlock.ts`
  - `frontend/electron/src/lego_blocks/hierarchyPathBlock.ts`
  - `frontend/electron/src/orchestrators/hierarchyDbOrch.ts`
  - `frontend/electron/src/orchestrators/hierarchyOrch.ts`
- Frontend hierarchy runtime adapters (SQLite-based):
  - `frontend/src/services/lego_blocks/hierarchyDbBlock.ts`
  - `frontend/src/services/lego_blocks/hierarchyBlock.ts`
  - `frontend/src/services/orchestrators/hierarchyDbOrch.ts`
  - `frontend/src/services/orchestrators/hierarchyOrch.ts`
- Hierarchy tree block (SQLite-based): `frontend/src/components/lego_blocks/HierarchyTreeBlock.tsx`
- Idea thought activity block: `frontend/src/components/lego_blocks/IdeaThoughtActivityBlock.tsx`

## Known Gaps
- Thought edit is standardized via one shared markdown side-sheet (view + edit toggle in popup header).
- Calendar checklist UI is standardized via one shared component.
- YAML frontmatter parsing/writing primitives implemented (yamlNoteBlock.ts) — Phase 1 DONE.
- IndexedDB cache layer implemented (dbBlock.ts + vaultSyncOrch.ts) — Phase 2 DONE.
- ThinkingOrganizer now supports YAML tree reparenting and explorer file/folder drop mapping into YAML `parent` metadata with IndexedDB sync.
- ThinkingOrganizer backlog create flow now supports explicit Jira-like node type selection (including idea buckets and thought buckets) with separate link tab preserved.
- New Thought and Todo create flows now write YAML-frontmatter markdown; legacy todo files are upgraded to YAML on append.
- Capability contract is centralized in frontend (`capabilityRegistryBlock` + `capabilityRouterOrch`) and now exposed for curl through backend `/api/capabilities` proxy that delegates to `frontend/scripts/agent/capabilityRunner.ts`.
- Discovery/invocation UI exists at `/capabilities` via `frontend/src/components/orchestrators/CapabilityDiscoveryOrch.tsx`.
- No unified AI text action system across text boxes.
- No extension SDK/runtime yet.
- No explicit local-first agent management domain model yet.
- Very limited/no app-level automated tests.

## Technical Debt (Audit: 2026-02-13, updated 2026-02-14)
Full audit: `agents/AUDITS.md`
- **LTM-015**: DONE - Test safety net for data-writing paths
- **LTM-016**: ThinkingOrganizerOrch at 1293 lines — needs decomposition into per-tab orchestrators
- **LTM-017**: OBSOLETE — Electron SQLite will be removed entirely, not migrated
- **LTM-018**: DONE - EXCLUDED_DIRS consolidated
- **LTM-019**: DONE - localStorage keys centralized
- **LTM-020**: OBSOLETE — hierarchy code unification no longer needed; SQLite code will be deleted

## Near-Term Execution Order
Reference: `README.md` phase order.

1. YAML Note Block (parse/stringify/validate)
2. IndexedDB Cache Layer (Dexie.js)
3. Hierarchy UI (tree view + reparent)
4. Thought Edit Flow
5. AI Actions (related, summarize, cleanup)
6. Migration + Polish (remove SQLite, migrate old thoughts)
7. Local-only extension platform
8. AI text actions everywhere
9. Agent-management-oriented domain and UX foundations

## Invariants to Preserve
- Keep markdown with YAML frontmatter portable and user-owned.
- Keep local-first privacy promises.
- Do not add remote execution in early extension milestones.
- Avoid destructive migrations; use reversible/migratable operations.
- Keep frontend architecture explicit: reusable `*Block` files in `lego_blocks`, orchestration `*Orch` files in `orchestrators`.
- Keep service-layer architecture explicit: reusable service primitives in `services/lego_blocks`, workflow service composition in `services/orchestrators`.
- Hierarchy is metadata-driven (YAML frontmatter), not folder-driven.
- IndexedDB is a pure cache — can be rebuilt from YAML files at any time.
- Thought capture/edit flows should work without backend.
