# Thinking Space

> A local-first thinking workspace where humans and AI work together on personal knowledge.

[![License: AGPL-3.0 (non-commercial)](https://img.shields.io/badge/License-AGPL--3.0%20(non--commercial)-blue.svg)](LICENSE)
[![Platform: Electron](https://img.shields.io/badge/Platform-Electron%20%7C%20Web%20%7C%20iOS-brightgreen)]()
[![Built with: React + TypeScript](https://img.shields.io/badge/Built%20with-React%20%2B%20TypeScript-61DAFB)]()

---

## Download

- Latest macOS desktop build: [Thinking Space 2.5.0 arm64 DMG](https://github.com/anuragrpatil23/Thinking-Space/releases/download/v2.5.0/Thinking.Space-2.5.0-arm64.dmg)
- All release assets: [GitHub Releases](https://github.com/anuragrpatil23/Thinking-Space/releases)

---

## What Is This?

Thinking Space helps you turn a folder of notes into a practical, compounding long-term memory.

Most note-taking tools force you into rigid plugin systems and disconnected AI workflows. Thinking Space is different — it's built from the ground up as three things at once:

Your notes folder is the source of truth, and Thinking Space is the helpful layer on top that makes creation, management, and use easier with AI of your choice.

You can use an existing folder with your notes or create a new one. A cloud-synced folder is recommended so your notes are available across devices.

Thinking Space does not impose a fixed way of thinking or organization. Your structure is yours. It provides useful tools out of the box and removes repetitive parts of knowledge-base work so you can focus on actual thinking.

Thinking Space is source-available and designed to be extendable with AI. You can inspect the source code, add features, and shape the app to fit your workflow under the terms in [LICENSE](LICENSE).

- A chill markdown viewer — point it at a folder and read your notes
- A small, extendable Electron app you can use as a home for the little tools you build for yourself
- Works alongside Obsidian — no conflicts
- Local-first and portable (plain Markdown + YAML)
- No lock-in to one AI provider
- iOS app that actually opens big vaults. Obsidian on my iPhone usually just spins forever — this one doesn't.

Humans are beautiful.

### Core Pillars

Thinking Space is built as three product pillars:

**A thinking space for individuals.** Capture structured thoughts in a natural hierarchy: Programs, Epics, Ideas, and Thoughts. Everything is local-first, stored as plain Markdown files with YAML frontmatter, and fully portable.

**A place where humans and AI work together.** AI writing assistance lives directly in your workspace — grammar, clarity, structure, and tone actions right where you're writing. Chat with AI models, configure providers, and track usage with built-in telemetry.

**An AI agent management space.** Manage agent tasks, track runs and handoffs, and integrate AI output with your own thinking. A full capability system with 55+ typed operations, audit logging, and policy controls. Run AI agents (including Claude Code) inside the app's own terminal — and let them modify and rebuild the app itself.

---

## Product Demo

<!-- Replace with an actual screen recording when available -->

<p align="center">
  <img src="docs/screenshots/home-dashboard.jpg" alt="Thinking Space home dashboard" width="900" />
  <br />
  <em>Home dashboard with daily activity summary and calm ambient chrome</em>
</p>

<p align="center">
  <img src="docs/screenshots/explorer-workspace.jpg" alt="Thinking Space explorer workspace" width="900" />
  <br />
  <em>Markdown workspace with the local-first explorer and multi-tab desktop shell</em>
</p>

<p align="center">
  <img src="docs/screenshots/organizer-workspace.jpg" alt="Thinking Space organizer workspace" width="900" />
  <br />
  <em>Organizer view for structured thinking and hierarchical knowledge management</em>
</p>

<details>
<summary><strong>Walkthrough</strong></summary>

### 1. Connect a Folder

Point Thinking Space at any folder on your machine — an existing notes vault, an iCloud directory, or a fresh folder. That folder becomes your Thinking Space. Everything is stored as plain Markdown files with YAML frontmatter, so your data is always yours.

### 2. Home Dashboard

After connecting, you land on a personalized home screen that greets you by name and shows **what you did today** — a live file activity feed of every note you created, edited, or deleted in this session.

### 3. Thinking Space (Markdown Workspace)

The main workspace is a multi-document markdown editor with:
- A **file explorer** sidebar with folder color coding and icon style options
- **Tabbed editing** — open multiple documents side by side, tabs persist across sessions
- **Conflict-safe saves** with mtime/hash checks so you never lose edits
- **Obsidian wikilink** `[[navigation]]` — click through to linked notes
- **AI writing actions** — highlight text and get grammar, clarity, structure, or tone suggestions with diff preview

### 4. New Note

Capture a thought quickly with emotion tags, type classification, and optional AI assistance. Notes land in your vault as Markdown files with structured YAML frontmatter.

### 5. AI Chat

Have a conversation with AI models directly inside the app:
- **Multi-provider**: OpenAI, Anthropic Claude, local models (LM Studio / OpenAI-compatible), Codex CLI
- **Streaming responses** with token/latency telemetry
- **Per-scope defaults** — set different models for different tasks

### 6. Thinking Organizer

A hierarchical tree view of your knowledge base: **Programs > Epics > Ideas > Thoughts**. Drag-and-drop to rearrange, create new nodes, reparent items. Hierarchy lives in YAML metadata, not folder structure — so your folders can be organized however you want.

### 7. Built-in Browser & Web

An in-app web browser with:
- **Bookmark management** with groups
- **Google Docs and Sheets** integration via OAuth
- **RSS feed reader** with retention controls, feed groups, and preset tags

### 8. Tools

- **Git Insights** — activity heatmap, weekly commit trends, contributor stats
- **PDF to Markdown** — extract content with layout preservation
- **Transcript Cleaner** — heading extraction and normalization
- **Excalidraw++** — full drawing canvas with pen defaults, scene management, and highlighter
- **Mindmap Builder** — convert hierarchical markdown into visual diagrams
- **Password Manager** — cross-device passphrase-encrypted vault

### 9. Embedded Terminal

A full VS Code-style terminal (xterm.js + node-pty) as a first-class nav item. Multi-tab, shells stay alive when switching pages. Run Claude Code or any CLI tool directly inside the app.

### 10. Settings

Configure everything: theme, explorer appearance, scheduler jobs, AI providers, markdown editor behavior, Google Workspace auth, RSS feeds, cache, and vault switching. A **Developer** tab lets you toggle Live Source Mode and trigger the rebuild pipeline.

</details>

---

## What Works Today

### Core Workspace
- [x] Multi-document markdown workspace with file explorer, tabs, and workspace persistence
- [x] Thought capture with emotion tags and AI writing assistance
- [x] Todo management with date-based organization
- [x] Hierarchical organizer (Programs > Epics > Ideas > Thoughts) with drag-and-drop, create, reparent
- [x] Cross-device password manager with passphrase-encrypted vault storage
- [x] Conflict-safe file editing with mtime/hash checks
- [x] Command palette (Cmd/Ctrl+K) with universal fuzzy search
- [x] Obsidian wikilink navigation
- [x] Dark/light theme system with custom palettes
- [x] Home dashboard with personalized greeting, starfield background, and today's file activity summary
- [x] User profile system with per-vault identity
- [x] File activity tracker — tracks edits, creates, and deletes across your vault
- [x] Git sync tools — commit and push directly from the app (Electron)

### AI Integration
- [x] Interactive AI chat with streaming responses
- [x] Writing assistance: grammar, clarity, structure, tone — with diff preview
- [x] Multi-provider support: OpenAI, Anthropic Claude, Open Source AI (LM Studio/OpenAI-compatible local), Codex CLI
- [x] Per-scope provider/model defaults and overrides
- [x] AI telemetry panel (tokens, latency, model info)
- [x] AI website presets — save and launch AI tools with one click
- [x] Native credential management for Electron and iOS
- [x] Desktop-to-mobile OAuth credential transfer

### Built-in Browser & Web
- [x] In-app web browser with bookmark management and groups
- [x] URL document viewer for embedding web content
- [x] Google Docs and Sheets integration with OAuth
- [x] RSS feed reader with retention controls, feed groups, and preset tags

### Tools
- [x] PDF to Markdown — extract with layout preservation
- [x] Transcript Cleaner — heading extraction and normalization
- [x] Excalidraw++ — full drawing canvas with pen defaults, scene management, and highlighter
- [x] Excalidraw Format — normalize markdown for Excalidraw compatibility
- [x] Excalidraw Plugin Manager — install/update the community plugin
- [x] Mindmap Builder — convert hierarchical markdown into visual diagrams
- [x] Git Insights — activity heatmap, weekly commits, contributor stats

### Settings & Customization
- [x] Theme, explorer icon style, and folder color rules
- [x] Scheduler — configure recurring automated tasks with cron-like scheduling
- [x] Markdown editor settings (line numbers, word wrap, font size, etc.)
- [x] Vault switching — connect to any folder as your Thinking Space
- [x] Cache management and developer tools (Live Source Mode, rebuild pipeline)

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
- [x] Live HMR: toggle Live Source Mode to load the renderer from a Vite dev server (Settings > Developer)
- [x] 5-step rebuild pipeline: npm install > Vite build > cap sync > electron build > electron-builder
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

## Contributing

Contributions are welcome! The codebase follows strict placement and naming conventions — see [DEVELOPMENT.md](DEVELOPMENT.md) and [AGENTS.md](AGENTS.md) before making changes.

---

## License

AGPL-3.0 for non-commercial use. Commercial license required for any commercial use.

| Use Case | Allowed? |
| --- | --- |
| Personal / research / educational | Yes |
| Self-hosted (non-commercial) | Yes, with attribution |
| Fork and modify (non-commercial) | Yes, share source under AGPL-3.0 |
| Commercial use / SaaS / rebranding | Requires commercial license |

See [LICENSE](LICENSE) for full terms. For commercial licensing, contact the maintainer.

Copyright (C) 2024-2026 Elie Habib. All rights reserved.
