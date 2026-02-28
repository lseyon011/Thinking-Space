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

- Route: `/personal-extension`
- UI orchestrator: `components/orchestrators/PersonalExtensionOrch.tsx`
- Service workflow: `services/orchestrators/personalExtensionOrch.ts`

## Notes

- Registration is currently static in `frontend/src/App.tsx`.
- Keep file naming aligned with project standards (`*Block`, `*Orch`).
