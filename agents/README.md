# Multi-Agent Ops (Codex + Claude)

Purpose: enable parallel agents to execute without repeatedly re-reading the whole codebase.

## Files to Use
- `AGENTS.md`: non-negotiable product/architecture contract for all implementation work
- `CLAUDE.md`: Claude-native project file (must stay consistent with `AGENTS.md`)
- `README.md`: roadmap and epic order source of truth
- `docs/ADR-005-Agent-Capabilities.md`: capability contract and operational controls
- `docs/ADR-006-Agent-Workspace-Schema.md`: organizer workspace schema + operation fields
- `agents/TEMPLATES/HANDOFF_TEMPLATE.md`: required handoff format
- `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`: required structure for new major orchestrator files
- `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md`: required commit message structure

Active operations source of truth:
- `coding-projects/thinking-space/thinking-organizer/*`

## Startup Sequence (Every New Agent)
1. Read `AGENTS.md`
2. If using Claude, read `CLAUDE.md`
3. Read `README.md`
4. Read `docs/ADR-005-Agent-Capabilities.md`
5. Read `docs/ADR-006-Agent-Workspace-Schema.md`
6. Open active tasks/plans in organizer workspace
7. Sync organizer cache (`Sync Vault Now`) and claim one task in-tool

## Mandatory Tool Pattern
1. Run active task lifecycle only in organizer workspace.
2. Every created operation node must include a meaningful YAML `description`.
3. Every execution plan must be recorded in the organizer tool before coding starts.
4. Update task/run/handoff state in-tool first.
5. Use `actor.kind: "agent"` for agent capability calls. Never switch to `human` to bypass controls.
6. If call fails with `Agent capabilities are disabled by feature flag.`, pause and ask user to enable it.
7. If vault path is outside sandbox (for example iCloud), request escalated permissions before writes.

Workspace layout pattern:
- `development (agent operations)` program for active implementation tasks/plans/runs.
- `handoffs (agent operations)` program for transfer notes.
- `principles and decisions (agent operations)` program for durable guidance.

## Capability API Pattern (Avoid Runner Pitfalls)
Use the runner in explicit CLI mode:

```bash
cd frontend && LTM_AGENT_CAPABILITIES_ENABLED=1 LTM_CAPABILITY_RUNNER_CLI=1 npx vite-node scripts/agent/capabilityRunner.ts list
```

```bash
cat <<'EOF' | (cd frontend && LTM_AGENT_CAPABILITIES_ENABLED=1 LTM_CAPABILITY_RUNNER_CLI=1 npx vite-node scripts/agent/capabilityRunner.ts invoke)
{
  "vaultRoot": "/absolute/path/to/vault",
  "request": {
    "capability": "organizer.node.get_by_key",
    "input": {"key": "development-agent-operations"},
    "actor": {"kind": "agent", "id": "codex"}
  }
}
EOF
```

## Status Vocabulary
- `READY`: unclaimed, clear to execute
- `IN_PROGRESS`: currently owned by one agent
- `BLOCKED`: waiting on decision or dependency
- `DONE`: completed in organizer task/run records

## Ownership Rules
- One task, one owner at a time.
- Update task status in organizer records at task start and end.
- Log completed work in organizer run/task notes with date and artifacts.
- Add a handoff record in organizer workspace before ending session if work is incomplete.

## Token Efficiency Rules
- Do not re-scan full repo unless required by task.
- Use organizer principles/decisions nodes plus ADR docs first.
- Read only files relevant to the claimed task.
- Add durable discoveries to organizer principles/decisions nodes, then reference there.

## Quality Rules
- No silent scope changes.
- Include acceptance criteria in each task.
- Record commands/tests run in handoff entries.
- If blocked, document blocker and exact next unblock step.
- For each major task, state pillar impact (Thinking space / Human+AI / Agent management).
- Default code pattern: lego-block primitives composed by orchestrators.
- New major screen orchestrators should follow `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`.
- Frontend placement rules are mandatory:
- Reusable primitives -> `frontend/src/components/lego_blocks/*` with `*Block` suffix.
- Flow containers -> `frontend/src/components/orchestrators/*` with `*Orch` suffix.
- Shared UI primitives -> `frontend/src/components/lego_blocks/ui/*`.
- Service placement rules are mandatory:
- Service primitives -> `frontend/src/services/lego_blocks/*` with `*Block` suffix.
- Service workflows -> `frontend/src/services/orchestrators/*` with `*Orch` suffix.
- UI should consume service workflows from `services/orchestrators` by default.
- Caution: orchestrators must stay thin. If orchestration files grow dense with reusable logic, extract to lego blocks/services/hooks.
- Git commits must use detailed messages describing scope, intent, and substantive changes.
- Commit body must be the exact final agent task output copied verbatim.
- Do not paraphrase, shorten, reorder, or restyle any part of that copied final output.
- Use `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md`.
