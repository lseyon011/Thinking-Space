import UIKit

/// Bridge to the React side. The coordinator never talks to Capacitor
/// directly so it can be tested with a stub.
protocol PushNavigationBridge: AnyObject {
    /// Ask React to render the given path. `direction` tells React whether
    /// this is a forward push (open new content) or a back pop (close current
    /// content). React invokes its registered back-handler cascade only when
    /// direction == .back. Call `completion` once React has committed.
    func requestRender(path: String, direction: PushNavigationDirection, completion: @escaping () -> Void)

    /// Notify React that a transition has finished, so it can resume any
    /// paused animations or restore caret state.
    func notifyDidFinish(path: String)
}

enum PushNavigationDirection: String {
    case forward
    case back
}

/// Drives UINavigationController-style push transitions between React-rendered
/// pages hosted in a single WKWebView.
///
/// The dance: snapshot current → cover → swap React content underneath →
/// animate snapshot off + new content in. Result feels identical to a real
/// `UINavigationController` push because the animation IS real UIKit.
///
/// Animation values come from docs/ios-animation-reference/ANIMATION_VALUES.md.
final class PushNavigationCoordinator {

    // MARK: - Tuned values (see ANIMATION_VALUES.md)
    private let duration: TimeInterval = 0.35
    private let damping: CGFloat = 0.85
    private let parallaxFraction: CGFloat = 0.30
    private let dimAlpha: CGFloat = 0.08

    // MARK: - Dependencies

    /// The view whose contents represent the current React page. Its transform
    /// is what we animate. Typically `RootShellViewController.mainShellContainerView`.
    private weak var mainShellView: UIView?

    /// The view that hosts the transition. Snapshot + dim overlay are added
    /// here. Typically `RootShellViewController.view`.
    private weak var containerView: UIView?

    /// Sibling view that should remain on top throughout the transition
    /// (so snapshot doesn't cover it). Typically the bottom chrome.
    private weak var topSiblingView: UIView?

    private weak var bridge: PushNavigationBridge?

    // MARK: - State

    /// Stack of route paths. `stack.last` is what's currently rendered.
    /// Initialized once when the root tab is known.
    private(set) var stack: [String] = []

    /// True while a transition is in flight; subsequent push/pop calls are
    /// ignored until it completes.
    private var isAnimating: Bool = false

    /// Active interactive-pop snapshot, if any. Non-nil during an
    /// edge-swipe-back gesture between .began and the gesture's settle.
    private var interactiveSnapshot: UIView?

    /// Fires after every stack mutation (push/pop completion, replaceStack,
    /// setRoot). RootShellViewController hooks this to mirror canPop into
    /// chromeState.canGoBack so the bottom-chrome button can morph.
    var onStackChanged: (() -> Void)?

    var canPop: Bool { stack.count > 1 && !isAnimating }
    var topPath: String? { stack.last }

    // MARK: - Init

    init(mainShellView: UIView,
         containerView: UIView,
         topSiblingView: UIView?,
         bridge: PushNavigationBridge) {
        self.mainShellView = mainShellView
        self.containerView = containerView
        self.topSiblingView = topSiblingView
        self.bridge = bridge
    }

    /// Replace the bridge after init. Used to swap the development stub for
    /// the Capacitor-plugin-backed bridge once React has registered.
    func setBridge(_ bridge: PushNavigationBridge) {
        self.bridge = bridge
    }

    /// Set the root path without animating. Called by RootShellViewController
    /// when it learns the initial route from React.
    func setRoot(_ path: String) {
        stack = [path]
        onStackChanged?()
    }

    /// Replace the entire stack (e.g. on tab switch). No animation.
    func replaceStack(_ paths: [String]) {
        stack = paths
        onStackChanged?()
    }

    /// Replace the root path (for tab switches via the rail). No animation.
    /// Clears any pushed pages on top.
    func replaceRoot(_ path: String) {
        stack = [path]
    }

    // MARK: - Push

