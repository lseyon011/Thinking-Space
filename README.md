# Thinking Space

> A local-first thinking workspace where humans and AI work together on personal knowledge.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Electron](https://img.shields.io/badge/Platform-Electron%20%7C%20Web%20%7C%20iOS-brightgreen)]()
[![Built with: React + TypeScript](https://img.shields.io/badge/Built%20with-React%20%2B%20TypeScript-61DAFB)]()

---

## What Is This?

Thinking Space helps you turn a folder of notes into a practical, compounding long-term memory.

Most note-taking tools force you into rigid plugin systems and disconnected AI workflows. Thinking Space is different — it's built from the ground up as three things at once:

Your notes folder is the source of truth, and Thinking Space is the helpful layer on top that makes creation, management, and use easier with AI of your choice.

You can use an existing folder with your notes or create a new one. A cloud-synced folder is recommended so your notes are available across devices.

Thinking Space does not impose a fixed way of thinking or organization. Your structure is yours. It provides useful tools out of the box and removes repetitive parts of knowledge-base work so you can focus on actual thinking.

Thinking Space is open source and designed to be extendable with AI. You can download the source code, add features, and shape the app to fit your workflow.

- Works alongside Obsidian — no conflicts
- Local-first and portable (plain Markdown + YAML)
- No lock-in to one AI provider

Humans are beautiful.

### Core Pillars

Thinking Space is built as three product pillars:

**A thinking space for individuals.** Capture structured thoughts in a natural hierarchy: Programs, Epics, Ideas, and Thoughts. Everything is local-first, stored as plain Markdown files with YAML frontmatter, and fully portable.

**A place where humans and AI work together.** AI writing assistance lives directly in your workspace — grammar, clarity, structure, and tone actions right where you're writing. Chat with AI models, configure providers, and track usage with built-in telemetry.

**An AI agent management space.** Manage agent tasks, track runs and handoffs, and integrate AI output with your own thinking. A full capability system with 55+ typed operations, audit logging, and policy controls. Run AI agents (including Claude Code) inside the app's own terminal — and let them modify and rebuild the app itself.

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" alt="Vault Setup" width="700" />
  <br />
  <em>Local-first folder setup — your data stays on your machine</em>
</p>

<!-- Add more screenshots here after connecting a folder:
  - Home dashboard with activity summary
  - Thinking Space markdown workspace with file explorer
  - Thinking Organizer hierarchy tree
  - Chat with AI provider selection
  - New Thought with emotion tags
  - Extension Builder
-->

---

## What Works Today

### Core Workspace
- [x] Multi-document markdown workspace with file explorer and tabs
- [x] Thought capture with emotion tags and AI writing assistance
- [x] Todo management with date-based organization
- [x] Hierarchical organizer (Programs > Epics > Ideas > Thoughts) with drag-and-drop, create, reparent
- [x] Conflict-safe file editing with mtime/hash checks
- [x] Command palette (Cmd/Ctrl+K) with fuzzy file search
- [x] Obsidian wikilink navigation
- [x] Dark/light theme system with custom palettes

### AI Integration
- [x] Interactive AI chat with streaming responses
- [x] Writing assistance: grammar, clarity, structure, tone — with diff preview
- [x] Multi-provider support: OpenAI, Anthropic Claude, Open Source AI (LM Studio/OpenAI-compatible local), Codex CLI
- [x] Per-scope provider/model defaults and overrides
- [x] AI telemetry panel (tokens, latency, model info)
- [x] Native credential management for Electron and iOS

### Tools
- [x] PDF to Markdown — extract with layout preservation
- [x] Transcript Cleaner — heading extraction and normalization
- [x] Excalidraw Format — normalize markdown for Excalidraw compatibility
- [x] Mindmap Builder — convert hierarchical markdown into visual diagrams
- [x] Git Insights — activity heatmap, weekly commits, contributor stats
- [x] Excalidraw Plugin Manager — install/update the community plugin

### Extension Platform
- [x] Extension discovery and loader with manifest validation
- [x] Declarative action system with UI slot routing
- [x] AI-powered extension builder (describe what you want, generate it)
- [x] Permission-gated capability bridge with audit logging
- [x] Feature-flagged rollout controls

### Embedded Terminal
- [x] Full VS Code-style terminal (xterm.js + node-pty) as a first-class nav item
- [x] Multi-tab terminal — all tabs stay alive when switching (shells keep running)
- [x] Defaults working directory to the configured source path
- [x] VS Code dark theme with clickable URLs (WebLinksAddon)

### Live Source Mode & Self-Modifying App
- [x] Ship source code bundled inside the DMG — extracted to writable storage on first launch
- [x] Configurable source path: point at your own git repo or use the bundled copy
- [x] Live HMR: toggle Live Source Mode to load the renderer from a Vite dev server (Settings → Developer)
- [x] 5-step rebuild pipeline: npm install → Vite build → cap sync → electron build → electron-builder
- [x] Apply & Relaunch: detached swap script replaces the running `.app` and relaunches automatically

### Agent Capabilities
- [x] 55+ typed capability operations with policy enforcement
- [x] Capability router with audit trail and dry-run support
- [x] CLI wrapper (`./thinkspc`) with brief/full output modes, shortcuts, and file-backed flag inputs
- [x] Task lifecycle management (claim, update, handoff, comment)
- [x] Run logging and cross-session handoff records

### Platforms
- [x] Web (browser with local File System Access API)
- [x] Electron (macOS, Windows, Linux)
- [x] iOS via Capacitor
- [x] Desktop-to-mobile OAuth credential transfer

---

## Known Limitations

- Semantic search uses lexical/fuzzy matching — no embedding-based similarity yet
- Extension JS/TS runtime is Electron-only; web and iOS are declarative-only
- No end-to-end test harness (coverage is unit/service-level)
- AI text actions are available on key surfaces but not yet unified across every text input
- Local AI (OpenAI-compatible local endpoints/WASM) path works but isn't fully polished yet

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm (comes with Node.js)

### Using the build script

```bash
git clone https://github.com/anuragrpatil23/Thinking-Space.git
cd Thinking-Space

# Install everything
./build.sh install

# Start the dev server
./build.sh dev
```

Opens at `http://localhost:5173` — pick a local folder as your vault and you're in.

### Other build commands

| Command | What it does |
|---|---|
| `./build.sh dev` | Start Vite dev server |
| `./build.sh web` | Build web/PWA bundle |
| `./build.sh electron` | Build & launch Electron app |
| `./build.sh mac` | Package macOS `.dmg` |
| `./build.sh win` | Package Windows installer |
| `./build.sh linux` | Package Linux `.AppImage` |
| `./build.sh ios` | Build for iOS + open Xcode |
| `./build.sh backend` | Start FastAPI backend (optional) |
| `./build.sh test` | Run frontend tests |
| `./build.sh clean` | Remove build artifacts |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Desktop | Electron (via Capacitor) |
| Mobile | Capacitor (iOS) |
| Storage | YAML frontmatter in Markdown files (source of truth) |
| Cache | IndexedDB via Dexie.js (rebuildable) |
| AI | OpenAI, Anthropic, Open Source AI (LM Studio/OpenAI-compatible local), Codex CLI |
| Drawing | Excalidraw |
| Editor | CodeMirror |
| Terminal | xterm.js (`@xterm/xterm`) + node-pty (same stack as VS Code) |
| Backend | FastAPI + Python (optional, thin proxy) |

---

## Architecture

Thinking Space follows a **lego blocks + orchestrators** pattern:

- **Lego blocks** — small, reusable primitives (components, hooks, services)
- **Orchestrators** — page/feature containers that compose blocks and manage state

Data flows through:
1. **Markdown files** with YAML frontmatter (source of truth, portable, git-friendly)
2. **IndexedDB** cache for fast hierarchy queries (rebuildable from files)
3. **Capability system** for agent operations (55+ typed operations with policy/audit)

Hierarchy lives in metadata (`parent` fields), not folder structure — organize your vault however you want.

For detailed architecture docs, see:
- [DEVELOPMENT.md](DEVELOPMENT.md) — architecture contracts, storage strategy, implementation phases
- [docs/ADR-004-YAML-Architecture.md](docs/ADR-004-YAML-Architecture.md) — full YAML schema
- [docs/ADR-005-Agent-Capabilities.md](docs/ADR-005-Agent-Capabilities.md) — capability system
- [AGENTS.md](AGENTS.md) — agent operating contract

---

## Information Model

```
Program          (long-running bucket)
  └── Epic       (multi-month outcome track)
       └── Idea Bucket   (container for related ideas)
            └── Idea     (concrete initiative)
                 └── Thought Bucket   (container for related thoughts)
                      └── Thought     (atomic progress artifact)
```

All hierarchy is driven by YAML `parent` fields — folders are just convenience groupings.

---

## Contributing

Contributions are welcome! The codebase follows strict placement and naming conventions — see [DEVELOPMENT.md](DEVELOPMENT.md) and [AGENTS.md](AGENTS.md) before making changes.

---

## License

[MIT](LICENSE) — Anurag Patil
