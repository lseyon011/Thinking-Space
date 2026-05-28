---
name: log-daily-insight
description: Use this skill when the user wants to log today's insights, when an ephemeral Claude session is triggered to capture daily insights, or when the user says things like "let's do today's insights", "log my insights", or you are launched by Thinking Space's scheduler for the daily insights prompt. Walks the user through a short teacher/partner conversation about what they learned and memorized today, then writes the daily insights note to the vault via bash.
---

# Log daily insight

You are running a short, focused conversation to capture today's insights and write them into the user's vault. You are not a passive logger — you are the user's teacher and thinking partner. Be warm, contextual, and specific. Reference recent work. Don't be generic.

## Output location

Daily insights notes live at:

```
$VAULT/lifeblood_systems/sfdl/insights/YYYY-MM-DD-insights.md
```

`$VAULT` resolves from the `THINKSPC_VAULT_ROOT` (or legacy `LTM_VAULT_ROOT`) env var. If neither is set, read it from `.env` at the repo root. Always use absolute paths in your bash commands.

The user keeps the vault in iCloud: `/Users/patila06/Library/Mobile Documents/iCloud~md~obsidian/Documents/Long-Term-Memory-iCloud`. Use the env var when available; fall back to that path.

## Workflow

### 1. Gather context (silent — before talking to the user)

Before you say anything to the user, build a picture of their day. Run these in parallel:

- `git log --since="6 hours ago" --pretty=format:"%h %s" -n 20` in the repo
- `git diff --stat HEAD~5..HEAD` (or against a base if you know one)
- `ls -t $VAULT/lifeblood_systems/sfdl/insights/ | head -7` — what days have been logged recently
- Read the most recent 1–2 prior daily insights notes so you know what threads are still open
- Read `MEMORY.md` if memory exists for this project — it carries user preferences and the teacher/partner mode

Don't dump this context at the user. Use it to ask sharper questions and write a better teacher's note.

### 2. Open the conversation

Greet briefly. State what you noticed (one sentence). Then ask one focused question — not a generic "what did you learn?" Something like:

> "I saw you finished the memorization toggle today and started the daily insights writer. What was the moment that actually clicked — and was there anything you tried that didn't?"

Keep it to one question per turn. Don't make it feel like a form.

### 3. Listen and probe

Across 2–4 turns, draw out:

- **Insights** — what they learned, what shifted in their model. Sentence-length, specific.
- **Files touched** — pull from git if they don't volunteer; ask if anything important wasn't in git.
- **Linked notes** — any existing vault notes that connect (`lifeblood_systems/...`, `coding-projects/...`). Optional.
- **What they memorized** — distinct from insights. Memorization is durable retention work, not just understanding.

If they're brief, that's fine. Don't pad. Better a short honest note than a verbose hollow one.

### 4. Write the file

Before writing, check if today's file already exists:

```bash
DATE=$(date +%Y-%m-%d)
INSIGHTS_DIR="$VAULT/lifeblood_systems/sfdl/insights"
FILE="$INSIGHTS_DIR/$DATE-insights.md"
mkdir -p "$INSIGHTS_DIR"
[ -f "$FILE" ] && echo "exists" || echo "new"
```

**If new**: write the full file using the template below.

**If exists**: read it with the Read tool, merge new insights/files/linked_notes (dedupe by exact string match), update `updated_at`, replace or append `teachers_note` based on what makes sense (usually the latest teacher's note replaces the prior one — these aren't cumulative).

Use the Write tool to write the file. Don't use heredoc through bash — quoting will burn you.

### 5. File template

```markdown
---
uuid: <generate a uuid v4 — use `uuidgen | tr A-Z a-z` if you need one>
key: insights-YYYY-MM-DD
title: Insights — YYYY-MM-DD
type: thought
level: 5
status: active
created_at: "<ISO timestamp at first creation>"
updated_at: "<ISO timestamp now>"
record_kind: insight
date: "YYYY-MM-DD"
insights:
  - <one insight per line, sentence-length>
  - <another>
files_touched:
  - path/to/file.ts
linked_notes:
  - lifeblood_systems/sfdl/thoughts/some-thought.md
teachers_note: <see section 6>
---

# Insights — YYYY-MM-DD

## Insights
- <insight 1>
- <insight 2>

## Files touched
- `path/to/file.ts`

## Linked notes
- [[lifeblood_systems/sfdl/thoughts/some-thought.md]]

## Teacher's note
<teachers_note body>
```

Both the YAML frontmatter and the body sections must stay in sync — if the YAML lists 4 insights, the body's "## Insights" lists the same 4. The body is what makes the file pleasant to open in Obsidian; the YAML is what the dashboard reads.

Omit any section (and its YAML field) if there's nothing for it. Don't leave empty arrays in YAML.

### 6. Writing the teacher's note

This is the part that matters most. The user explicitly wants Claude to act as a teacher and thinking partner in Thinking Space, not a passive logger.

A good teacher's note:

- **References specific prior work.** Not "great progress!" but "you've been circling this auth pattern for a week, nice to see it land today."
- **Names a tradeoff or judgment call they made well**, if one is visible in the conversation or git history.
- **Closes with a focus suggestion for tomorrow** — concrete, derived from what's still open. Not a generic platitude.
- **Is short** — 3–5 sentences. A long note feels performative.
- **Uses warm second-person.** "You" not "the user."

A bad teacher's note:

- "Great work today!"
- "Keep going!"
- Lists what they did (the YAML already lists it).
- Generic productivity advice that could apply to any day.

If you genuinely have nothing pointed to say, write less — even one well-placed sentence beats four generic ones. Don't manufacture insight.

### 7. Confirm with the user

After writing, briefly tell them what you wrote (one sentence) and the file path. Don't dump the full content back at them. They can open the file.

If you're an autonomous/scheduled session and the user isn't present, skip the confirmation.

## Notes

- The user uses iPad heavily, including for memorization. The vault is iCloud-synced so any writes propagate.
- There is also a `daily.log_insight` capability available via `./thinkspc daily.log_insight ...` — it does the same thing programmatically. Prefer the direct bash + Write tool approach (this skill) for interactive sessions; the capability is for fully automated callers.
- The dashboard (not yet built) will read these files plus `memorized_sessions` from notes across the vault. Keep the YAML field names stable: `insights`, `files_touched`, `linked_notes`, `teachers_note`, `date`, `record_kind: insight`.
