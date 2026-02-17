# ltm-pilot

Local-first thinking workspace for structured human + AI collaboration.

## Product
`ltm-pilot` is one product with three inseparable roles:
- Thinking space for individuals (`Programs -> Epics -> Ideas -> Thoughts`)
- Place where humans and AI work together in-context
- Agent-management space for humans (tasks, runs, handoffs, decisions)

## Current Status (As of 2026-02-17)
Core architecture and organizer workflows are implemented and in active use.

Completed:
- YAML frontmatter + Markdown as source of truth (`parent`-driven hierarchy)
- IndexedDB cache sync/rebuild flow from vault content
- Thinking Organizer hierarchy UI with nested create/update/move flows
- Jira-style ticketing pattern in titles (project/program/type/random)
- Project-aware organizer storage under `thinking-organizer/*`
- Node metadata support (description, comments, record kinds, governance fields)
- Capability contract + router for agent-safe read/write operations
- Capability audit logging + policy checks + dry-run support (where implemented)
- Capability discovery UI + feature flags + FastAPI adapter wiring
- Integrity checks + explicit sync controls + derived status policy for epics/tasks
- Parent-only hierarchy refactor (legacy `children`/`child_type` removed)
- Agent workspace migration under vault-native organizer structure
- Removal of legacy `agents/*.md` operational snapshots in favor of tool-native records

## Architecture (Locked)
1. Electron-first runtime for near-term milestones.
2. YAML frontmatter in Markdown files is source of truth.
3. IndexedDB (Dexie) is rebuildable cache, never source of truth.
4. Core hierarchy/editing/AI flows do not require backend.
5. No SQLite/native DB for organizer model.
6. Hierarchy is metadata-driven via YAML `parent` (not folders).
7. Local-first and privacy-first behavior is mandatory.

Detailed schema and ADRs:
- `docs/ADR-004-YAML-Architecture.md`
- `docs/ADR-005-Agent-Capabilities.md`
- `docs/ADR-006-Agent-Workspace-Schema.md`

## Agent-Native Capability Layer
Primary implementation:
- Registry: `frontend/src/services/lego_blocks/capabilityRegistryBlock.ts`
- Router: `frontend/src/services/orchestrators/capabilityRouterOrch.ts`
- Runner: `frontend/scripts/agent/capabilityRunner.ts`

FastAPI adapter (optional transport only):
- `GET /api/capabilities`
- `POST /api/capabilities/invoke`

Important rules:
1. Agent calls must use `actor.kind: "agent"`.
2. If agent capabilities are disabled, stop and ask user before proceeding.
3. For out-of-sandbox vault paths (for example iCloud), writes require escalated permissions.
4. `handoff.create` requires non-empty summary and persists it as YAML `description`.

Runner pattern (recommended):
```bash
cd frontend && LTM_AGENT_CAPABILITIES_ENABLED=1 LTM_CAPABILITY_RUNNER_CLI=1 npx vite-node scripts/agent/capabilityRunner.ts list
```

```bash
cat <<'EOF2' | (cd frontend && LTM_AGENT_CAPABILITIES_ENABLED=1 LTM_CAPABILITY_RUNNER_CLI=1 npx vite-node scripts/agent/capabilityRunner.ts invoke)
{
  "vaultRoot": "/absolute/path/to/vault",
  "request": {
    "capability": "organizer.nodes.list_roots",
    "input": {"typeFilter": "program"},
    "actor": {"kind": "agent", "id": "codex"}
  }
}
EOF2
```

## Agent Workspace (Source of Truth)
Active operations run in organizer workspace nodes, not repo-local markdown logs.

Workspace location:
- `coding-projects/thinking-space/thinking-organizer/*`

Recommended programs:
- `development (agent operations)`
- `handoffs (agent operations)`
- `principles and decisions (agent operations)`

Required operating pattern:
1. Sync vault/cache before operational changes.
2. Claim/update tasks in-tool (`task.claim`, `task.update_status` or UI equivalent).
3. Every created operation node must include meaningful YAML `description`.
4. Every execution plan must be recorded in-tool before coding starts.
5. End sessions with run/handoff records in-tool.

## Repo Structure
- `frontend/`: React + TypeScript + Vite + Electron desktop integration
- `backend/`: optional FastAPI transport and tool adapters
- `docs/`: ADRs, rollout matrix, and operational checklists
- `agents/TEMPLATES/`: orchestrator/handoff/commit templates

## Frontend Design Contract
- Reusable UI primitives: `frontend/src/components/lego_blocks/*` (`*Block`)
- Page/feature orchestrators: `frontend/src/components/orchestrators/*` (`*Orch`)
- Reusable service primitives: `frontend/src/services/lego_blocks/*` (`*Block`)
- Workflow services: `frontend/src/services/orchestrators/*` (`*Orch`)

## Local Development

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Electron:
```bash
cd frontend
npm run electron:dev
```

Backend (optional):
```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

## Operational References
- `AGENTS.md`
- `CLAUDE.md`
- `agents/README.md`
- `docs/OPS_REPO_SYNC_CHECKLIST.md`
- `docs/CAPABILITY_ROLLOUT_MATRIX.md`

## Phase History (Updated)
This repo has progressed through the originally planned architecture phases.

Delivered:
- Phase 0: Architecture alignment and dependency baseline
- Phase 1: YAML note primitives
- Phase 2: IndexedDB cache + vault sync
- Phase 3: Hierarchy organizer UI
- Phase 4: Metadata edit flow and detail panel improvements
- Phase 5: Capability-based AI/agent operation surface integration
- Phase 6: Migration/polish including parent-only hierarchy and legacy ops cleanup

Active expansion:
- Capability parity hardening across all surfaces
- Operational controls hardening and adapter parity testing
