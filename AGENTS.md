# AGENTS.md

Required operating contract for any coding agent working in `ltm-pilot`.

If this file conflicts with assumptions, follow this file + `README.md`.

## Mission
Build one product that is intentionally all three of these from the ground up:

1. Thinking space for individuals
- Audience: knowledge workers, researchers, writers, founders
- Value: fast, local, hierarchical thinking (`Programs -> Epics -> Ideas -> Thoughts`)
- Entry: "I need a better way to organize my thoughts"

2. Place where humans and AI work together
- Audience: AI-savvy users frustrated by disconnected tools
- Value: thinking and AI assistance in the same contextual workspace
- Entry: "AI tools are useful but disconnected from where I actually think"

3. AI agent management space for humans
- Audience: power users, developers, multi-agent operators
- Value: manage agents, track runs/work, integrate output with human thinking
- Entry: "I am running AI agents but have nowhere to manage them alongside my own thoughts"

These are architecture requirements, not optional positioning variants.

## Strategy Rules
- Do not design isolated feature silos for only one pillar.
- Prefer shared primitives that strengthen all three pillars.
- Any major change must state pillar impact before implementation.

## Working Style (Derived from CLAUDE.md)
- Think from first principles, then map decisions to concrete code tradeoffs.
- Stay concise and direct; avoid filler and vague recommendations.
- Challenge weak assumptions politely and propose better alternatives.
- Optimize for practical progress, not theoretical architecture purity.

## CLAUDE.md and AGENTS.md
- `CLAUDE.md` is Claude Code's native file for project-specific instructions.
- `AGENTS.md` is the cross-tool open-standard contract.
- Both should contain consistent onboarding, architecture constraints, and execution priorities.
- If Claude learns useful project knowledge, Claude must manually update `CLAUDE.md` and synchronize durable items into `AGENTS.md` and `agents/UNDERSTANDINGS.md`.

## Phase Order
Use phase order defined in `README.md` as source of truth.

Current order to respect:
1. Phase 0: Architecture Alignment (docs + deps) — IN PROGRESS
2. Phase 1: YAML Note Block
3. Phase 2: IndexedDB Cache Layer
4. Phase 3: Hierarchy UI
5. Phase 4: Thought Edit Flow
6. Phase 5: AI Actions
7. Phase 6: Migration + Polish
8. EPIC-3: Local-Only Extension Platform
9. EPIC-5: AI Actions Everywhere
10. EPIC-6: Optional Remote/Agent Backends (later)

If sequence changes, update `README.md` first, then align `agents/TODO.md`.

## Locked Technical Decisions
1. Electron-first runtime for near-term milestones.
2. **YAML frontmatter in Markdown files** as source of truth for all node metadata and hierarchy.
3. **IndexedDB (Dexie.js)** as rebuildable in-browser cache. NOT a source of truth.
4. **No SQLite / native DB** — previous SQLite plan is superseded.
5. **No backend required** for core features (hierarchy, editing, AI).
6. **Folders are arbitrary** — hierarchy is metadata-driven via YAML `parent`/`children` fields.
7. Lexical related retrieval first via IndexedDB full-text search.
8. Local-only extensions first; no early remote code execution.
9. AI local-first: Ollama (Electron) or WASM LLM (web/PWA).

## Architecture Reference
Full YAML schema and architecture details: `docs/ADR-004-YAML-Architecture.md`

## Architecture Guardrails
- Keep markdown files with YAML frontmatter as portable source-of-truth content.
- Hierarchy is defined by YAML `parent`/`children`/`type`/`level` fields, NOT folder structure.
- IndexedDB is a pure cache layer — can be rebuilt from YAML files at any time.
- Standardize markdown view/edit through one shared orchestrator (`frontend/src/components/orchestrators/MarkdownViewerOrch.tsx`); do not add page-local markdown edit modals.
- Reparent by updating YAML `parent`/`children` fields in affected files + syncing IndexedDB.
- Add conflict-safe saves for thought editing (`mtime`/hash checks).
- Avoid destructive migrations without rollback/recovery path.
- No backend dependency for core features.

