# ltm-pilot

Local-first thinking workspace for Long Term Memory (LTM), built for fast human + AI collaboration on personal knowledge.

## Why This Exists
Most note tools force users into fixed plugin models and fragmented AI workflows.

`ltm-pilot` is moving toward:
- A natural thought hierarchy: `Programs -> Epics -> Ideas -> Thoughts`
- Ambient AI assistance directly where writing happens
- In-app extensibility so users can build features without leaving the app
- Local-first ownership of data and behavior

## Current Codebase Understanding (As of 2026-02-19)

### Product Surface Today
The app has both tool-centric and hierarchy-centric UI surfaces.

Primary routes in the app:
- `Home`
- `Thinking Space`
- `New Thought`
- `Todos`
- `Insights`
- `Chat`
- `AI Settings`
- `Extension Builder` (feature-flagged)
- `Capabilities`
- `Thinking Organizer` (hierarchy tree view with create, reparent, drag-drop)
- `Excalidraw++` tools (`Format for Excalidraw`, `PDF to Markdown`, `Transcript Cleaner`)

### Runtime Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind (`frontend/`)
- **Backend (web mode)**: FastAPI + Python (`backend/`) — thin proxy only, being phased out for core features
- **Desktop/mobile modes**: Electron + Capacitor (`frontend/electron/`, `frontend/ios/`)
- **Storage**: Markdown files with YAML frontmatter in the vault (source of truth)
- **Cache**: IndexedDB via Dexie.js (in-browser fast access layer, rebuildable)
- **Agent CLI**: `./ltm` wrapper for capability invocations (see Agent Capability Transport section)

### Recent Delivery Highlights
- Native AI login support for both Electron and Capacitor runtimes
  - Manual credential login for Claude, OpenAI/Codex, and Azure GPT in `AI Settings`
  - Native provider availability + direct chat routing parity outside web-backend mode
- Desktop-to-mobile AI OAuth handoff
  - Generate transfer code from Electron login state
  - Import transfer code on mobile native runtime for Claude/Codex OAuth usage
- Capability IPC adapter parity hardening against FastAPI transport
- EPIC-3 local extension platform foundations (declarative-first)
  - Extension manifest validator + compatibility checks
  - Extension loader + registry lifecycle (`discover`, `reload`, `activate`, `deactivate`)
  - Declarative extension actions + runtime UI slots (`sidebar-bottom`, `thought-context-actions`)
  - Electron-only JS/TS extension runtime sandbox (permission-gated capability bridge, audit-aware extension context)
  - In-app extension builder flow (generate, permission review, preview, save, optional activate)
  - Rollout feature flags for extension host and extension builder
- Multi-platform packaging progress
  - Electron app packaging path
  - iOS build/sync path for Capacitor app testing

### Frontend Architecture Contract
- Reusable primitives live in `frontend/src/components/lego_blocks/*`.
- Orchestration containers live in `frontend/src/components/orchestrators/*`.
- Naming rules are mandatory for readability:
  - Reusable primitives use `*Block` suffix.
  - Orchestrators use `*Orch` suffix.
- Shared UI primitives live in `frontend/src/components/lego_blocks/ui/*`.
- New feature work should extend/reuse existing lego blocks first, then compose in orchestrators.
- This contract is enforced by project docs: `AGENTS.md`, `CLAUDE.md`, and `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`.

### Service Architecture Contract
- Reusable service primitives live in `frontend/src/services/lego_blocks/*`.
- Workflow service composition lives in `frontend/src/services/orchestrators/*`.
- Naming rules are mandatory for readability:
  - Reusable service primitives use `*Block` suffix.
  - Service orchestrators use `*Orch` suffix.
- UI code should consume service orchestration modules by default.

### Key Existing Strengths
- Strong cross-platform filesystem abstraction in `frontend/src/services/lego_blocks/fsBlock.ts`
  - Works across web backend, Electron IPC, and Capacitor
- Existing secure-ish path boundary checks in backend and Electron (`resolve + relative_to`/`startsWith` patterns)
- Existing thought/todo scanners and calendar visualizations
- Existing vault setup flow for Electron (`VaultSetupOrch` + local vault root binding)