    func push(toPath path: String) {
        guard !isAnimating else { return }
        guard let mainShell = mainShellView, let container = containerView else { return }
        guard let bridge = bridge else { return }
        // Note: same-path pushes ARE allowed. Non-URL content types
        // (RSS, notebook, etc.) push using a shared base path with a
        // forward-callback for the state mutation; the stack entries are
        // meaningful even though their `path` values collide.

        isAnimating = true

        // 1. Snapshot the outgoing page.
        guard let snapshot = mainShell.snapshotView(afterScreenUpdates: true) else {
            isAnimating = false
            return
        }
        snapshot.frame = mainShell.frame
        snapshot.translatesAutoresizingMaskIntoConstraints = true
        snapshot.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        // 2. Dim overlay added on top of the snapshot — it will fade in as the
        //    snapshot slides left to give the outgoing page the system "behind
        //    the new page" look.
        let dim = makeDimView(over: snapshot.bounds)
        dim.alpha = 0
        snapshot.addSubview(dim)

        // 3. Layer order: snapshot (OLD) goes UNDER mainShell (NEW) so that
        //    when mainShell slides in from the right, it visibly covers the
        //    old content — matching the iOS system push animation. If we put
        //    the snapshot on top, the new content stays hidden behind the old
        //    until the snapshot has nearly cleared, which feels like the
        //    transition stalls at the start.
        container.insertSubview(snapshot, belowSubview: mainShell)
        if let topSibling = topSiblingView {
            container.bringSubviewToFront(topSibling)
        }

        // 4. Move main shell off-screen right. Since mainShell is on top of
        //    the snapshot but pushed off-screen, the user still sees the
        //    snapshot. Once React renders new content underneath mainShell,
        //    the slide-in reveals the new content.
        let width = mainShell.bounds.width
        mainShell.transform = CGAffineTransform(translationX: width, y: 0)

        // 5. Ask React to render the new path.
        bridge.requestRender(path: path, direction: .forward) { [weak self, weak snapshot, weak mainShell] in
            guard let self else { return }
            guard let snapshot, let mainShell else {
                self.isAnimating = false
                return
            }

            // 5. Animate.
            UIView.animate(
                withDuration: self.duration,
                delay: 0,
                usingSpringWithDamping: self.damping,
                initialSpringVelocity: 0,
                options: [.curveEaseOut, .beginFromCurrentState],
                animations: {
                    snapshot.transform = CGAffineTransform(translationX: -width * self.parallaxFraction, y: 0)
                    dim.alpha = self.dimAlpha
                    mainShell.transform = .identity
                },
                completion: { _ in
                    snapshot.removeFromSuperview()
                    self.stack.append(path)
                    self.isAnimating = false
                    self.onStackChanged?()
                    bridge.notifyDidFinish(path: path)
                }
            )
        }
    }

    // MARK: - Pop

    @discardableResult
    func pop() -> Bool {
        guard !isAnimating else { return false }
        guard stack.count > 1 else { return false }
        guard let mainShell = mainShellView, let container = containerView else { return false }
        guard let bridge = bridge else { return false }

        isAnimating = true
        let targetPath = stack[stack.count - 2]

        // 1. Snapshot the current (outgoing) page.
        guard let snapshot = mainShell.snapshotView(afterScreenUpdates: true) else {
            isAnimating = false
            return false
        }
        snapshot.frame = mainShell.frame
        snapshot.translatesAutoresizingMaskIntoConstraints = true
        snapshot.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        // Layer order: snapshot (current/outgoing page) goes ON TOP of
        //  mainShell so that as it slides off to the right, mainShell (now
        //  rendering the previous page underneath) is revealed. This is the
        //  opposite of push, where the new content slides in on top.
        container.addSubview(snapshot)
        if let topSibling = topSiblingView {
            container.bringSubviewToFront(topSibling)
        }

        // 2. Pre-position main shell at -30% parallax with dim, ready for the
        //    incoming page. Snapshot still covers, so this is invisible.
        let width = mainShell.bounds.width
        mainShell.transform = CGAffineTransform(translationX: -width * parallaxFraction, y: 0)

        // 3. Dim overlay on main shell (the incoming page, starts dimmed).
        let dim = makeDimView(over: mainShell.bounds)
        dim.alpha = dimAlpha
        mainShell.addSubview(dim)

        // 4. Ask React to render the previous path.
        bridge.requestRender(path: targetPath, direction: .back) { [weak self, weak snapshot, weak mainShell, weak dim] in
            guard let self else { return }
            guard let snapshot, let mainShell, let dim else {
                self.isAnimating = false
                return
            }

            // 5. Animate.
            UIView.animate(
                withDuration: self.duration,
                delay: 0,
                usingSpringWithDamping: self.damping,
                initialSpringVelocity: 0,
                options: [.curveEaseOut, .beginFromCurrentState],
                animations: {
                    snapshot.transform = CGAffineTransform(translationX: width, y: 0)
                    mainShell.transform = .identity
                    dim.alpha = 0
                },
                completion: { _ in
                    snapshot.removeFromSuperview()
                    dim.removeFromSuperview()
                    self.stack.removeLast()
                    self.isAnimating = false
                    self.onStackChanged?()
                    bridge.notifyDidFinish(path: targetPath)
                }
            )
        }

        return true
    }

    // MARK: - Interactive pop (edge-swipe-back)

    /// True while an interactive pop gesture is in progress.
    var isInteractivePopActive: Bool { interactiveSnapshot != nil }

