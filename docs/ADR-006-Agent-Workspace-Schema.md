# ADR-006: Agent Workspace Schema and Capability Operations

Status: Accepted  
Date: 2026-02-17

## Context

Active agent operations run in a vault-native workspace under:

`coding-projects/thinking-space/thinking-organizer/*`

Constraints:
- Keep existing `type` enum unchanged for compatibility:
  - `program | epic | idea_bucket | idea | thought_bucket | thought`
- Keep YAML frontmatter as source of truth.
- Keep all agent writes routed through the capability router so audit logs and policy checks apply.

## Decision

Define an agent extension schema on top of existing YAML frontmatter and standardize capability operations for task/run/handoff workflows.

### 1) Record Kind Contract

`record_kind` is required for agent-operation records and must be one of:
- `task`
- `run`
- `handoff`
- `decision`
- `principle`
- `note`

`schema_version` is required for agent-operation records and currently uses:
- `schema_version: "2"`

### 2) Extended YAML Fields

Task fields:
- `task_id`
- `task_status`
- `depends_on`
- `blocked_by`
- `acceptance_criteria`
- `owner`

Run fields:
- `run_id`
- `session_id`
- `agent_name`
- `model`
- `started_at`
- `ended_at`
- `result`

Traceability fields:
- `source_repo`
- `branch`
- `commit`
- `artifacts`
- `related_nodes`

Governance fields:
- `schema_version`
- `record_kind`
- `state_history`

### 3) Capability Operations

Add and use these capabilities:
- `task.claim`
- `task.update_status`
- `run.log`
- `handoff.create`
- `comment.add`

All write capabilities must:
- pass through `capabilityRouterOrch`
- be audit logged in `.ltm-pilot/audit/capability-audit.log` (legacy path retained for compatibility)
- pass capability policy checks

### 3.1) Tool Usage Pattern (Mandatory)

Active operations must be run in:
- `coding-projects/thinking-space/thinking-organizer/*`

Required behavior:
1. Sync cache/vault before operational updates.
2. Record task lifecycle in-tool (`task.claim`, `task.update_status`, equivalent UI actions).
3. Any created operation record must include meaningful YAML `description`.
4. Any implementation plan must be recorded as a plan node in-tool before execution.
5. Run/handoff artifacts must be logged in-tool before session close.

Recommended workspace grouping:
- `development (agent operations)` for active execution.
- `handoffs (agent operations)` for transfer records.
- `principles and decisions (agent operations)` for durable guidance.

### 4) Cache Queryability Strategy

IndexedDB stores:
- typed orchestration fields (`taskStatus`, `owner`, `runId`, `recordKind`, etc.)
- generic metadata blob (`metadata`)
- metadata query/search helpers (`metadataKeys`, `metadataText`)

This preserves forward compatibility when new YAML fields are added.

## Consequences

Positive:
- Agent workflows are first-class and queryable.
- Existing hierarchy compatibility is preserved.
- New metadata can evolve without DB schema churn for every field.

Tradeoff:
- Some governance is runtime validated (policy/router) rather than fully static.
