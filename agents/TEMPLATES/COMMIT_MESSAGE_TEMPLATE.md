# Commit Message Template

Use this for all commits.

## Rules
- Keep subject specific and scoped.
- Do not use vague subjects like `fix`, `update`, `wip`.
- First body section must copy the exact completed-work summary already produced by the agent.
- Additional details are optional and go after the copied summary.

## Format
```text
<type>(<scope>): <intent-oriented summary>

Completed work summary (copied exactly):
- <bullet from agent completion summary>
- <bullet from agent completion summary>

Additional details:
- Tests/validation run: <commands>
- Key implementation notes: <important detail>
- Follow-ups: <optional>
```