### What Works Today
- Create thought files with YAML frontmatter (title, date header, emotions, tags)
- Create and toggle todos
- Scan vault sections and render month-level activity for thoughts/todos/files
- Open and edit markdown files in a unified viewer/editor (`MarkdownViewerOrch`)
- Conflict-safe save with mtime/hash checks
- YAML frontmatter parse/stringify/validate via `yamlNoteBlock.ts`
- IndexedDB cache layer via Dexie.js (`dbBlock.ts`) with vault sync (`vaultSyncOrch.ts`)
- Thinking Organizer: hierarchy tree view with create, reparent, drag-drop, node detail panel
- Jira-style node creation flow with project-scoped organizer storage
- Global AI settings with provider/model defaults, per-tab provider selection, and per-tab model overrides
- AI telemetry panel and event logging for AI requests
- Native AI login management on Electron + Capacitor (`AI Settings`)
- Desktop-to-mobile transfer-code import flow for Claude/Codex OAuth credentials
- Extension host runtime with manifest validation, compatibility gating, declarative action execution, and Electron JS/TS runtime dispatch
- In-app Extension Builder route for generating/saving local extension artifacts under vault `.extensions/*`
- Agent capability transport: 30 capabilities via frontend runner + FastAPI proxy
- Agent CLI wrapper (`./ltm`) for ergonomic capability invocation
- Agent workspace with task lifecycle, run logging, handoffs, and audit trail
- Run utility transforms (excalidraw formatting, transcript cleanup, pdf conversion)
- Automated frontend test suite (Vitest) with coverage across services/orchestrators and capability parity fixtures

### Current Gaps (Important)
- Thoughts scanner is file/date-oriented only, not fully semantic hierarchy-oriented
- AI text actions are implemented in key surfaces but not yet unified across every text surface
- Electron supports a sandboxed JS/TS extension runtime; Capacitor/web remain declarative-only
- No dedicated end-to-end app test harness yet (coverage is primarily unit/service-level)
- Drag-drop YAML metadata mapping still in progress (DEV-009)
- YAML Note Block + IndexedDB cache integration still being hardened (DEV-008)

## Target Direction

### Product Direction
Build a modular local-first "thinking OS" where:
- Humans capture structured thinking in a logical hierarchy
- AI assists contextually at every writing surface
- Users can extend behavior inside the app
- Everything remains user-owned, text-based, inspectable, and git-friendly

Three product identities (same product, architecture supports all three):

**1. "Thinking space for individuals"**
- Appeals to: knowledge workers, researchers, writers, founders
- Value prop: Fast, local, hierarchical thinking (Programs -> Epics -> Ideas -> Thoughts)
- Entry point: "I need a better way to organize my thoughts"

**2. "Place where humans and AI work together"**
- Appeals to: people who are AI-savvy but frustrated with current tools
- Value prop: Your thinking and AI assistance in the same space, with context
- Entry point: "AI tools are useful but disconnected from where I actually think"

**3. "AI agent management space for humans"**
- Appeals to: power users, developers, people orchestrating multiple AI workflows
- Value prop: Manage agents, track their work, integrate with your thinking
- Entry point: "I'm running AI agents but have nowhere to manage them alongside my own thoughts"

These three are non-negotiable architecture constraints for implementation.

### Information Model Direction
Core hierarchy (metadata-driven via YAML frontmatter, independent of folder structure):
- `Program`: larger long-running bucket (level 0)
- `Epic`: multi-month/multi-year outcome track (level 1)
- `Idea Bucket`: container for related ideas (level 2)
- `Idea`: concrete initiative (level 3)
- `Thought Bucket`: container for related thoughts (level 4)
- `Thought`: atomic progress artifact and reflection (level 5)

Future-ready but not first-release requirement:
- Multi-parent relationships
- Cross-links and graph views
- Team/enterprise collaborative mode

## Locked Product/Tech Decisions
These are explicitly chosen and should be treated as constraints.

