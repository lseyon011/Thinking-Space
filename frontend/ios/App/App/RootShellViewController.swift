import UIKit
import SwiftUI
import Combine

/// Shared singleton so any plugin can reach the shell VC without wiring.
/// Eliminates all timing issues with plugin ↔ VC references.
final class DrawerBridge {
    static let shared = DrawerBridge()
    weak var shellVC: RootShellViewController?
    /// Content plugin lives on the drawer bridge — stored here so the shell can push state to it.
    weak var contentPlugin: NativeDrawerContentPlugin?
    private init() {}
}

struct NativeDrawerShellStateRecord {
    var kind: String = "app-nav"
    var title: String = "Thinking Space"
    var currentPath: String = "/thinking-space"
    var currentSearch: String = ""
    var isOpen: Bool = false

    func asPayload() -> [String: Any] {
        [
            "kind": kind,
            "title": title,
            "currentPath": currentPath,
            "currentSearch": currentSearch,
            "isOpen": isOpen,
        ]
    }
}

final class RootShellViewController: UIViewController {
    private let shellBackgroundColor = UIColor.systemBackground
    private let drawerOpenThreshold: CGFloat = 72
    private let drawerCloseThreshold: CGFloat = -56
    private let drawerVerticalDriftTolerance: CGFloat = 44

    private lazy var bridgeVC: LTMBridgeViewController = {
        let vc = LTMBridgeViewController()
        vc.rootShellVC = self
        return vc
    }()
    private lazy var drawerBridgeVC: LTMDrawerBridgeViewController = {
        LTMDrawerBridgeViewController()
    }()
    let chromeState = TopChromeState() // Made internal so bridge can access it
    private var chromePlugin: TopChromePlugin?
    private var chromeVisibilityCancellable: AnyCancellable?
    private var bottomBarVisibilityCancellable: AnyCancellable?
    private var chromeLayoutCancellable: AnyCancellable?
    private var topChromeHeightConstraint: NSLayoutConstraint?
    private var bottomChromeHeightConstraint: NSLayoutConstraint?
    private var drawerWidthConstraint: NSLayoutConstraint?
    private var nativeDrawerState = NativeDrawerShellStateRecord()
    private var nativeDrawerOpen = false
    private lazy var topInsetHostingVC = UIHostingController(rootView: TopInsetGlassView())

    private lazy var bottomChromeHostingVC = UIHostingController(
        rootView: BottomChromeView(
            state: chromeState,
            onSidebarToggleTap: { [weak self] in self?.chromePlugin?.emitSidebarToggleTap() },
            onCreateTap: { [weak self] in self?.chromePlugin?.emitCreateTap() },
            onExpandTap: { [weak self] in self?.chromePlugin?.emitExpandBottomTap() },
            onSelectTab: { [weak self] tabId in self?.chromePlugin?.emitSelectTab(tabId: tabId) },
            onCloseTab: { [weak self] tabId in self?.chromePlugin?.emitCloseTab(tabId: tabId) }
        )
    )

