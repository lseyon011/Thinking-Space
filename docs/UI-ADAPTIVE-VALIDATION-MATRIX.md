# UI Adaptive Validation Matrix

This matrix defines deterministic shell expectations for cross-device layouts.

## Automated Profiles

1. Desktop (Electron, widescreen)
- Input: `1512x982`, `platform=electron`, keyboard closed
- Expected: persistent sidebar, no compact drawer, no bottom nav

2. iPad portrait
- Input: `834x1194`, `platform=ios`, keyboard closed
- Expected: compact shell, bottom nav visible, bottom padding includes safe-area inset

3. iPad landscape
- Input: `1194x834`, `platform=ios`, keyboard closed
- Expected: persistent sidebar, no bottom nav

4. iPhone portrait (keyboard open)
- Input: `430x610`, `platform=ios`, `keyboardInset=322`
- Expected: compact shell, bottom nav hidden, content + drawer bottom padding use keyboard inset

5. iPad split-view compact width
- Input: `700x1024`, `platform=ios`, keyboard closed
- Expected: compact shell, bottom nav visible

Automated coverage for these profiles lives in:
- `frontend/tests/uiNavigationBlock.test.ts`

## Manual Smoke Checklist

1. Open app on Electron desktop and verify sidebar remains visible while resizing above and below 1200px.
2. Open app on iPad portrait and verify top compact header + bottom nav are visible.
3. On iPad/iPhone, focus a text input and verify bottom nav hides while keyboard is open.
4. Open compact drawer on iPhone and verify content is not clipped by notch/home indicator.
5. Rotate iPad/iPhone and verify layout transitions without stuck drawer or incorrect nav mode.

## Test Commands

```bash
npx tsc --noEmit
npm --prefix frontend run test -- uiLayoutBlock.test.ts uiLayoutOrch.test.ts uiNavigationBlock.test.ts
```

