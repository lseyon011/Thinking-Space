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
- organizer principles/decision records in `coding-projects/thinking-space/thinking-organizer/*`

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

Current status:
- Phase 0–4: DONE (architecture, YAML, IndexedDB, hierarchy UI, thought edit)
- Phase 1–2 hardening: IN PROGRESS (DEV-008)
- Phase 3 drag-drop: IN PROGRESS (DEV-009)
- Agent Capability Transport: DONE (DEV-012/013/014)

Next up:
- Phase 5: AI Actions (related, summarize, cleanup)
- Phase 6: Migration + Polish (remove SQLite code, migrate old thoughts)
- EPIC-3: Local-Only Extension Platform
- EPIC-5: AI Actions Everywhere
- EPIC-6: Optional Remote/Agent Backends (later)

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

## Key Service Blocks
- `frontend/src/services/lego_blocks/yamlNoteBlock.ts` — YAML frontmatter parse/stringify/validate/key generation
- `frontend/src/services/lego_blocks/dbBlock.ts` — Dexie.js IndexedDB cache layer
- `frontend/src/services/orchestrators/vaultSyncOrch.ts` — vault scan to IndexedDB sync
- `frontend/src/services/lego_blocks/capabilityRegistryBlock.ts` — capability registry with typed I/O contracts
- `frontend/src/services/orchestrators/capabilityRouterOrch.ts` — capability router with policy/audit/dry-run
- `frontend/src/services/lego_blocks/aiBlock.ts` — local AI action primitives (TO BE CREATED)

## Startup Sequence (Claude Sessions)
1. `CLAUDE.md` is auto-loaded — contains architecture, contracts, and locked decisions.
2. Check active tasks: `./ltm organizer.nodes.search --query "status active" --limit 10`
3. Read additional docs only when the task requires it:
   - `README.md` — for phase order or product direction questions
   - `docs/ADR-005-Agent-Capabilities.md` — when modifying the capability system
   - `docs/ADR-006-Agent-Workspace-Schema.md` — when modifying workspace schema fields
   - `agents/README.md` — for multi-agent handoff protocol

## Multi-Agent Discipline
- Use organizer tool as source of truth for active operations (tasks, plans, handoffs).
- Every created operation node must include a substantive YAML `description`.
- Record implementation plans in the organizer tool for non-trivial tasks (estimated >5 minutes of work). Quick fixes and small changes don't need a plan node.
- Run logging (`run.log`) is optional — use it for significant multi-step sessions, not every interaction.
- All agent capability calls must use `actor.kind: "agent"`; never switch to `human` to bypass flag/policy checks.
- If `agent_capabilities_enabled` is off and a call fails with that error, pause and ask the user before continuing.
- For external vault writes (such as iCloud paths outside repo sandbox), request escalated permissions first.
- Follow workspace usage pattern:
  - `development (agent operations)` for active task/plan work.
  - `handoffs (agent operations)` for handoff records.
  - `principles and decisions (agent operations)` for durable guidance.
- Keep docs synchronized when strategy or architecture shifts.
- Use detailed commit messages that capture scope + intent + key changes; do not use generic commit titles.
- Commit body must be the final task output copied verbatim from the agent response (no paraphrase, truncation, or reformatting).
- Follow `agents/TEMPLATES/COMMIT_MESSAGE_TEMPLATE.md`.

## Capability Runner Pattern
Use the `./ltm` wrapper from the repo root. It auto-loads `.env` (for `LTM_VAULT_ROOT`), sets runner flags, and defaults to `actor: {kind: "agent", id: "claude-code"}`.

### Required fields for node creation (easy to forget, causes bugs):
- `--projectRoot coding-projects/thinking-space` — without it, nodes land at vault root and won't appear in organizer UI
- `--description "..."` — mandatory for every created node per multi-agent discipline
- `--parentKey "..."` — required to place nodes in the correct hierarchy (e.g., `handoffs-agent-operations`, `task-backlog`)
- `--extra-record_kind <kind>` — for typed records: `task`, `run`, `handoff`, `decision`, `principle`, `note`

```bash
# Read operations
./ltm list
./ltm organizer.nodes.list_roots --typeFilter program
./ltm organizer.nodes.list_children --parentKey "epic-auth"
./ltm organizer.nodes.search --query "auth bug" --limit 10
./ltm organizer.node.get --uuid "abc-123"

# Create node (all required fields shown)
./ltm organizer.node.create --type task --title "Fix login" \
  --parentKey "task-backlog" \
  --projectRoot coding-projects/thinking-space \
  --description "Login form crashes on submit due to missing validation" \
  --extra-record_kind task

# Other write operations
./ltm organizer.node.update --uuid "abc-123" --status active --priority high
./ltm task.claim --uuid "abc-123" --owner claude-code
./ltm task.update_status --uuid "abc-123" --taskStatus done
./ltm run.log --title "Session log" --projectRoot coding-projects/thinking-space --agentName claude-code --result success
./ltm handoff.create --title "Handoff" --projectRoot coding-projects/thinking-space \
  --summary "Notes" --fromAgent claude-code --toAgent human \
  --parentKey handoffs-agent-operations
./ltm comment.add --uuid "abc-123" --text "Done" --addedBy claude-code

# Raw JSON escape hatch (reads stdin, for complex payloads)
./ltm invoke < payload.json
```

Setup: ensure `.env` at repo root has `LTM_VAULT_ROOT=/path/to/your/vault`.

## Scope Boundary
These instructions apply to `ltm-pilot` only.
