# Codebase Audits

## 2026-02-13 — Full Codebase Health Audit

**Auditor:** Kai (Claude Opus 4.6)
**Scope:** Full ltm-pilot codebase — frontend, backend, electron, services, build config

### Summary

Architecture discipline is high. The lego_blocks/orchestrators convention is enforced top-to-bottom — components, services, electron, even the Python backend. Dependency direction is clean (blocks don't reach up into orchestrators). For a solo project, this is unusually well-structured.

### What's Working Well

| Area | Assessment |
|---|---|
| Architecture discipline | High — conventions actually enforced, not just named |
| Code consistency | High — patterns replicated correctly across layers |
| VaultFS abstraction | Excellent — one interface, three platform implementations, transparent switching |
| Markdown conflict detection | Solid — FNV-1a hash + mtime, revision backups, typed errors |
| Hierarchy typing | End-to-end typed from SQLite schema through IPC to UI — no `any` in data path |
| Agent coordination docs | Actively maintained and accurate |
| MarkdownViewer context pattern | Clean shared side-sheet, keyboard-accessible, proper scroll lock |

### Issues Found → Epics Created

#### 1. No Test Coverage (LTM-015)
**Severity:** High
**Finding:** Zero automated tests for frontend. Backend has 4 tests (hierarchy bootstrap + CRUD). VaultFS, markdown save/conflict path, revision backups, and all scanner code are untested. For a tool that writes to a personal vault, this is the highest-priority gap.
**Epic:** LTM-015 — Test Safety Net for Data-Writing Paths

#### 2. ThinkingOrganizerOrch Exceeds Complexity Ceiling (LTM-016)
**Severity:** Medium-High
**Finding:** `ThinkingOrganizerOrch.tsx` is 1293 lines with 3 inner tab components (`CreateTab`, `ViewTab`, `TraceTab`), 4 custom persistence hooks, and all CRUD operations inlined. The tabs don't share state — they should be separate orchestrators composing shared blocks. The project's own architecture convention was built for exactly this decomposition.
**Epic:** LTM-016 — Decompose ThinkingOrganizerOrch

#### 3. Electron SQLite via spawnSync is Fragile (LTM-017)
**Severity:** Medium
**Finding:** Every hierarchy operation in Electron spawns a `sqlite3` CLI process via `spawnSync`. This requires the host system to have `sqlite3` installed, adds measurable latency, and is an unusual pattern. `better-sqlite3` or `sql.js` would eliminate the host dependency and improve performance.
**Epic:** LTM-017 — Migrate Electron SQLite from spawnSync to Native Library

#### 4. EXCLUDED_DIRS Defined in 5 Places (LTM-018)
**Severity:** Medium
**Finding:** The same directory exclusion list is independently defined in:
1. `frontend/src/services/lego_blocks/vaultConstantsBlock.ts`
2. `frontend/electron/src/index.ts`
3. `CapacitorVaultFS.walkVault` (inline in `fsBlock.ts`)
4. `backend/app/routers/tools.py`
5. `backend/app/tools/file_activity.py`

One change requires five edits. Bug waiting to happen.
**Epic:** LTM-018 — Consolidate EXCLUDED_DIRS to Single Source of Truth

#### 5. State Management Approaching Limits (LTM-019)
**Severity:** Medium-Low (not a fire, but smoke visible)
**Finding:** No state management library — pure useState + localStorage. Storage keys are string constants scattered across files with no central registry. ThinkingOrganizer alone has 4 custom hooks for localStorage persistence (`usePersistentTab`, `useProjectTemplates`, `useRecentTemplatePresets`, `useNodeKindOverrides`). As features grow, this becomes hard to reason about and debug.
**Epic:** LTM-019 — Centralized App State + localStorage Key Registry

#### 6. Dual Python/TS Hierarchy Implementation (LTM-020)
**Severity:** Medium (structural, compounds over time)
**Finding:** Full hierarchy code exists in both Python (`backend/app/services/`) and TypeScript (`frontend/electron/src/`). Same SQL, same logic, two languages. Every schema change needs two implementations and two sets of migrations. This is the explicit EPIC-2 constraint (web + electron parity), but the ongoing maintenance cost is real. With LTM-017 done, it becomes feasible to run the TS hierarchy in both web and electron, eliminating the Python duplicate.
**Epic:** LTM-020 — Hierarchy Code Unification (Eliminate Python/TS Duplication)
**Depends on:** LTM-017 (native SQLite in Electron makes TS the single implementation viable for both runtimes)

### Additional Observations (No Epic Needed)

- **`runtimeOrch.ts`** is currently a passthrough barrel re-exporting `fsBlock`. Fine as a placeholder for future cross-cutting logic, but adds a confusing import hop today.
- **`hierarchyTraceOrch.ts`** loads up to 5000 thoughts and does in-memory `find()`. Won't scale, but acceptable for personal vault sizes.
- **ViewTab** fetches all thoughts (up to 1000) + all vault entries on every "load node activity" call. No caching/debounce. Works for now.
- **`lzStringBlock.ts`** — compression utility; unclear if actively consumed. Possible orphan.
- **No dark mode toggle** in UI despite CSS `.dark` class support existing.
- **`/file-organizer` legacy route alias** still exists. Low priority to remove.

### Backend Migration Status

| Tool | Python | TS Port | Notes |
|---|---|---|---|
| todoScanner | Yes (web) | Yes (Electron/Capacitor) | Dual paths by platform |
| thoughtsScanner | Yes (web) | Yes (Electron/Capacitor) | Dual paths by platform |
| fileActivity | Yes (web) | Yes (Electron/Capacitor) | Dual paths by platform |
| transcriptCleaner | Yes | Yes | Ported |
| formatExcalidraw | Yes | Yes | Ported |
| gitInsights | Yes (web) | Yes (Electron) | Desktop-only in TS |
| pdfToMarkdown | Yes | No | Requires C library (PyMuPDF) — likely stays Python |
| hierarchy | Yes (web) | Yes (Electron) | Full duplication — target of LTM-020 |

**Overall migration: ~60% to TS. PDF will likely remain Python.**

### Bottom Line

The bones are strong. Conventions are real, not theater. The debt is concentrated and documented — the best kind. But the project is building on a foundation with no safety net (tests) and one component outgrowing its structure. The six epics above address the gaps in priority order.
