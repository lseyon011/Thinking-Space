# Multi-Agent Ops (Codex + Claude)

Purpose: enable parallel agents to execute without repeatedly re-reading the whole codebase.

## Files to Use
- `AGENTS.md`: non-negotiable product/architecture contract for all implementation work
- `CLAUDE.md`: Claude-native project file (must stay consistent with `AGENTS.md`)
- `README.md`: roadmap and epic order source of truth
- `agents/UNDERSTANDINGS.md`: stable architecture, decisions, key file map
- `agents/TODO.md`: active queue and priorities
- `agents/DONE.md`: completed items and landed decisions
- `agents/HANDOFFS.md`: cross-agent session handoffs
- `agents/TEMPLATES/HANDOFF_TEMPLATE.md`: required handoff format
- `agents/TEMPLATES/ORCHESTRATOR_TEMPLATE.md`: required structure for new major orchestrator files
- `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md`: required commit message structure

## Startup Sequence (Every New Agent)
1. Read `AGENTS.md`
2. If using Claude, read `CLAUDE.md`
3. Read `README.md`
4. Read `agents/UNDERSTANDINGS.md`
5. Read top of `agents/TODO.md`
6. Check latest entry in `agents/HANDOFFS.md`
7. Claim one `READY` task by switching it to `IN_PROGRESS`

## Status Vocabulary
- `READY`: unclaimed, clear to execute
- `IN_PROGRESS`: currently owned by one agent
- `BLOCKED`: waiting on decision or dependency
- `DONE`: completed and logged in `agents/DONE.md`

## Ownership Rules
- One task, one owner at a time.
- Update `TODO` at task start and end.
- Log all completed work in `DONE` with date and artifacts.
- Add a handoff entry before ending session if work is incomplete.

## Token Efficiency Rules
- Do not re-scan full repo unless required by task.
- Use `UNDERSTANDINGS` file map first.
- Read only files relevant to the claimed task.
- Add new discoveries once to `UNDERSTANDINGS`, then reference there.

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
- Commit body must include the exact completed-work summary from the agent output as the first section.
- Then add any extra technical details (tests, migration notes, follow-ups) below the copied summary.
- Use `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md`.
