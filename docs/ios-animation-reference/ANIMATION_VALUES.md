# iOS Animation Reference — values to preserve verbatim

Source: `ios-native-drawer-implementation` branch, `frontend/ios/App/App/RootShellViewController.swift`.

These values were tuned by hand on-device and felt right. Re-derive nothing. When porting the rail and building the push coordinator, copy these constants exactly.

## Drawer open/close animation

```swift
UIView.animate(
    withDuration: 0.34,
    delay: 0,
    usingSpringWithDamping: 0.9,
    initialSpringVelocity: 0.18,
    options: [.curveEaseInOut, .beginFromCurrentState],
    animations: applyState,
    completion: completion
)
```

Used for both `openDrawer` and `closeDrawer` (symmetric).

## Chrome (bottom bar) collapse/expand animation

```swift
UIView.animate(
    withDuration: 0.32,
    delay: 0,
    usingSpringWithDamping: 0.9,
    initialSpringVelocity: 0.2,
    options: [.curveEaseInOut, .beginFromCurrentState]
) { ... }
```

Note the slight differences from the drawer spring: 0.32s (vs 0.34s) and 0.2 velocity (vs 0.18). These are intentional — chrome is smaller and snappier.

## Edge-pan gesture thresholds

```swift
private let drawerOpenThreshold:  CGFloat =  72   // left-edge pan must reach +72px to open
private let drawerCloseThreshold: CGFloat = -56   // close-pan must reach -56px (asymmetric)
private let drawerVerticalDriftTolerance: CGFloat = 44  // abort if finger drifts >44px vertically
```

Asymmetric thresholds matter: opening requires more commitment than closing.

## Drawer width / slide offset

```swift
// width: 84% of screen, clamped to [292, 340]
let w = min(max(screenWidth * 0.84, 292), 340)

// slide offset: drawer width, but never closer than 52px to opposite edge
let offset = min(drawerWidth, max(view.bounds.width - 52, 0))
```

## Shadow during slide

Main shell shadow appears only while a drawer is open.

```swift
// on the mainShellContainerView layer:
shadowColor   = UIColor.black.cgColor
shadowOffset  = .zero                           // initial; flipped during slide
shadowRadius  = 28
shadowOpacity = 0                                // closed
shadowOpacity = 0.16                             // open (either side)

// when LEFT drawer opens (main shell slid right):
shadowOffset = CGSize(width: -10, height: 0)
// when RIGHT drawer opens (main shell slid left):
shadowOffset = CGSize(width:  10, height: 0)
```

## Tap-shield (dimming overlay)

The tap-shield is invisible to the eye — it's *not* a dimming layer.

```swift
backgroundColor = UIColor.black.withAlphaComponent(0.001)  // essentially transparent
alpha           = 0  → 1 when drawer opens
```

It exists only to capture taps for "tap outside to dismiss." If you want a true iOS-style dim, add a separate dimming view; the old branch did not.

## Drawer background color (warm beige)

```swift
UIColor(red: 245/255, green: 243/255, blue: 238/255, alpha: 1.0)  // #f5f3ee
```

Matches the SwiftUI header gradient — visual continuity between native header and webview content.

## Drawer header pill / button styling (from DrawerHeaderView.swift)

```swift
.background(Color.white.opacity(0.85))
.stroke(Color.black.opacity(0.12), lineWidth: 0.5)
.shadow(color: .black.opacity(0.04), radius: 2, y: 1)
```

## Critical WKWebView gotcha (carry forward)

From `be3b600` commit body — **do not set `isHidden = true` on a drawer WKWebView.** It suspends JS and causes stale content on reopen. Use z-order occlusion + `isUserInteractionEnabled` toggling instead. Also:

```swift
webView.scrollView.contentInsetAdjustmentBehavior = .never
```

…when the SwiftUI header already handles safe area, otherwise you get double-insets.

## Values still to define (for push transition, task #4)

The old branch did not implement a UINavigationController-style push — these are net-new and need first-principles tuning on-device (but should sit in the same family as the drawer values above):

- Push duration — start at **0.35s** (iOS system default for navigation push is ~0.35s).
- Push spring damping — start at **0.85** (slightly less damped than drawer, more "snap"). System push is not actually a spring; it's a custom curve. Match Apple's `UINavigationController` default by using `UISpringTimingParameters(dampingRatio: 1.0)` with a `UIViewPropertyAnimator` if a literal-match is desired.
- Outgoing-page parallax offset — **-30%** of screen width (Apple's value).
- Outgoing-page dim — start at **0.0 → 0.08 black overlay** during push.
- Edge-swipe-back: `UIScreenEdgePanGestureRecognizer` on `.left`, fed into a `UIPercentDrivenInteractiveTransition`. Completion threshold: **50%** translation OR **velocity > 800 pts/s**.

## Gesture dispatch — left edge does double duty

The rail lives on the **left** edge, AND the push-transition swipe-back also uses the **left** edge. Apple's apps (Settings, Mail, Messages) resolve this contextually:

- If `navStack.count > 1` (user has pushed into content) → left-edge pan drives **swipe-back** (`UIPercentDrivenInteractiveTransition`).
- If `navStack.count == 1` (user is at a root tab page) → left-edge pan **opens the rail**.

`PushNavigationCoordinator` will own this dispatch. A single `UIScreenEdgePanGestureRecognizer` on `.left` routes to either the pop interaction or the rail open based on nav state at gesture-begin time.
