# CLAUDE.md

Project-local Claude instructions for `ltm-pilot`.

This file applies only when working inside `ltm-pilot/`.

## Relationship to AGENTS.md
- `CLAUDE.md` is Claude Code's native project instruction file.
- `AGENTS.md` is the tool-agnostic/open-standard agent contract across coding tools.
- Both should stay consistent on architecture, priorities, and operating rules.

## Responsibility (Critical)
If Claude learns something useful, Claude must manually update `CLAUDE.md` to preserve that knowledge for future sessions.

Also mirror durable project knowledge to:
- `AGENTS.md` (cross-tool contract)
- `agents/UNDERSTANDINGS.md` (token-efficient shared context)

## Working Style (Inherited + Project-Specific)
- Think from first principles, then map to concrete code tradeoffs.
- Be concise and direct.
- Challenge weak assumptions with practical alternatives.
- Optimize for implementation momentum without sacrificing safety.

## Product Direction (Non-Negotiable)
The app must be built as all three from the ground up:

1. Thinking space for individuals
- Fast, local, hierarchical thinking (`Programs -> Epics -> Ideas -> Thoughts`)

2. Place where humans and AI work together
- Thinking and AI assistance in one contextual workspace

3. AI agent management space for humans
- Agent orchestration/visibility integrated with human thought workflows

These are architecture constraints, not optional positioning variants.

## Phase Order (Follow README)
Use `README.md` as source of truth.

Current order:
1. Phase 0: Architecture Alignment (update docs, install deps) — IN PROGRESS
2. Phase 1: YAML Note Block (parse/stringify/validate)
3. Phase 2: IndexedDB Cache Layer (Dexie.js)
4. Phase 3: Hierarchy UI (tree view + reparent)
5. Phase 4: Thought Edit Flow
6. Phase 5: AI Actions (related, summarize, cleanup)
7. Phase 6: Migration + Polish (remove SQLite code, migrate old thoughts)
8. EPIC-3: Local-Only Extension Platform
9. EPIC-5: AI Actions Everywhere
10. EPIC-6: Optional Remote/Agent Backends (later)

## Locked Technical Decisions
1. Electron-first runtime for near-term milestones.
2. **YAML frontmatter in Markdown files** as source of truth for hierarchy and metadata.
3. **IndexedDB (Dexie.js)** as rebuildable in-browser cache for fast hierarchy queries.
4. **No SQLite / native DB** — removed in favor of YAML + IndexedDB.
5. **No backend required** for core features (hierarchy, editing, AI actions).
6. **Folders are arbitrary** — hierarchy lives in YAML `parent` fields, not folder structure.
7. Related retrieval starts with lexical search via IndexedDB full-text.
8. Local-only extensions first; no early remote code execution.
9. AI local-first: Ollama (Electron) or WASM LLM (web/PWA).
10. Markdown file interaction uses one shared orchestrator/provider (`frontend/src/components/orchestrators/MarkdownViewerOrch.tsx`) for both view and edit; avoid page-specific editor overlays.
11. Code architecture follows lego blocks + orchestrators:
  - Reusable primitives in components/hooks/services.
  - Page/feature orchestration in orchestrator containers.
  - New major orchestrators follow `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`.

## Architecture Reference
Full YAML schema and architecture details: `docs/ADR-004-YAML-Architecture.md`

## Frontend Architecture Contract (Enforced)
- Reusable primitives must live in `frontend/src/components/lego_blocks/*`.
- Page/feature orchestration must live in `frontend/src/components/orchestrators/*`.
- Naming is mandatory:
  - Reusable primitive files use `*Block` suffix.
  - Orchestrator files use `*Orch` suffix.
- Shared UI primitives stay in `frontend/src/components/lego_blocks/ui/*`.
- Do not add one-off feature components in `pages/` when a lego block or orchestrator extension is the correct pattern.
- If an exception is unavoidable, document it in both `CLAUDE.md` and `AGENTS.md` in the same change.
- Caution: keep UI orchestrators thin. Extract reusable logic and heavy transformations into lego blocks/hooks/services before orchestrator complexity grows.

## Service Architecture Contract (Enforced)
- Low-level reusable service primitives must live in `frontend/src/services/lego_blocks/*`.
- Workflow service composition must live in `frontend/src/services/orchestrators/*`.
- Naming is mandatory:
  - Service primitive files use `*Block` suffix.
  - Service workflow files use `*Orch` suffix.
- UI code should consume service orchestrators by default, not low-level service primitives.
- Caution: keep service orchestrators thin. Move shared algorithms, scanners, adapters, and transformation logic into service lego blocks.

## Key New Service Blocks (To Be Created)
- `frontend/src/services/lego_blocks/yamlNoteBlock.ts` — YAML frontmatter parse/stringify/validate/key generation
- `frontend/src/services/lego_blocks/dbBlock.ts` — Dexie.js IndexedDB cache layer
- `frontend/src/services/orchestrators/vaultSyncOrch.ts` — vault scan to IndexedDB sync
- `frontend/src/services/lego_blocks/aiBlock.ts` — local AI action primitives

## Mandatory Startup Sequence (Claude Sessions)
1. Read `AGENTS.md`
2. Read `README.md`
3. Read `agents/README.md`
4. Read `agents/UNDERSTANDINGS.md`
5. Read `agents/TODO.md` and `agents/HANDOFFS.md` as transition snapshots only
6. Open active tasks/plans from vault-native organizer workspace (`coding-projects/thinking-space/thinking-organizer/*`)
7. Sync organizer cache before task updates (`Sync Vault Now` / equivalent capability path)

## Multi-Agent Discipline
- Use organizer tool as source of truth for active operations (tasks, plans, runs, handoffs).
- Every created operation node must include a substantive YAML `description`.
- Every implementation plan must be recorded in the organizer tool before execution starts.
- Keep `agents/*.md` as read-only transition snapshots unless explicitly asked to update them.
- Follow workspace usage pattern:
  - `development (agent operations)` for active task/plan/run work.
  - `handoffs (agent operations)` for handoff records.
  - `principles and decisions (agent operations)` for durable guidance.
- Keep docs synchronized when strategy or architecture shifts.
- Use detailed commit messages that capture scope + intent + key changes; do not use generic commit titles.
- Commit body must begin with the exact completion summary already shared by the agent, then optionally expand with technical context.
- Follow `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md`.

## Scope Boundary
These instructions apply to `ltm-pilot` only.