    private let mainShellContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .clear
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOffset = CGSize(width: -10, height: 0)
        view.layer.shadowRadius = 28
        view.layer.shadowOpacity = 0
        return view
    }()

    private let drawerContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .systemBackground
        view.clipsToBounds = true
        return view
    }()

    private let drawerTapShieldView: UIControl = {
        let view = UIControl(frame: .zero)
        view.backgroundColor = UIColor.black.withAlphaComponent(0.001)
        view.alpha = 0
        view.isHidden = true
        return view
    }()

    private lazy var drawerOpenEdgeGestureRecognizer: UIScreenEdgePanGestureRecognizer = {
        let recognizer = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleDrawerOpenEdgePan(_:)))
        recognizer.edges = .left
        return recognizer
    }()

    private lazy var drawerClosePanGestureRecognizer: UIPanGestureRecognizer = {
        let recognizer = UIPanGestureRecognizer(target: self, action: #selector(handleDrawerClosePan(_:)))
        recognizer.cancelsTouchesInView = false
        return recognizer
    }()

    private let topChromeContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private let bottomChromeContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private var shouldUseNativeTopChrome: Bool {
        UIDevice.current.userInterfaceIdiom == .phone
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = shellBackgroundColor
        DrawerBridge.shared.shellVC = self

        if shouldUseNativeTopChrome {
            configurePhoneShell()
            observeChromeVisibility()
            observeBottomBarVisibility()
            observeChromeLayoutChanges()
        } else {
            embedBridgeFullscreen()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateDrawerWidthConstraint()
        applyChromeVisibility(animated: false)
        applyBottomBarVisibility(animated: false)
        applyNativeDrawerVisualState(open: nativeDrawerOpen)
    }

    func wireTopChromePlugin(_ plugin: TopChromePlugin) {
        chromePlugin = plugin
        plugin.chromeState = chromeState
    }

    func currentDrawerState(isOpen: Bool) -> NativeDrawerShellStateRecord {
        var s = nativeDrawerState
        s.isOpen = isOpen
        return s
    }

    func dismissInlineWebView() {
        bridgeVC.dismissInlineWebView()
    }

    func updateNativeDrawerState(_ nextState: NativeDrawerShellStateRecord, open: Bool? = nil) {
        DispatchQueue.main.async {
            self.nativeDrawerState.kind = nextState.kind
            self.nativeDrawerState.title = nextState.title
            self.nativeDrawerState.currentPath = nextState.currentPath
            self.nativeDrawerState.currentSearch = nextState.currentSearch
            self.emitNativeDrawerState()

            if let open {
                self.setNativeDrawerOpen(open, animated: true)
            }
        }
    }

    func handleNativeDrawerAction(type: String, payloadJson: String?) {
        DispatchQueue.main.async {
            print("[Drawer] handleNativeDrawerAction type=\(type) payloadJson=\(payloadJson ?? "nil")")
            switch type {
            case "close":
                self.setNativeDrawerOpen(false, animated: true)
                self.dispatchDrawerEventToMainWebView(type: "close", payloadJson: nil)
            case "navigate":
                self.setNativeDrawerOpen(false, animated: true)
                self.dispatchDrawerEventToMainWebView(type: "navigate", payloadJson: payloadJson)
            default:
                break
            }
        }
    }

    /// Dispatch a custom DOM event directly to the main web view, bypassing Capacitor plugin wiring.
    private func dispatchDrawerEventToMainWebView(type: String, payloadJson: String?) {
        let detail: [String: String] = [
            "type": type,
            "payloadJson": payloadJson ?? "",
        ]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: detail),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        let js = "window.dispatchEvent(new CustomEvent('native-drawer-action', { detail: \(jsonString) }));"
        print("[Drawer] dispatchToMainWebView js=\(js) webView=\(bridgeVC.webView != nil ? "ready" : "nil")")
        bridgeVC.webView?.evaluateJavaScript(js) { result, error in
            if let error {
                print("[Drawer] evaluateJavaScript error: \(error)")
            } else {
                print("[Drawer] evaluateJavaScript success result=\(String(describing: result))")
            }
        }
    }

    func nativeDrawerStatePayload() -> [String: Any] {
        nativeDrawerState.asPayload()
    }

    private func configurePhoneShell() {
        topChromeContainerView.backgroundColor = .clear
        bottomChromeContainerView.backgroundColor = .clear
        topInsetHostingVC.view.backgroundColor = .clear
        bottomChromeHostingVC.view.backgroundColor = .clear
        bridgeVC.view.backgroundColor = shellBackgroundColor
        drawerBridgeVC.view.backgroundColor = shellBackgroundColor

        view.addSubview(drawerContainerView)
        view.addSubview(mainShellContainerView)
        NSLayoutConstraint.activate([
            mainShellContainerView.topAnchor.constraint(equalTo: view.topAnchor),
            mainShellContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mainShellContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            mainShellContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        embedDrawerBehindShell()
        configureDrawerTapShield()
        embedTopInsetGlass()
        embedBridgeBelowTopInset()
        embedBottomChromeOverlay()
        setupDrawerGestures()

        view.bringSubviewToFront(mainShellContainerView)
        view.bringSubviewToFront(drawerTapShieldView)
    }

    private func embedDrawerBehindShell() {
        addChild(drawerBridgeVC)
        drawerContainerView.addSubview(drawerBridgeVC.view)
        drawerBridgeVC.view.translatesAutoresizingMaskIntoConstraints = false

        let drawerWidthConstraint = drawerContainerView.widthAnchor.constraint(equalToConstant: resolvedDrawerWidth())
        self.drawerWidthConstraint = drawerWidthConstraint

        NSLayoutConstraint.activate([
            drawerContainerView.topAnchor.constraint(equalTo: view.topAnchor),
            drawerContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            drawerContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            drawerWidthConstraint,
            drawerBridgeVC.view.leadingAnchor.constraint(equalTo: drawerContainerView.leadingAnchor),
            drawerBridgeVC.view.trailingAnchor.constraint(equalTo: drawerContainerView.trailingAnchor),
            drawerBridgeVC.view.topAnchor.constraint(equalTo: drawerContainerView.topAnchor),
            drawerBridgeVC.view.bottomAnchor.constraint(equalTo: drawerContainerView.bottomAnchor),
        ])

        drawerBridgeVC.didMove(toParent: self)
    }

    private func configureDrawerTapShield() {
        drawerTapShieldView.addTarget(self, action: #selector(handleDrawerTapShield), for: .touchUpInside)
        drawerTapShieldView.addGestureRecognizer(drawerClosePanGestureRecognizer)
        view.addSubview(drawerTapShieldView)
    }

    private func embedTopInsetGlass() {
        addChild(topInsetHostingVC)
        mainShellContainerView.addSubview(topChromeContainerView)
        topChromeContainerView.addSubview(topInsetHostingVC.view)

        topInsetHostingVC.view.translatesAutoresizingMaskIntoConstraints = false

        let topChromeHeightConstraint = topChromeContainerView.heightAnchor.constraint(equalToConstant: resolvedTopChromeHeight())
        self.topChromeHeightConstraint = topChromeHeightConstraint

        NSLayoutConstraint.activate([
            topChromeContainerView.topAnchor.constraint(equalTo: mainShellContainerView.topAnchor),
            topChromeContainerView.leadingAnchor.constraint(equalTo: mainShellContainerView.leadingAnchor),
            topChromeContainerView.trailingAnchor.constraint(equalTo: mainShellContainerView.trailingAnchor),
            topChromeHeightConstraint,
            topInsetHostingVC.view.leadingAnchor.constraint(equalTo: topChromeContainerView.leadingAnchor),
            topInsetHostingVC.view.trailingAnchor.constraint(equalTo: topChromeContainerView.trailingAnchor),
            topInsetHostingVC.view.topAnchor.constraint(equalTo: topChromeContainerView.topAnchor),
            topInsetHostingVC.view.bottomAnchor.constraint(equalTo: topChromeContainerView.bottomAnchor),
        ])

        topInsetHostingVC.didMove(toParent: self)
    }

    private func embedBridgeBelowTopInset() {
        addChild(bridgeVC)
        mainShellContainerView.addSubview(bridgeVC.view)
        bridgeVC.view.translatesAutoresizingMaskIntoConstraints = false
        bridgeVC.view.layer.cornerRadius = 0
        bridgeVC.view.layer.masksToBounds = false
        bridgeVC.view.clipsToBounds = false

        NSLayoutConstraint.activate([
            bridgeVC.view.leadingAnchor.constraint(equalTo: mainShellContainerView.leadingAnchor),
            bridgeVC.view.trailingAnchor.constraint(equalTo: mainShellContainerView.trailingAnchor),
            bridgeVC.view.topAnchor.constraint(equalTo: topChromeContainerView.bottomAnchor),
            bridgeVC.view.bottomAnchor.constraint(equalTo: mainShellContainerView.bottomAnchor),
        ])

        bridgeVC.didMove(toParent: self)
        // Wire any plugins that were created during init before rootShellVC was set
        bridgeVC.wirePendingPluginsIfNeeded(to: self)
    }

    private func embedBottomChromeOverlay() {
        addChild(bottomChromeHostingVC)
        mainShellContainerView.addSubview(bottomChromeContainerView)
        bottomChromeContainerView.addSubview(bottomChromeHostingVC.view)

        bottomChromeHostingVC.view.translatesAutoresizingMaskIntoConstraints = false

        let bottomChromeHeightConstraint = bottomChromeContainerView.heightAnchor.constraint(equalToConstant: resolvedBottomChromeHeight())
        self.bottomChromeHeightConstraint = bottomChromeHeightConstraint

        NSLayoutConstraint.activate([
            bottomChromeContainerView.leadingAnchor.constraint(equalTo: mainShellContainerView.leadingAnchor),
            bottomChromeContainerView.trailingAnchor.constraint(equalTo: mainShellContainerView.trailingAnchor),
            bottomChromeContainerView.bottomAnchor.constraint(equalTo: mainShellContainerView.bottomAnchor),
            bottomChromeHeightConstraint,
            bottomChromeHostingVC.view.leadingAnchor.constraint(equalTo: bottomChromeContainerView.leadingAnchor),
            bottomChromeHostingVC.view.trailingAnchor.constraint(equalTo: bottomChromeContainerView.trailingAnchor),
            bottomChromeHostingVC.view.topAnchor.constraint(equalTo: bottomChromeContainerView.safeAreaLayoutGuide.topAnchor),
            bottomChromeHostingVC.view.bottomAnchor.constraint(equalTo: bottomChromeContainerView.bottomAnchor),
        ])

        bottomChromeHostingVC.didMove(toParent: self)
    }

    private func embedBridgeFullscreen() {
        addChild(bridgeVC)
        view.addSubview(bridgeVC.view)
        bridgeVC.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            bridgeVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        bridgeVC.didMove(toParent: self)
    }

    private func setupDrawerGestures() {
        view.addGestureRecognizer(drawerOpenEdgeGestureRecognizer)
    }

    private func observeChromeVisibility() {
        chromeVisibilityCancellable = chromeState.$isVisible
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyChromeVisibility(animated: true)
            }
    }

    private func observeBottomBarVisibility() {
        bottomBarVisibilityCancellable = chromeState.$isBottomBarHidden
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyBottomBarVisibility(animated: true)
            }
    }

    private func observeChromeLayoutChanges() {
        chromeLayoutCancellable = Publishers.CombineLatest(chromeState.$isTopBarCollapsed, chromeState.$isBottomBarCollapsed)
            .receive(on: RunLoop.main)
            .sink { [weak self] _, _ in
                guard let self else { return }
                self.updateChromeSizeConstraints()
                UIView.animate(
                    withDuration: 0.32,
                    delay: 0,
                    usingSpringWithDamping: 0.9,
                    initialSpringVelocity: 0.2,
                    options: [.curveEaseInOut, .beginFromCurrentState]
                ) {
                    self.bottomChromeHostingVC.view.invalidateIntrinsicContentSize()
                    self.view.layoutIfNeeded()
                }
            }
    }

    private func resolvedTopChromeHeight() -> CGFloat {
        view.safeAreaInsets.top + 6
    }

    private func resolvedBottomChromeHeight() -> CGFloat {
        view.safeAreaInsets.bottom + (chromeState.isBottomBarCollapsed ? 42 : 64)
    }

    private func resolvedDrawerWidth() -> CGFloat {
        let screenWidth = max(view.bounds.width, UIScreen.main.bounds.width)
        return min(max(screenWidth * 0.84, 292), 340)
    }

    private func resolvedDrawerSlideOffset() -> CGFloat {
        min(resolvedDrawerWidth(), max(view.bounds.width - 52, 0))
    }

    private func updateChromeSizeConstraints() {
        topChromeHeightConstraint?.constant = resolvedTopChromeHeight()
        bottomChromeHeightConstraint?.constant = resolvedBottomChromeHeight()
    }

    private func updateDrawerWidthConstraint() {
        drawerWidthConstraint?.constant = resolvedDrawerWidth()
    }

    private func emitNativeDrawerState() {
        let plugin = DrawerBridge.shared.contentPlugin
        let payload = nativeDrawerStatePayload()
        print("[Drawer] emitNativeDrawerState contentPlugin=\(plugin != nil ? "ready" : "nil") path=\(payload["currentPath"] ?? "?")")
        plugin?.emitState(payload)
    }

    private func setNativeDrawerOpen(_ open: Bool, animated: Bool) {
        guard shouldUseNativeTopChrome else { return }

        let stateDidChange = nativeDrawerOpen != open || nativeDrawerState.isOpen != open
        nativeDrawerOpen = open
        nativeDrawerState.isOpen = open

        if stateDidChange {
            emitNativeDrawerState()
        }

        if open {
            drawerTapShieldView.isHidden = false
            view.bringSubviewToFront(drawerTapShieldView)
        }

        let applyState = {
            self.applyNativeDrawerVisualState(open: open)
        }

        let completion: (Bool) -> Void = { _ in
            self.mainShellContainerView.isUserInteractionEnabled = !open
            self.drawerTapShieldView.isHidden = !open
            self.layoutDrawerTapShield()
            // Re-emit state after drawer opens — the drawer WKWebView suspends JS
            // while hidden, so any state events sent while closed are lost.
            if open {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    self.emitNativeDrawerState()
                }
            }
        }

        if animated {
            UIView.animate(
                withDuration: 0.34,
                delay: 0,
                usingSpringWithDamping: 0.9,
                initialSpringVelocity: 0.18,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: applyState,
                completion: completion
            )
        } else {
            applyState()
            completion(true)
        }
    }

    private func applyNativeDrawerVisualState(open: Bool) {
        let slideOffset = open ? resolvedDrawerSlideOffset() : 0
        mainShellContainerView.transform = CGAffineTransform(translationX: slideOffset, y: 0)
        mainShellContainerView.layer.shadowOpacity = open ? 0.16 : 0
        drawerTapShieldView.alpha = open ? 1 : 0
        layoutDrawerTapShield()
    }

    private func layoutDrawerTapShield() {
        guard nativeDrawerOpen else {
            drawerTapShieldView.frame = .zero
            return
        }

        let originX = resolvedDrawerSlideOffset()
        drawerTapShieldView.frame = CGRect(
            x: originX,
            y: 0,
            width: max(view.bounds.width - originX, 0),
            height: view.bounds.height
        )
    }

    private func applyChromeVisibility(animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        updateChromeSizeConstraints()
        topChromeContainerView.isHidden = false
        topChromeContainerView.alpha = 1
        applyBottomBarVisibility(animated: animated)
    }

    private func applyBottomBarVisibility(animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        updateChromeSizeConstraints()

        let shouldShowBottomBar = chromeState.isVisible && !chromeState.isBottomBarHidden
        let hiddenOffset = max(bottomChromeContainerView.bounds.height, 96) + 12

        let animations = {
            if shouldShowBottomBar {
                self.bottomChromeContainerView.isHidden = false
                self.bottomChromeContainerView.alpha = 1
                self.bottomChromeContainerView.transform = .identity
            } else {
                self.bottomChromeContainerView.alpha = 0
                self.bottomChromeContainerView.transform = CGAffineTransform(translationX: 0, y: hiddenOffset)
            }
        }

        let completion: (Bool) -> Void = { _ in
            self.bottomChromeContainerView.isHidden = !shouldShowBottomBar
            self.bottomChromeContainerView.isUserInteractionEnabled = shouldShowBottomBar && !self.nativeDrawerOpen
        }

        if animated {
            UIView.animate(
                withDuration: 0.32,
                delay: 0,
                usingSpringWithDamping: 0.9,
                initialSpringVelocity: 0.18,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: animations,
                completion: completion
            )
        } else {
            animations()
            completion(true)
        }
    }

    @objc private func handleDrawerTapShield() {
        setNativeDrawerOpen(false, animated: true)
        dispatchDrawerEventToMainWebView(type: "close", payloadJson: nil)
    }

    @objc private func handleDrawerOpenEdgePan(_ recognizer: UIScreenEdgePanGestureRecognizer) {
        guard !nativeDrawerOpen else { return }

        let translation = recognizer.translation(in: view)
        guard abs(translation.y) <= drawerVerticalDriftTolerance else { return }

        if translation.x >= drawerOpenThreshold {
            setNativeDrawerOpen(true, animated: true)
            dispatchDrawerEventToMainWebView(type: "open", payloadJson: nil)
            recognizer.isEnabled = false
            recognizer.isEnabled = true
        }
    }

    @objc private func handleDrawerClosePan(_ recognizer: UIPanGestureRecognizer) {
        guard nativeDrawerOpen else { return }

        let translation = recognizer.translation(in: view)
        guard abs(translation.y) <= drawerVerticalDriftTolerance else { return }

        if translation.x <= drawerCloseThreshold {
            setNativeDrawerOpen(false, animated: true)
            dispatchDrawerEventToMainWebView(type: "close", payloadJson: nil)
            recognizer.isEnabled = false
            recognizer.isEnabled = true
        }
    }
}

private struct TopInsetGlassView: View {
    var body: some View {
        Rectangle()
            .fill(.ultraThinMaterial)
            .ignoresSafeArea()
    }
}
