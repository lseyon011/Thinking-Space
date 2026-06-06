---
name: log-daily-insight
description: Use this skill any time the user wants to log an insight, learning, or realization. Triggers on phrases like "insight:", "I just had an insight", "I just realized", "log this insight", "log my insights", "let's do today's insights", "quick insight", "yesterday I realized", or when launched by Thinking Space's scheduler / the `thinkspc insight` command. Handles two modes — quick-capture (one-line confirm and exit) and reflective end-of-day (teacher/partner conversation). Reads the project list from `kai-workspace/projects.md` in the vault, then appends to the right project's daily insight file.
---

# Log daily insight

You capture insights into Anurag's vault, across multiple projects. You operate in two modes — pick the right one based on what the user said and how they invoked you.

## Two modes

### Quick-capture (default when the user dumps an insight)

Trigger signals:
- The user opened with the insight itself ("insight: ...", "I just realized...", "log this:..."), or
- You were launched by `thinkspc insight ...` (working dir under `/tmp/insight.*`), or
- The user wants you fast and out of the way.

Behavior:
- **No teacher/partner conversation.** Don't probe, don't congratulate, don't write a teacher's note.
- Parse the insight text, the project, and the date from natural language.
- Append to the right file (see "Where insights go" below).
- Confirm in one line. Exit.
- If genuinely ambiguous about project, ask exactly one short clarifying question, then continue. Date defaults to today; if the user says "yesterday", "Monday", "last Tuesday", parse it.

### Reflective end-of-day (longer flow)

Trigger signals:
- The user said "let's do today's insights" or similar reflective phrasing.
- You were launched by a scheduler agent for end-of-day reflection.
- The user is clearly inviting a conversation, not dumping a line.

Behavior:
- Be the teacher and thinking partner. Reference recent work, ask sharp questions, draw out what shifted in their model.
- Walk through 2–4 turns at most.
- Produce a fuller note with a teacher's note section.

The rest of this skill mostly describes the quick-capture path — it's the common case. Reflective mode reuses the same file format but with `teachers_note` populated.

## Where insights go

Universal convention, all projects:

```
$VAULT/<project_vault_path>/thoughts/insight-YYYY-MM-DD.md
```

`$VAULT` resolves from `THINKSPC_VAULT_ROOT` (or legacy `LTM_VAULT_ROOT`). If neither is set, fall back to `/Users/patila06/Library/Mobile Documents/iCloud~md~obsidian/Documents/Long-Term-Memory-iCloud`.

One file per (project, day). Multiple insights on the same day append into the same file. The `thoughts/` folder is created if it doesn't exist.

## Resolving the project

Read `$VAULT/kai-workspace/projects.md` first. That file is the source of truth for active projects and their vault paths.

Project resolution order:
1. **Explicit mention** in the user's text — "for sfdl", "this is about thinkingspace.ai", etc. Match against `name` and `aliases / topical hints` columns in `projects.md`.
2. **Topical inference** — if the insight is clearly about a domain (e.g. earnings-call workflow → F9), use that.
3. **Recent git activity** (only if you have shell access and the repo is reachable) — `git log --since="12 hours ago"` in the user's main repo.
4. **Ask one short question** if still ambiguous: "Which project — sfdl, thinkingspace.ai, or F9?"

If the user mentions a project that isn't in `projects.md`:
- Add a new row to the "Add new projects below" section of `projects.md` with a sensible `vault_path` (usually `lifeblood_systems/<name>/`).
- Then proceed with the insight write.

## Resolving the date

Default: today (local time).

Parse natural-language dates from the user's text:
- "yesterday" → today minus 1 day
- "Monday", "last Tuesday" → most recent occurrence of that weekday (going backward)
- Explicit "2026-06-04" or "June 4" → that date
- "last week" / "few days ago" — ask exactly which day rather than guessing

## Writing the file

### 1. Check if today's (or the resolved-date's) file exists

```bash
DATE=<resolved YYYY-MM-DD>
THOUGHTS_DIR="$VAULT/<project_vault_path>/thoughts"
FILE="$THOUGHTS_DIR/insight-$DATE.md"
mkdir -p "$THOUGHTS_DIR"
[ -f "$FILE" ] && echo "exists" || echo "new"
```

### 2. If new — write the full file using the template below.

### 3. If exists — read with the Read tool, then:
- Append the new insight to the `insights:` YAML array.
- Append the same bullet to the `## Insights` body section.
- Update `updated_at` to now (ISO timestamp).
- If quick-capture mode: do NOT touch `teachers_note`.
- If reflective mode: replace `teachers_note` with the latest one (these aren't cumulative).
- Merge `files_touched` and `linked_notes` if the user mentioned any (dedupe by exact string match).

Always use the Write tool to write the file. Don't heredoc through bash — quoting will burn you.

## File template

```markdown
---
uuid: <generate with `uuidgen | tr A-Z a-z`>
key: insight-<project_name_lowercase>-YYYY-MM-DD
title: Insight — <project name> — YYYY-MM-DD
type: thought
level: 5
status: active
created_at: "<ISO timestamp at first creation>"
updated_at: "<ISO timestamp now>"
record_kind: insight
project: <project_name>
date: "YYYY-MM-DD"
insights:
  - <one insight per line, sentence-length>
files_touched:
  - path/to/file.ts
linked_notes:
  - lifeblood_systems/sfdl/thoughts/some-thought.md
teachers_note: <only present in reflective mode>
---

# Insight — <project name> — YYYY-MM-DD

## Insights
- <insight 1>
- <insight 2>

## Files touched
- `path/to/file.ts`

## Linked notes
- [[lifeblood_systems/sfdl/thoughts/some-thought.md]]

## Teacher's note
<teachers_note body — only in reflective mode>
```

Body and YAML must stay in sync — if the YAML lists 4 insights, the body's `## Insights` section lists the same 4. Omit any section (and its YAML field) if there's nothing for it. Don't leave empty arrays in YAML.

## Quick-capture confirmation format

After writing, print exactly one line:

```
✓ appended to <project>/thoughts/insight-YYYY-MM-DD.md
```

Or if creating a new file:

```
✓ wrote <project>/thoughts/insight-YYYY-MM-DD.md
```

Then exit. No further chatter.

## Reflective-mode teacher's note

Only in reflective mode. The note matters more than the bullets.

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

## Notes

- The user uses iPad heavily. The vault is iCloud-synced so any writes propagate.
- Legacy: `sfdl` has an older `insights/` folder (`$VAULT/lifeblood_systems/sfdl/insights/YYYY-MM-DD-insights.md`) from before the universal convention. Don't write there anymore — use `sfdl/thoughts/insight-YYYY-MM-DD.md`. The old files stay as-is.
- There is also a `daily.log_insight` capability (`./thinkspc daily.log_insight ...`) — that's the older programmatic path. This skill is the interactive path and is the one `thinkspc insight` invokes.
- When invoked via `thinkspc insight`, your working dir is `/tmp/insight.*` — that's intentional incognito mode. No project files visible locally. Read/write everything through absolute paths to `$VAULT`.
