# Ops Repo Sync Checklist

Use this checklist when operating with:
- code repo: `Thinking-Space`
- vault ops repo: `coding-projects/thinking-space`

## Cadence

1. Start of session:
- Pull latest in both repos.
- Confirm target branch in both repos.
- Record the session start in a run/handoff note.
- Run organizer sync before task updates (`Sync Vault Now` / capability equivalent).

2. During implementation:
- Keep changes scoped (code repo vs ops repo).
- Do not mix unrelated changes across repos in one commit.
- Log major task transitions with capability calls (`task.claim`, `task.update_status`, `run.log`).
- Ensure every created operation node includes meaningful YAML `description`.
- Ensure implementation plans are recorded in-tool before coding starts.
- Use `actor.kind: "agent"` for agent operations (never fallback to `human` for bypass).
- If capability call fails because `agent_capabilities_enabled` is disabled, pause and ask user.
- If writing to iCloud/external vault path outside repo sandbox, request escalated permissions first.

3. End of session:
- Commit/push code repo first (if code changed).
- Commit/push ops repo second (task/run/handoff notes).
- Create a handoff note with references to both commit hashes.

## Conflict Handling

1. If ops repo conflicts:
- Rebase/pull first.
- Never force-push shared ops history.
- Append conflict resolution note in `state_history` of affected task/run/handoff nodes.

2. If code repo conflicts:
- Resolve conflicts in code repo first.
- Update linked ops notes with final commit hash and resolution summary.

## Safety Rules

1. Keep writable project roots allowlisted in capability policy.
2. Validate `record_kind` on all operation records.
3. Keep source traceability fields populated:
- `source_repo`
- `branch`
- `commit`
- `artifacts`
4. Use tool-native operations as source of truth for active work:
- `coding-projects/thinking-space/thinking-organizer/*`