## Code Design Philosophy
- Use lego blocks: small reusable primitives for UI, hooks, and services.
- Use orchestrators: page/feature containers that compose primitives and own flow/state wiring.
- Keep primitives generic and prop-driven; avoid feature-specific branching inside shared components.
- Keep data loading, derived selectors, and orchestration handlers in orchestrators.
- If logic or UI is duplicated twice, extract or extend a shared primitive before adding a third copy.
- Do not add one-off editors, viewers, or modals when a shared component can be extended safely.
- Caution: keep orchestrators thin. If an orchestrator starts accumulating reusable domain logic, parsing, or complex transformation code, extract that into lego blocks (components/services/hooks) immediately.

## Frontend Placement and Naming Rules (Enforced)
- `frontend/src/components/lego_blocks/*` stores reusable primitives only.
- `frontend/src/components/orchestrators/*` stores page/feature orchestration containers only.
- File suffixes are mandatory:
  - Reusable primitives end with `Block` (example: `SectionChecklistBlock.tsx`).
  - Orchestration containers end with `Orch` (example: `TodoCalendarOrch.tsx`).
- Shared UI primitives stay under `frontend/src/components/lego_blocks/ui/*` and are treated as lego blocks.
- Pages should compose orchestrators/blocks, not duplicate orchestration logic.
- New frontend component files that violate this structure should not be added unless `AGENTS.md` is updated first with rationale.

## Service Placement and Naming Rules (Enforced)
- `frontend/src/services/lego_blocks/*` stores low-level reusable service primitives (runtime adapters, scanners, transforms, shared types).
- `frontend/src/services/orchestrators/*` stores workflow service composition entrypoints used by UI orchestrators/pages.
- Service file naming is mandatory:
  - Primitive service files end with `Block` (example: `fsBlock.ts`, `yamlNoteBlock.ts`).
  - Workflow service files end with `Orch` (example: `thoughtsOrch.ts`, `vaultSyncOrch.ts`).
- UI code should import service workflows from `services/orchestrators` by default.
- Direct imports from `services/lego_blocks` in UI are only allowed for shared type-only usage.

## Architecture Review Checklist (Required for frontend changes)
1. Did I place reusable logic in `lego_blocks` and flow wiring in `orchestrators`?
2. Did I keep naming consistent with `*Block` and `*Orch`?
3. Did I avoid page-local one-off variants of existing shared components?
4. Did I update docs (`AGENTS.md`, `CLAUDE.md`, `agents/UNDERSTANDINGS.md`) if architecture knowledge changed?

## Orchestrator Template Rule
- New major screen-level orchestrators should follow `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`.
- Keep section order consistent so agents can scan and modify code quickly.
- If an orchestrator intentionally deviates, document why at the top of the file.

## Security and Trust
- Preserve local-first privacy guarantees.
- Minimize extension permissions and enforce explicit consent.
- No hidden remote calls in "local-only" flows.

## Multi-Agent Workflow
Before coding:
1. Read `AGENTS.md`
2. Read `README.md`
3. Read `agents/UNDERSTANDINGS.md`
4. Read `agents/TODO.md`
5. Read latest `agents/HANDOFFS.md`

During work:
- Claim one task in `agents/TODO.md` (`READY -> IN_PROGRESS`).
- Keep scope tied to acceptance criteria.
- Update `agents/UNDERSTANDINGS.md` if you discover reusable context.

After work:
- Mark task state in `agents/TODO.md`.
- Log outcomes in `agents/DONE.md`.
- Write handoff in `agents/HANDOFFS.md` using `agents/TEMPLATES/HANDOFF_TEMPLATE.md` when needed.
- Use detailed git commit messages with clear scope, intent, and key change summary; avoid vague messages like `fix`, `update`, or `wip`.
- Commit body must start with the exact completed-work summary already produced by the agent for that task, then optionally add extra detail.
- Use `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md` for commit structure.

## Quality Bar
Every task completion should answer:
1. Which pillar(s) improved?
2. Which guardrails were preserved?
3. What tests/validations were run?
4. What docs were updated for the next agent?
