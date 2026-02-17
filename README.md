# ltm-pilot

Local-first thinking workspace for Long Term Memory (LTM), built for fast human + AI collaboration on personal knowledge.

## Why This Exists
Most note tools force users into fixed plugin models and fragmented AI workflows.

`ltm-pilot` is moving toward:
- A natural thought hierarchy: `Programs -> Epics -> Ideas -> Thoughts`
- Ambient AI assistance directly where writing happens
- In-app extensibility so users can build features without leaving the app
- Local-first ownership of data and behavior

## Current Codebase Understanding (As of 2026-02-14)

### Product Surface Today
Current app is a tool-centric UI, not yet hierarchy-centric.

Primary routes in the app:
- `Home`
- `New Thought`
- `Todos`
- `Insights`
- `Excalidraw++` tools (`Format for Excalidraw`, `PDF to Markdown`, `Transcript Cleaner`)

### Runtime Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind (`frontend/`)
- **Backend (web mode)**: FastAPI + Python (`backend/`) — being phased out for core features
- **Desktop mode**: Electron + Capacitor bridge (`frontend/electron/`)
- **Storage**: Markdown files with YAML frontmatter in the vault (source of truth)
- **Cache**: IndexedDB via Dexie.js (in-browser fast access layer, rebuildable)

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
- Create thought files with optional title/date header/emotions
- Create and toggle todos
- Scan vault sections and render month-level activity for thoughts/todos/files
- Open markdown files in a read-only sheet viewer
- Run utility transforms (excalidraw formatting, transcript cleanup, pdf conversion)

### Current Gaps (Important)
- No thought edit button / edit-save flow in thoughts calendar cards
- Thoughts scanner is file/date-oriented only, not semantic hierarchy-oriented
- No first-class `Program/Epic/Idea` model yet (YAML frontmatter schema defined but not implemented)
- No YAML frontmatter parsing/writing primitives yet
- No IndexedDB cache layer yet
- No hierarchy tree view UI yet
- No unified text action layer (`Summarize`, `Cleanup`, `Related`) across all inputs
- No extension runtime for in-app feature generation yet
- No dedicated automated test coverage in app code (only test dependency scaffolding exists)

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
3. **Hierarchy**: Metadata-driven via YAML `parent`/`children` fields. Folders are arbitrary/pragmatic (user's choice).
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
- FastAPI adapter environment controls:
  - `LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED=true`
  - `LTM_CAPABILITY_BEARER_TOKEN=<token>` (optional)
  - `LTM_CAPABILITY_RATE_LIMIT_PER_MINUTE=<int>`
  - `LTM_CAPABILITY_MAX_PAYLOAD_BYTES=<int>`

Important constraint:
- Python backend does **not** implement duplicate YAML hierarchy services.
- Backend only proxies requests to the frontend capability runner.

Quick curl example:
```bash
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
- **Hierarchy lives in metadata** (`parent`, `children`, `type`, `level` fields), not folder structure
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
Folders are convenience groupings only. The app never enforces or relies on folder structure. Hierarchy is derived from YAML `parent`/`children` fields.

## Implementation Plan (Execution Phases)

### Phase 0: Architecture Alignment (EPIC-0) — DONE (prior) + UPDATE
Scope:
- Record architecture decisions and guardrails
- Define YAML frontmatter schema and IndexedDB cache strategy
- Remove SQLite plan, commit to YAML + IndexedDB
- Install dependencies (`js-yaml`, `dexie`, `uuid`)

Exit criteria:
- All docs reference YAML architecture, not SQLite
- ADR-004 documented and linked from README
- Dependencies installed

### Phase 1: YAML Note Block
Scope:
- Create `yamlNoteBlock.ts` — parse, stringify, validate, generate key from title
- Update `NewThoughtOrch` to create YAML frontmatter notes
- Backward compatibility with existing plain thoughts

Exit criteria:
- New thoughts created as YAML frontmatter `.md` files
- Parse/stringify roundtrip works correctly

### Phase 2: IndexedDB Cache Layer
Scope:
- Create `dbBlock.ts` — Dexie.js schema, upsert, query, search
- Create `vaultSyncOrch.ts` — scan vault, populate IndexedDB
- Incremental sync on file changes

Exit criteria:
- IndexedDB populates on vault open
- Hierarchy queries work from IndexedDB

### Phase 3: Hierarchy UI (ThinkingOrganizer)
Scope:
- Create `TreeViewBlock.tsx` — recursive tree, collapsible, drag-drop
- Update `ThinkingOrganizerOrch` — tree view from IndexedDB
- Reparent updates YAML files + IndexedDB

Exit criteria:
- Tree view shows full hierarchy
- Drag-drop reparenting works end-to-end

### Phase 4: Thought Edit Flow
Scope:
- Create `ThoughtEditorOrch.tsx` — open, edit, save thoughts
- YAML frontmatter + body editing
- Conflict detection (existing mtime/hash mechanism)

Exit criteria:
- Click thought in tree -> opens editor
- Edit + save works without data loss

### Phase 5: AI Actions
Scope:
- Create `aiBlock.ts` — related thoughts (lexical), summarize, cleanup
- Related thoughts sidebar in editor
- Local AI via Ollama (Electron) / WASM (web)

Exit criteria:
- Related thoughts surfaced while editing
- Summarize/cleanup actions work

### Phase 6: Migration + Polish
Scope:
- One-time migration script for old thoughts -> YAML frontmatter
- Remove obsolete SQLite code (backend hierarchy services, electron sqlite)
- Error handling, loading states, offline mode

Exit criteria:
- All old thoughts migrated to YAML
- App works without backend in Electron
- Clean codebase with no dead SQLite code

### EPIC-3: Local-Only Extension Platform (unchanged)
Scope:
- Extension manifest + permission scopes + lifecycle hooks
- UI extension points + command registration
- In-app feature builder scaffold

Exit criteria:
- User can generate and enable a local extension safely inside app

### EPIC-5: AI Actions Everywhere (unchanged)
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
- `v0.2`: Phase 1-2 (YAML notes + IndexedDB cache)
- `v0.3`: Phase 3-4 (hierarchy UI + edit flow)
- `v0.4`: Phase 5 (AI actions)
- `v0.5`: EPIC-3 (extension platform)

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
  - **Mitigation**: explicit permission model + local-only policy + restricted capability surface
- **Risk**: Context bloat for multi-agent work
  - **Mitigation**: dedicated `agents/` operational docs and strict handoff structure

## Multi-Agent Collaboration Infrastructure
Use the `agents/` folder to avoid repeated full-repo rereads across Codex/Claude sessions.

- `AGENTS.md`
  - Top-level implementation contract (must-read before coding)
- `agents/UNDERSTANDINGS.md`
  - Stable architecture/context summary + critical file map
- `agents/TODO.md`
  - Active queue and next actions
- `agents/DONE.md`
  - Completed work log and decisions landed
- `agents/HANDOFFS.md`
  - Current handoffs between agents/sessions
- `agents/TEMPLATES/HANDOFF_TEMPLATE.md`
  - Required handoff format
- `agents/README.md`
  - Operating protocol for multi-agent execution

Workflow:
1. Read `AGENTS.md`
2. Read `README.md`
3. Read `agents/README.md`
4. Read `agents/UNDERSTANDINGS.md`
5. Pick top `READY` item from `agents/TODO.md`
6. Execute and update `agents/DONE.md`
7. Write handoff in `agents/HANDOFFS.md`

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
