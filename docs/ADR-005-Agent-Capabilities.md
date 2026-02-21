# ADR-005: Agent Capability Contract and Transport

Status: Accepted  
Date: 2026-02-17

## Context

The product needs agent-native read/write access to thinking-organizer operations without duplicating domain logic in multiple runtimes.

Current architecture constraints:
- YAML frontmatter + markdown files are source of truth.
- IndexedDB is a rebuildable cache.
- Core capability/domain logic should remain frontend-first.
- Backend transport may exist but must stay optional and thin.

## Decision

Define a single capability contract executed by frontend TypeScript and exposed through adapters.

Core contract:
- Invocation envelope:
  - `capability`
  - `input`
  - `actor`
  - `requestId`
  - `dryRun`
- Response envelope:
  - `ok`
  - `capability`
  - `requestId`
  - `actor`
  - `dryRun`
  - `auditId`
  - `warnings`
  - `data` (on success)
  - `error` (on failure)

Capability naming:
- `organizer.nodes.*` for collection/list/search operations.
- `organizer.node.*` for single-node CRUD/read operations.

Execution source of truth:
- `frontend/src/services/lego_blocks/capabilityRegistryBlock.ts`
- `frontend/src/services/orchestrators/capabilityRouterOrch.ts`

Audit + safety requirements:
- Every invocation attempts to write audit entry under `.think-space/audit/capability-audit.log`.
- Policy checks run before execution (payload size + optional node-type/project-root restrictions + agent write controls).
- Destructive dry-run support is required for:
  - `organizer.node.move`
  - `organizer.node.delete`

Transport adapters:
- Frontend runner (Node): `frontend/scripts/agent/capabilityRunner.ts`
- FastAPI thin proxy:
  - `GET /api/capabilities`
  - `POST /api/capabilities/invoke`
- Backend transport must not implement duplicate YAML hierarchy/domain services.

Operational tool usage pattern:
1. Sync first (`Sync Vault Now` / sync capability path) before reads or writes.
2. Execute active task lifecycle in the organizer tool/capability layer.
3. Created operation records must include meaningful YAML `description`.
4. Plans must be recorded in the organizer tool before implementation starts.
5. Session outcomes must be written back as run/handoff records.
6. Agent calls must use `actor.kind: "agent"`; do not switch to `human` to bypass feature flags.
7. If `agent_capabilities_enabled` is disabled, stop and ask user before proceeding.
8. External vault paths outside repo sandbox (for example iCloud) require escalated filesystem permission for writes.

## Runner API Pattern (CLI)

Use the `./thinkspc` wrapper from the repo root. It auto-loads `.env` (for `THINKSPC_VAULT_ROOT` or legacy `LTM_VAULT_ROOT`), sets runner flags, and defaults actor to `{kind: "agent", id: "claude-code"}`.
Legacy alias: `./ltm` forwards to `./thinkspc`.

```bash
# List capabilities
./thinkspc list

# Invoke with --flag syntax
./thinkspc organizer.nodes.list_roots --typeFilter program
./thinkspc organizer.node.get --uuid "abc-123"
./thinkspc organizer.node.create --type task --title "My task" --parentKey "epic-key" --extra-record_kind task
./thinkspc task.claim --uuid "abc-123" --owner claude-code

# Raw JSON escape hatch (reads stdin, for complex payloads)
./thinkspc invoke < payload.json
```

Setup: `.env` at repo root should have `THINKSPC_VAULT_ROOT=/path/to/your/vault` (or legacy `LTM_VAULT_ROOT`).

## Consequences

Positive:
- One capability contract across UI and agent entrypoints.
- Avoids frontend/backend divergence for hierarchy semantics.
- Enables curl/automation access while preserving local-first model.

Tradeoffs:
- Capability runner bootstraps frontend runtime modules in node context.
- Audit logging is best-effort; failures do not block capability execution.

## Rollout

Phase 1:
- Contract + registry/router + organizer migration + FastAPI proxy.

Phase 2:
- Expand dry-run coverage and stricter policy defaults.
- Add adapter parity fixtures and broader surface migration (thoughts/todos/tools).
