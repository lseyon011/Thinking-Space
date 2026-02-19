# EPIC-3 Local-Only Extension Platform

Last updated: 2026-02-19

## Pillar Impact
- Thinking space for individuals: users add custom workflows without editing shipped app code.
- Humans + AI together: in-app builder generates extension artifacts from natural-language intent.
- AI agent management space: extension actions invoke the same capability contract/audit surface.

## Runtime Contract

### Vault Layout
Extensions are discovered from vault root `/.extensions/*`.

Recommended folder shape:

```text
.extensions/
  <registry-key>/
    manifest.json
    actions.json
    prompts/feature.md
    ui/schema.json
```

`manifest.json` is required. Other files are builder-generated and optional for loader discovery.

### Manifest Contract
Validation entrypoint: `frontend/src/services/lego_blocks/extensionManifestBlock.ts`

Required fields:
- `id` string
- `name` string
- `version` semver
- `api_version` string
- `min_app_version` semver
- `permissions` string[]
- `targets` string[]

Optional fields:
- `author`, `description`, `entry`
- `actions` (validated separately by action parser)

Compatibility gating:
- `api_version` must be included in runtime `supportedApiVersions`.
- `min_app_version` must be `<=` current runtime app version.

### Declarative Action Contract
Validation entrypoint: `frontend/src/services/lego_blocks/extensionActionBlock.ts`

Action fields:
- `id` string (unique per extension)
- `label` string
- `target` enum
- `capability` capability name
- `input` object (optional)
- `description` string (optional)

Supported targets:
- `sidebar-bottom`
- `thought-context-actions`

Input template placeholders:
- `{{context.<path>}}` resolved at invocation time.

### Loader and Lifecycle
Primary orchestrators:
- `frontend/src/services/orchestrators/extensionLoaderOrch.ts`
- `frontend/src/services/orchestrators/extensionUiOrch.ts`
- `frontend/src/services/orchestrators/extensionBuilderOrch.ts`

Registry statuses:
- `active`
- `inactive`
- `invalid`

Common reason codes:
- `MANIFEST_*`
- `ACTIONS_VALIDATION_FAILED`
- `MANIFEST_INCOMPATIBLE`
- `EXTENSION_DEACTIVATED`

## Rollout Controls

Feature flags are stored under `ltm-capability-feature-flags`:
- `extension_host_enabled` (default `false`)
- `extension_builder_enabled` (default `false`)

Behavior:
- Host disabled: extension discovery/resolution/invocation is blocked.
- Builder disabled: generation/save flow is blocked.
- Builder requires host enabled.

Control surface:
- `Capabilities` page, `Operational Controls` card.

## Security Model (Current)
- Local-only discovery from vault `.extensions`.
- No hidden remote extension fetch path.
- Permission review required before builder save.
- Invocation goes through extension capability guardrails.

## Test Harness

Focused EPIC-3 tests:

```bash
npm --prefix frontend run test -- \
  extensionActionBlock.test.ts \
  extensionUiOrch.test.ts \
  extensionBuilderOrch.test.ts \
  extensionLoaderOrch.test.ts \
  extensionCapabilityOrch.test.ts
```

Regression sweep:

```bash
npm --prefix frontend run test
npm --prefix frontend run build
```

## Rollout Checklist
1. Keep both extension flags `false` by default on release branch.
2. Run focused EPIC-3 tests + full frontend test/build.
3. Enable `extension_host_enabled` in internal test env and verify slot rendering/actions.
4. Enable `extension_builder_enabled` in internal test env and verify generate/save/activate flow.
5. Validate disable path by toggling both flags back off (no slot execution, route hidden/redirected).
6. Promote to broader rollout only after no critical errors across at least one release cycle.

## Rollback Playbook
1. Toggle `extension_builder_enabled=false`.
2. Toggle `extension_host_enabled=false`.
3. Restart app session (or reload route) to clear active extension UX surfaces.
4. Re-run sanity checks on Thinking Space and Capabilities page.
5. Keep extension files in vault unchanged; rollback is runtime-only.
