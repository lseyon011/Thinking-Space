# Personal Extension

This folder is a first-party, personal-only workspace inside the app source.

It mirrors the core frontend architecture so personal features stay organized
without mixing directly into shared product folders.

## Structure

- `components/lego_blocks/*` for reusable UI blocks.
- `components/orchestrators/*Orch.tsx` for page/feature state wiring.
- `services/lego_blocks/*` for reusable service primitives/integrations.
- `services/orchestrators/*Orch.ts` for workflow service composition.
- `pages/*` for route-level page wrappers.

## Current Feature

- Route: `/personal-tools`
- UI orchestrator: `components/orchestrators/PersonalToolsOrch.tsx`
- Service workflow: `services/orchestrators/headingAssignmentOrch.ts`
- First tool: heading assignment exporter for markdown files with vault-persisted dropdown presets
- Route: `/webull`
- UI orchestrator: `components/orchestrators/WebullOrch.tsx`
- Service workflow: `services/orchestrators/webullOverallOrch.ts`
- Subtab layout: vertical left rail (stacked subtabs)
- First subtab: `Overall` (loads Webull account list data)
- Runtime note: `Overall` currently calls Webull through Electron main-process IPC (renderer/browser CORS-safe).

## Environment

Set these optional route/runtime values in your frontend env file (for example `frontend/.env.local`):

- `VITE_WEBULL_BASE_URL` (optional, defaults to `https://api.webull.com`)
- `VITE_WEBULL_OPENAPI_BASE_URL` (optional, defaults to `https://us-openapi-alb.uat.webullbroker.com`)
- `VITE_WEBULL_ACCOUNT_LIST_PATH` (optional, override account-list route if your account uses a non-default path)
- `VITE_WEBULL_ACCOUNT_BALANCE_PATH` (optional)
- `VITE_WEBULL_ACCOUNT_POSITIONS_PATH` (optional)
- `VITE_WEBULL_MARKET_SNAPSHOT_PATH` (optional)
- `VITE_WEBULL_MARKET_QUOTES_PATH` (optional)
- `VITE_WEBULL_QUOTE_SYMBOLS` (optional CSV, default: `SPY,QQQ,AAPL,TSLA,NVDA`)

Webull app key/secret are no longer read from env. Enter them in `Settings > Webull`; Electron stores them in encrypted device storage.

## Notes

- Registration is currently static in `frontend/src/App.tsx`.
- Keep file naming aligned with project standards (`*Block`, `*Orch`).