    /// Begin an interactive pop. Returns the snapshot view so the caller can
    /// translate it directly from the gesture's translation. Returns nil if
    /// there's nothing to pop or another transition is already in flight.
    ///
    /// During the interactive phase only the snapshot moves with the finger
    /// — React state and the underlying mainShell stay untouched. On commit,
    /// the real pop animation runs and fires the back-handler cascade. On
    /// cancel, the snapshot springs back to identity and nothing changed.
    @discardableResult
    func beginInteractivePop() -> UIView? {
        guard !isAnimating else { return nil }
        guard interactiveSnapshot == nil else { return nil }
        guard stack.count > 1 else { return nil }
        guard let mainShell = mainShellView, let container = containerView else { return nil }

        guard let snapshot = mainShell.snapshotView(afterScreenUpdates: true) else { return nil }
        snapshot.frame = mainShell.frame
        snapshot.translatesAutoresizingMaskIntoConstraints = true
        snapshot.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        container.addSubview(snapshot)
        if let topSibling = topSiblingView {
            container.bringSubviewToFront(topSibling)
        }

        interactiveSnapshot = snapshot
        return snapshot
    }

    /// Drive the interactive transform. `translation` is the gesture's
    /// translation.x in the container's coordinate space (≥ 0 — leftward
    /// swipes are clamped out).
    func updateInteractivePop(translation: CGFloat) {
        guard let snapshot = interactiveSnapshot else { return }
        let clamped = max(0, translation)
        snapshot.transform = CGAffineTransform(translationX: clamped, y: 0)
    }

    /// Commit the interactive pop. Animates the snapshot off to the right and
    /// triggers the full pop sequence (snapshot of new state, React cascade,
    /// stack update, didFinish notification). Same end state as a regular
    /// pop, just with the in-flight snapshot continuing rather than being
    /// re-captured.
    func completeInteractivePop() {
        guard let snapshot = interactiveSnapshot, let mainShell = mainShellView, let bridge = bridge else {
            cancelInteractivePop()
            return
        }
        guard stack.count > 1 else {
            cancelInteractivePop()
            return
        }

        interactiveSnapshot = nil
        isAnimating = true
        let targetPath = stack[stack.count - 2]
        let width = mainShell.bounds.width

        // Continue sliding the snapshot off to the right from wherever the
        // finger left it. The remaining-distance duration tracks how far
        // it still has to travel so the spring feels consistent.
        let currentX = snapshot.transform.tx
        let remaining = max(0, width - currentX)
        let frac = remaining / max(width, 1)
        let snapshotDuration = max(self.duration * 0.4, self.duration * frac)

        UIView.animate(
            withDuration: snapshotDuration,
            delay: 0,
            usingSpringWithDamping: damping,
            initialSpringVelocity: 0,
            options: [.curveEaseOut, .beginFromCurrentState],
            animations: {
                snapshot.transform = CGAffineTransform(translationX: width, y: 0)
            },
            completion: { _ in
                snapshot.removeFromSuperview()
            }
        )

        // While the snapshot finishes sliding, do the React-render dance
        // underneath: ask the bridge for the previous page, then animate
        // mainShell from the parallax position to identity to settle in.
        // The snapshot's removal hides any small misalignment between the
        // two animations.
        mainShell.transform = CGAffineTransform(translationX: -width * parallaxFraction, y: 0)
        let dim = makeDimView(over: mainShell.bounds)
        dim.alpha = dimAlpha
        mainShell.addSubview(dim)

        bridge.requestRender(path: targetPath, direction: .back) { [weak self, weak mainShell, weak dim] in
            guard let self else { return }
            guard let mainShell, let dim else {
                self.isAnimating = false
                return
            }

            UIView.animate(
                withDuration: self.duration,
                delay: 0,
                usingSpringWithDamping: self.damping,
                initialSpringVelocity: 0,
                options: [.curveEaseOut, .beginFromCurrentState],
                animations: {
                    mainShell.transform = .identity
                    dim.alpha = 0
                },
                completion: { _ in
                    dim.removeFromSuperview()
                    self.stack.removeLast()
                    self.isAnimating = false
                    self.onStackChanged?()
                    bridge.notifyDidFinish(path: targetPath)
                }
            )
        }
    }

    /// Cancel the interactive pop and spring the snapshot back to identity.
    /// No React state is touched (none was during the interactive phase).
    func cancelInteractivePop() {
        guard let snapshot = interactiveSnapshot else { return }
        interactiveSnapshot = nil

        UIView.animate(
            withDuration: duration * 0.7,
            delay: 0,
            usingSpringWithDamping: damping,
            initialSpringVelocity: 0,
            options: [.curveEaseOut, .beginFromCurrentState],
            animations: {
                snapshot.transform = .identity
            },
            completion: { _ in
                snapshot.removeFromSuperview()
            }
        )
    }

    // MARK: - Helpers

    private func makeDimView(over bounds: CGRect) -> UIView {
        let dim = UIView(frame: bounds)
        dim.backgroundColor = .black
        dim.isUserInteractionEnabled = false
        dim.translatesAutoresizingMaskIntoConstraints = true
        dim.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        return dim
    }
}
