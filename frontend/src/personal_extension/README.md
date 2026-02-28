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

- Route: `/f9`
- UI orchestrator: `components/orchestrators/F9Orch.tsx`
- Service workflow: `services/orchestrators/f9OverallOrch.ts`
- Subtab layout: vertical left rail (stacked subtabs)
- First subtab: `Overall` (loads Webull account list data)
- Runtime note: `Overall` currently calls Webull through Electron main-process IPC (renderer/browser CORS-safe).

## Environment

Set these in your frontend env file (for example `frontend/.env.local`):

- `VITE_F9_WEBULL_APP_KEY`
- `VITE_F9_WEBULL_APP_SECRET`
- `VITE_F9_WEBULL_BASE_URL` (optional, defaults to `https://api.webull.com`)
- `VITE_F9_WEBULL_ACCOUNT_LIST_PATH` (optional, override account-list route if your account uses a non-default path)
- `VITE_F9_WEBULL_ACCOUNT_BALANCE_PATH` (optional)
- `VITE_F9_WEBULL_ACCOUNT_POSITIONS_PATH` (optional)
- `VITE_F9_WEBULL_MARKET_SNAPSHOT_PATH` (optional)
- `VITE_F9_WEBULL_MARKET_QUOTES_PATH` (optional)
- `VITE_F9_WEBULL_QUOTE_SYMBOLS` (optional CSV, default: `SPY,QQQ,AAPL,TSLA,NVDA`)

Do not commit real credentials.

## Notes

- Registration is currently static in `frontend/src/App.tsx`.
- Keep file naming aligned with project standards (`*Block`, `*Orch`).
