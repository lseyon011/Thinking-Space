# Excalidraw Upgrade Playbook

Last updated: February 19, 2026

## Purpose
Keep Excalidraw package upgrades low-risk by containing vendor coupling to one adapter seam and validating behavior with repeatable checks.

## Integration Seams
- Vendor API adapter (single coupling point):
  `frontend/src/services/lego_blocks/excalidrawIntegrationBlock.ts`
- UI-facing wrapper:
  `frontend/src/services/orchestrators/excalidrawIntegrationOrch.ts`
- Consumer:
  `frontend/src/components/lego_blocks/ExcalidrawDocumentBlock.tsx`

## Upgrade Checklist
1. Bump `@excalidraw/excalidraw` in `frontend/package.json` and refresh lockfile.
2. Build frontend:
   `npm --prefix frontend run build`
3. Run compatibility tests:
   `npm --prefix frontend run test -- excalidrawIntegrationBlock.test.ts excalidrawFileBlock.test.ts excalidrawSceneCompatBlock.test.ts excalidrawSceneParity.test.ts mindmapBuilderParityHarness.test.ts`
4. Manual regression sweep in app:
   - Open existing `.excalidraw.md` note in view mode.
   - Enter edit mode and verify auto-centering and navigation mini-map.
   - Save scene and verify markdown scene block remains parseable.
   - Validate highlighter stroke color compatibility with Obsidian-exported content.
5. If an API breaks, patch only inside `excalidrawIntegrationBlock.ts` unless contract expansion is intentionally required.

## Compatibility Test Scope
- `frontend/tests/excalidrawIntegrationBlock.test.ts`
  protects adapter method mapping (`updateScene`, `scrollToContent`, `onScrollChange`) and payload cloning.
- `frontend/tests/excalidrawFileBlock.test.ts`
  protects markdown scene parsing/serialization.
- `frontend/tests/excalidrawSceneCompatBlock.test.ts`
  protects interop normalization defaults and element canonicalization.
- `frontend/tests/excalidrawSceneParity.test.ts`
  protects deterministic scene normalization/parity expectations.
- `frontend/tests/mindmapBuilderParityHarness.test.ts`
  protects generated mindmap scene parity vs fixtures.

## Rehearsal Notes (February 19, 2026)
- Attempted rehearsal command:
  `npm --prefix frontend install @excalidraw/excalidraw@0.18.1 --package-lock-only --ignore-scripts --fetch-timeout=8000 --fetch-retries=0`
- Result: blocked by environment DNS/network resolution (`ENOTFOUND registry.npmjs.org`).
- Interpretation: adapter + tests are in place for upgrade safety, but package bump rehearsal is blocked until npm registry resolution succeeds in this environment.