1. **Runtime priority**: Electron-first for early milestones.
2. **Storage**: YAML frontmatter in Markdown files as source of truth. IndexedDB (Dexie.js) as rebuildable cache.
3. **Hierarchy**: Metadata-driven via YAML `parent` fields. Folders are arbitrary/pragmatic (user's choice).
4. **No backend for core features**: Core hierarchy, editing, and AI features work without backend.
5. **No SQLite / native DB**: Removed in favor of YAML + IndexedDB.
6. **Similarity MVP**: Lexical search first via IndexedDB full-text (no embedding dependency in first pass).
7. **Extensibility safety**: Local-only extensions first, no remote code execution early.
8. **AI local-first**: Ollama (Electron) or WASM LLM (web/PWA).

## Agent Capability Transport (Frontend-Owned)

Organizer operations are exposed through one capability contract in frontend TypeScript:
- Registry: `frontend/src/services/lego_blocks/capabilityRegistryBlock.ts`
- Router: `frontend/src/services/orchestrators/capabilityRouterOrch.ts`
- Contract ADR: `docs/ADR-005-Agent-Capabilities.md`
- Agent workspace schema ADR: `docs/ADR-006-Agent-Workspace-Schema.md`
- Rollout matrix: `docs/CAPABILITY_ROLLOUT_MATRIX.md`
- Ops repo checklist: `docs/OPS_REPO_SYNC_CHECKLIST.md`

External agent/curl access uses a thin transport layer:
- Frontend runner: `frontend/scripts/agent/capabilityRunner.ts`
- FastAPI proxy endpoints:
  - `GET /api/capabilities`
  - `POST /api/capabilities/invoke`

Workspace bootstrap/import tool:
- `frontend/scripts/agent/bootstrapAgentWorkspace.ts`
- Command:
  - `cd frontend && npm run agent:workspace:bootstrap -- "<project-root-path>"`

Operational controls:
- Frontend feature flags:
  - `agent_capabilities_enabled` (default: `false`)
  - `fastapi_capability_adapter_enabled` (default: `false`)
  - `extension_host_enabled` (default: `false`)
  - `extension_builder_enabled` (default: `false`)
- FastAPI adapter environment controls:
  - `LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED=true`
  - `LTM_CAPABILITY_BEARER_TOKEN=<token>` (optional)
  - `LTM_CAPABILITY_RATE_LIMIT_PER_MINUTE=<int>`
  - `LTM_CAPABILITY_MAX_PAYLOAD_BYTES=<int>`

Important constraint:
- Python backend does **not** implement duplicate YAML hierarchy services.
- Backend only proxies requests to the frontend capability runner.

## Agent Operations Pattern (Mandatory)

For active agent orchestration, the source of truth is the vault-native organizer workspace:
- `coding-projects/thinking-space/thinking-organizer/*`

Required operating pattern:
1. Sync vault/cache first (`Sync Vault Now`) before reading/updating operational state.
2. Execute task lifecycle in-tool (`task.claim`, `task.update_status`, organizer UI actions).
3. Every created operation node must include a meaningful YAML `description`.
4. Every execution plan must be recorded in-tool before implementation begins.
5. Record run/handoff outcomes in-tool (`run.log`, `handoff.create`, comments/state history).

Recommended organizer layout:
- `development (agent operations)` program for implementation tasks/plans/runs.
- `handoffs (agent operations)` program for cross-session transfers.
- `principles and decisions (agent operations)` program for durable operating guidance.

Quick invocation examples:
```bash
# CLI wrapper (recommended for agents — auto-loads .env, sets flags, defaults actor)
./ltm organizer.nodes.list_roots --typeFilter program
./ltm task.claim --uuid "abc-123" --owner claude-code
./ltm run.log --title "Session" --projectRoot coding-projects/thinking-space --agentName claude-code --result success

# curl via FastAPI proxy (requires backend running)
curl -s http://127.0.0.1:8000/api/capabilities/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "organizer.nodes.list_roots",
    "input": {"typeFilter": "program"},
    "actor": {"kind": "agent", "id": "curl"}
  }'
```

## Storage Strategy (Locked)

### YAML Frontmatter + IndexedDB
- **Markdown files with YAML frontmatter** are the source of truth (portable, user-owned, git-friendly)
- **IndexedDB** (via Dexie.js) caches parsed frontmatter for fast hierarchy queries
- **Hierarchy lives in metadata** (`parent`, `type`, `level` fields), not folder structure
- **Folders are user's choice** — organize by date, domain, source, inbox/archive, whatever works

Full schema: `docs/ADR-004-YAML-Architecture.md`

### Example Note File
```yaml
---
uuid: "550e8400-e29b-41d4-a716-446655440000"
key: "build-thinking-space"
title: "Build Thinking Space App"
type: "epic"
level: 1
parent: "personal-growth"
parent_uuid: "a1b2c3d4-..."
tags: ["project/app", "ai/pkm"]
status: "active"
progress: 0.42
created_at: "2026-02-14T17:30:00Z"
updated_at: "2026-02-14T18:15:00Z"
---

## Body content here

Regular markdown body text...
```

### File Naming (Recommended, Not Enforced)
`{type}-{key}.md` or `{key}.md`
Examples: `epic-build-thinking-space.md`, `thought-ollama-in-browser.md`

### Vault Layout
```text
vault/
  thoughts/
    thought-ai-extensibility-ideas.md
    thought-ollama-in-browser.md
  epics/
    epic-build-thinking-space.md
  ideas/
    idea-in-app-feature-builder.md
  canvases/
    thinking-space-hierarchy.excalidraw.md
  attachments/
```
Folders are convenience groupings only. The app never enforces or relies on folder structure. Hierarchy is derived from YAML `parent` fields.

## Implementation Plan (Execution Phases)

### Phase 0: Architecture Alignment (EPIC-0) — IN PROGRESS
Completed to date: docs alignment, YAML schema definition, SQLite removal, dependency install, architecture conformance refactor (lego blocks + orchestrators), coding philosophy standardization.

Remaining: ongoing architecture/doc drift checks as platform and AI features expand.

### Phase 1: YAML Note Block — DONE (hardening in progress)
Completed: `yamlNoteBlock.ts` (parse/stringify/validate/key generation), `NewThoughtOrch` creates YAML frontmatter notes, backward compat with plain thoughts, YAML frontmatter in new thought + todo create flows (DEV-010).

Remaining: DEV-008 hardening pass for edge cases and roundtrip fidelity.

### Phase 2: IndexedDB Cache Layer — DONE (hardening in progress)
Completed: `dbBlock.ts` (Dexie.js schema, upsert, query, search), `vaultSyncOrch.ts` (scan vault, populate IndexedDB), incremental sync, agent orchestration metadata now first-class in cache (DEV-014).

Remaining: DEV-008 hardening pass for sync reliability and cache integrity.

### Phase 3: Hierarchy UI (ThinkingOrganizer) — MOSTLY DONE
Completed: `TreeViewBlock.tsx` recursive tree with collapse/expand, `ThinkingOrganizerOrch` driven by IndexedDB, Jira-style create flow with project-scoped storage (DEV-011), hierarchy CRUD + mirrored path manager (DEV-005), node detail panel with arbitrary YAML field rendering.

Remaining: DEV-009 drag-and-drop YAML metadata mapping (in progress).

### Phase 4: Thought Edit Flow — DONE
Completed: unified markdown viewer/editor (`MarkdownViewerOrch`), conflict-safe save with mtime/hash checks (DEV-001), edit + save without data loss (DEV-002).

### Phase 5: AI Actions — IN PROGRESS
Completed to date:
- Global AI settings and telemetry
- Per-tab provider/model overrides for AI actions
- Native AI login/runtime parity for Electron + Capacitor
- Desktop-to-mobile OAuth handoff for Claude/Codex in native runtime

Remaining scope:
- Fully unify AI text actions across every major text surface
- Expand local AI runtime options (Ollama/WASM path completion)

Exit criteria:
- Related thoughts surfaced while editing
- Summarize/cleanup actions work consistently across major text inputs

### Phase 6: Migration + Polish — NOT STARTED
Scope:
- One-time migration script for old thoughts -> YAML frontmatter
- Remove obsolete SQLite code (backend hierarchy services, electron sqlite)
- Error handling, loading states, offline mode

Exit criteria:
- All old thoughts migrated to YAML
- App works without backend in Electron
- Clean codebase with no dead SQLite code

### Agent Capability Transport — DONE (completed outside original phase plan)
Completed across DEV-012, DEV-013, DEV-014:
- 30-capability registry with typed I/O contracts (`capabilityRegistryBlock.ts`)
- Capability router with policy/audit/dry-run (`capabilityRouterOrch.ts`)
- Frontend CLI runner (`capabilityRunner.ts`) + `./ltm` shell wrapper
- FastAPI thin proxy (`/api/capabilities`, `/api/capabilities/invoke`)
- Feature flags, rate limiting, bearer token controls
- Agent workspace bootstrap + task lifecycle + run/handoff/comment operations
- Adapter parity fixtures and rollout matrix

### EPIC-3: Local-Only Extension Platform — IN PROGRESS (T1-T7 DELIVERED)
Completed:
- Extension manifest parser/validator + compatibility contract (`api_version`, `min_app_version`, `entry_kind`)
- Extension loader/registry lifecycle orchestration (`discover`, `reload`, `activate`, `deactivate`)
- Declarative action schema + slot routing (`sidebar-bottom`, `thought-context-actions`)
- Runtime extension UI slot component integration in Thinking Space surfaces
- Electron-only JS/TS runtime sandbox with capability-bridge permission checks + audit propagation
- In-app extension builder flow (`/extension-builder`) with permission approval gate

Remaining:
- Phase E: extension packaging/share/import and migration tooling

Exit criteria:
- User can generate and enable a local extension safely inside app
- Extension platform can be enabled/disabled with deterministic feature flags

Reference:
- `docs/EPIC-3-LOCAL-EXTENSION-PLATFORM.md` (manifest/actions contract, rollout controls, test harness commands)

### EPIC-5: AI Actions Everywhere — NOT STARTED
Scope:
- Shared text action component for all text surfaces
- `Summarize`, `Cleanup`, `Related` actions with preview-before-apply
- Unified invocation and error handling model

Exit criteria:
- Every major textbox/editor gets the same AI action UX

### EPIC-6: Optional Remote/Agent Backends (Later)
Scope:
- Add optional remote task execution/provider connectors
- Keep local-first behavior as default

Exit criteria:
- Remote execution is optional and additive, not required

## Milestone Releases
- `v0.2`: Phase 1-2 (YAML notes + IndexedDB cache) — hardening in progress
- `v0.3`: Phase 3-4 (hierarchy UI + edit flow) — Phase 4 done, Phase 3 nearly done
- `v0.4`: Phase 5 (AI actions + native AI login/runtime parity) — in progress
- `v0.5`: EPIC-3 (extension platform foundations delivered, rollout hardening in progress)

## Success Metrics
- Thought edit completion without overwrite/data loss regressions
- Reparent operations update YAML files correctly with no orphan metadata
- Related retrieval latency target for personal vault scale: sub-150ms typical
- Zero remote execution required for extension workflows in first platform release
- IndexedDB rebuilds correctly from YAML files (cache integrity)

## Risks and Mitigations
- **Risk**: YAML frontmatter parse errors
  - **Mitigation**: strict validation in `yamlNoteBlock`, graceful fallback for malformed files
- **Risk**: IndexedDB cache diverges from YAML files
  - **Mitigation**: IndexedDB is pure cache, can be rebuilt anytime; incremental sync on file changes
- **Risk**: Large vault performance with file-based scanning
  - **Mitigation**: incremental sync, file watcher events, IndexedDB caching
- **Risk**: Unsafe extension behaviors
  - **Mitigation**: explicit permission model + local-only policy + restricted capability surface + feature-flagged rollout
- **Risk**: Cross-platform runtime policy mismatch (especially iOS dynamic execution constraints)
  - **Mitigation**: declarative-first extension contract (`manifest.json` + actions/templates), avoid arbitrary remote code execution
- **Risk**: Context bloat for multi-agent work
  - **Mitigation**: organizer tool-native operations + capability audit logs + required in-tool plan/handoff records

## Multi-Agent Collaboration Infrastructure
Use the organizer workspace as source of truth for active operations:
- `coding-projects/thinking-space/thinking-organizer/*`

- `AGENTS.md`
  - Top-level implementation contract (must-read before coding)
- `docs/ADR-005-Agent-Capabilities.md`
  - Capability contract, transport, policy/audit expectations
- `docs/ADR-006-Agent-Workspace-Schema.md`
  - Workspace schema and required operation fields
- organizer programs
  - `development (agent operations)` for active implementation tasks/plans/runs
  - `handoffs (agent operations)` for transfer records
  - `principles and decisions (agent operations)` for durable guidance
- `agents/TEMPLATES/HANDOFF_TEMPLATE.md`
  - Required handoff format
- `agents/README.md`
  - Additional protocol notes + templates

Workflow:
1. Read `AGENTS.md`
2. Read `README.md`
3. Read `agents/README.md`
4. Read `docs/ADR-005-Agent-Capabilities.md`
5. Read `docs/ADR-006-Agent-Workspace-Schema.md`
6. Sync organizer cache and claim an in-tool task (`task.claim`)
7. Record plan/run/handoff updates in organizer workspace

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173`

### Electron
```bash
cd frontend
npm run electron:dev
```

### Backend (web mode, optional — being phased out)
```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```
Runs on `http://localhost:8000`

---

This README is intentionally long-form and strategic so all agents can onboard fast without rediscovering architecture and direction each session.
