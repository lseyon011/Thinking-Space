import UIKit
import SwiftUI
import Combine

enum DrawerSide {
    case left, right
}

/// Shared singleton so any plugin can reach the shell VC without wiring.
final class DrawerBridge {
    static let shared = DrawerBridge()
    weak var shellVC: RootShellViewController?
    weak var leftContentPlugin: NativeDrawerContentPlugin?
    weak var rightContentPlugin: NativeDrawerContentPlugin?
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

    // MARK: - Child VCs

    private lazy var bridgeVC: LTMBridgeViewController = {
        let vc = LTMBridgeViewController()
        vc.rootShellVC = self
        return vc
    }()
    private lazy var leftDrawerBridgeVC: LTMDrawerBridgeViewController = {
        LTMDrawerBridgeViewController(side: .left)
    }()
    private lazy var rightDrawerBridgeVC: LTMDrawerBridgeViewController = {
        LTMDrawerBridgeViewController(side: .right)
    }()

    let chromeState = TopChromeState()
    private var chromePlugin: TopChromePlugin?
    private var chromeVisibilityCancellable: AnyCancellable?
    private var bottomBarVisibilityCancellable: AnyCancellable?
    private var chromeLayoutCancellable: AnyCancellable?
    private var topChromeHeightConstraint: NSLayoutConstraint?
    private var bottomChromeHeightConstraint: NSLayoutConstraint?

    // MARK: - Drawer state

    private var nativeDrawerState = NativeDrawerShellStateRecord()
    /// Which drawer is currently open, or nil if both are closed.
    private var openDrawerSide: DrawerSide?

    private var leftDrawerWidthConstraint: NSLayoutConstraint?
    private var rightDrawerWidthConstraint: NSLayoutConstraint?

    // MARK: - Native drawer headers

    let leftDrawerHeaderState = DrawerHeaderState(sectionLabel: "Sidebar", title: "Explorer")
    let rightDrawerHeaderState = DrawerHeaderState(sectionLabel: "Navigation", title: "Thinking Space")

    private lazy var leftDrawerHeaderHostingVC: UIHostingController<DrawerHeaderView> = {
        UIHostingController(rootView: DrawerHeaderView(
            state: leftDrawerHeaderState,
            onClose: { [weak self] in
                guard let self else { return }
                self.closeDrawer(animated: true)
                self.dispatchDrawerEventToMainWebView(type: "close", side: .left, payloadJson: nil)
            }
        ))
    }()

    private lazy var rightDrawerHeaderHostingVC: UIHostingController<DrawerHeaderView> = {
        UIHostingController(rootView: DrawerHeaderView(
            state: rightDrawerHeaderState,
            onClose: { [weak self] in
                guard let self else { return }
                self.closeDrawer(animated: true)
                self.dispatchDrawerEventToMainWebView(type: "close", side: .right, payloadJson: nil)
            }
        ))
    }()

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

    // MARK: - Container views

    private let mainShellContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .clear
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOffset = .zero
        view.layer.shadowRadius = 28
        view.layer.shadowOpacity = 0
        return view
    }()

    /// Warm beige matching the drawer header gradient — #f5f3ee
    private static let drawerBackgroundColor = UIColor(
        red: 245.0 / 255.0, green: 243.0 / 255.0, blue: 238.0 / 255.0, alpha: 1.0
    )

    private let leftDrawerContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = drawerBackgroundColor
        view.clipsToBounds = true
        return view
    }()

    private let rightDrawerContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = drawerBackgroundColor
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

    // MARK: - Gesture recognizers

    private lazy var leftEdgeGestureRecognizer: UIScreenEdgePanGestureRecognizer = {
        let recognizer = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleLeftEdgePan(_:)))
        recognizer.edges = .left
        return recognizer
    }()

    private lazy var rightEdgeGestureRecognizer: UIScreenEdgePanGestureRecognizer = {
        let recognizer = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(handleRightEdgePan(_:)))
        recognizer.edges = .right
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

    // MARK: - Lifecycle

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
        updateDrawerWidthConstraints()
        applyChromeVisibility(animated: false)
        applyBottomBarVisibility(animated: false)
        applyDrawerVisualState()
    }

    // MARK: - Public API

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

    func updateNativeDrawerState(_ nextState: NativeDrawerShellStateRecord, open: Bool? = nil, side: DrawerSide? = nil) {
        DispatchQueue.main.async {
            self.nativeDrawerState.kind = nextState.kind
            self.nativeDrawerState.title = nextState.title
            self.nativeDrawerState.currentPath = nextState.currentPath
            self.nativeDrawerState.currentSearch = nextState.currentSearch
            self.updateDrawerHeaders()
            self.emitDrawerState()

            if let open {
                let drawerSide = side ?? .left
                if open {
                    self.openDrawer(drawerSide, animated: true)
                } else {
                    self.closeDrawer(animated: true)
                }
            }
        }
    }

    private func updateDrawerHeaders() {
        leftDrawerHeaderState.title = sidebarLabelForPath(nativeDrawerState.currentPath)
        rightDrawerHeaderState.title = nativeDrawerState.title.isEmpty ? "Thinking Space" : nativeDrawerState.title
    }

    private func sidebarLabelForPath(_ path: String) -> String {
        switch path {
        case "/thinking-space": return "Explorer"
        case "/thinking-organizer": return "Organizer"
        case "/chat": return "AI"
        case "/web": return "Web"
        case "/new-thought": return "New Note"
        case "/git-insights": return "Insights"
        case "/password-manager": return "Passwords"
        default: return nativeDrawerState.title.isEmpty ? "Sidebar" : nativeDrawerState.title
        }
    }

    func handleNativeDrawerAction(type: String, payloadJson: String?, side: DrawerSide) {
        DispatchQueue.main.async {
            switch type {
            case "close":
                self.closeDrawer(animated: true)
                self.dispatchDrawerEventToMainWebView(type: "close", side: side, payloadJson: nil)
            case "navigate":
                self.closeDrawer(animated: true)
                self.dispatchDrawerEventToMainWebView(type: "navigate", side: side, payloadJson: payloadJson)
            default:
                // Pass through any other action types (e.g. open-file, select-ai, etc.)
                self.closeDrawer(animated: true)
                self.dispatchDrawerEventToMainWebView(type: type, side: side, payloadJson: payloadJson)
            }
        }
    }

    func nativeDrawerStatePayload() -> [String: Any] {
        nativeDrawerState.asPayload()
    }

    // MARK: - Event dispatch to main web view

    private func dispatchDrawerEventToMainWebView(type: String, side: DrawerSide, payloadJson: String?) {
        let detail: [String: String] = [
            "type": type,
            "side": side == .left ? "left" : "right",
            "payloadJson": payloadJson ?? "",
        ]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: detail),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        let js = "window.dispatchEvent(new CustomEvent('native-drawer-action', { detail: \(jsonString) }));"
        bridgeVC.webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Shell layout

    private func configurePhoneShell() {
        topChromeContainerView.backgroundColor = .clear
        bottomChromeContainerView.backgroundColor = .clear
        topInsetHostingVC.view.backgroundColor = .clear
        bottomChromeHostingVC.view.backgroundColor = .clear
        bridgeVC.view.backgroundColor = shellBackgroundColor
        leftDrawerBridgeVC.view.backgroundColor = shellBackgroundColor
        rightDrawerBridgeVC.view.backgroundColor = shellBackgroundColor

        view.addSubview(leftDrawerContainerView)
        view.addSubview(rightDrawerContainerView)
        view.addSubview(mainShellContainerView)

        NSLayoutConstraint.activate([
            mainShellContainerView.topAnchor.constraint(equalTo: view.topAnchor),
            mainShellContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            mainShellContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            mainShellContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        embedLeftDrawer()
        embedRightDrawer()
        configureDrawerTapShield()
        embedTopInsetGlass()
        embedBridgeBelowTopInset()
        embedBottomChromeOverlay()
        setupDrawerGestures()

        view.bringSubviewToFront(mainShellContainerView)
        view.bringSubviewToFront(drawerTapShieldView)
    }

    private func embedLeftDrawer() {
        // Native header above the WebView content
        let headerVC = leftDrawerHeaderHostingVC
        headerVC.view.backgroundColor = .clear
        addChild(headerVC)
        leftDrawerContainerView.addSubview(headerVC.view)
        headerVC.view.translatesAutoresizingMaskIntoConstraints = false

        // WebView content below the header
        addChild(leftDrawerBridgeVC)
        leftDrawerContainerView.addSubview(leftDrawerBridgeVC.view)
        leftDrawerBridgeVC.view.translatesAutoresizingMaskIntoConstraints = false

        let widthConstraint = leftDrawerContainerView.widthAnchor.constraint(equalToConstant: resolvedDrawerWidth())
        leftDrawerWidthConstraint = widthConstraint

        NSLayoutConstraint.activate([
            leftDrawerContainerView.topAnchor.constraint(equalTo: view.topAnchor),
            leftDrawerContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            leftDrawerContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            widthConstraint,
            // Header: top of container → intrinsic height
            headerVC.view.topAnchor.constraint(equalTo: leftDrawerContainerView.safeAreaLayoutGuide.topAnchor),
            headerVC.view.leadingAnchor.constraint(equalTo: leftDrawerContainerView.leadingAnchor),
            headerVC.view.trailingAnchor.constraint(equalTo: leftDrawerContainerView.trailingAnchor),
            // WebView: below header → bottom of container
            leftDrawerBridgeVC.view.topAnchor.constraint(equalTo: headerVC.view.bottomAnchor),
            leftDrawerBridgeVC.view.leadingAnchor.constraint(equalTo: leftDrawerContainerView.leadingAnchor),
            leftDrawerBridgeVC.view.trailingAnchor.constraint(equalTo: leftDrawerContainerView.trailingAnchor),
            leftDrawerBridgeVC.view.bottomAnchor.constraint(equalTo: leftDrawerContainerView.bottomAnchor),
        ])

        headerVC.didMove(toParent: self)
        leftDrawerBridgeVC.didMove(toParent: self)
    }

    private func embedRightDrawer() {
        // Native header above the WebView content
        let headerVC = rightDrawerHeaderHostingVC
        headerVC.view.backgroundColor = .clear
        addChild(headerVC)
        rightDrawerContainerView.addSubview(headerVC.view)
        headerVC.view.translatesAutoresizingMaskIntoConstraints = false

        // WebView content below the header
        addChild(rightDrawerBridgeVC)
        rightDrawerContainerView.addSubview(rightDrawerBridgeVC.view)
        rightDrawerBridgeVC.view.translatesAutoresizingMaskIntoConstraints = false

        let widthConstraint = rightDrawerContainerView.widthAnchor.constraint(equalToConstant: resolvedDrawerWidth())
        rightDrawerWidthConstraint = widthConstraint

        NSLayoutConstraint.activate([
            rightDrawerContainerView.topAnchor.constraint(equalTo: view.topAnchor),
            rightDrawerContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            rightDrawerContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            widthConstraint,
            // Header: top of container → intrinsic height
            headerVC.view.topAnchor.constraint(equalTo: rightDrawerContainerView.safeAreaLayoutGuide.topAnchor),
            headerVC.view.leadingAnchor.constraint(equalTo: rightDrawerContainerView.leadingAnchor),
            headerVC.view.trailingAnchor.constraint(equalTo: rightDrawerContainerView.trailingAnchor),
            // WebView: below header → bottom of container
            rightDrawerBridgeVC.view.topAnchor.constraint(equalTo: headerVC.view.bottomAnchor),
            rightDrawerBridgeVC.view.leadingAnchor.constraint(equalTo: rightDrawerContainerView.leadingAnchor),
            rightDrawerBridgeVC.view.trailingAnchor.constraint(equalTo: rightDrawerContainerView.trailingAnchor),
            rightDrawerBridgeVC.view.bottomAnchor.constraint(equalTo: rightDrawerContainerView.bottomAnchor),
        ])

        headerVC.didMove(toParent: self)
        rightDrawerBridgeVC.didMove(toParent: self)
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
        view.addGestureRecognizer(leftEdgeGestureRecognizer)
        view.addGestureRecognizer(rightEdgeGestureRecognizer)
    }

    // MARK: - Chrome observers

    private func observeChromeVisibility() {
        chromeVisibilityCancellable = chromeState.$isVisible
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.applyChromeVisibility(animated: true) }
    }

    private func observeBottomBarVisibility() {
        bottomBarVisibilityCancellable = chromeState.$isBottomBarHidden
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.applyBottomBarVisibility(animated: true) }
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

    // MARK: - Layout helpers

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

    private func updateDrawerWidthConstraints() {
        let w = resolvedDrawerWidth()
        leftDrawerWidthConstraint?.constant = w
        rightDrawerWidthConstraint?.constant = w
    }

    // MARK: - Drawer state emission

    private func emitDrawerState() {
        let payload = nativeDrawerStatePayload()
        DrawerBridge.shared.leftContentPlugin?.emitState(payload)
        DrawerBridge.shared.rightContentPlugin?.emitState(payload)
    }

    // MARK: - Drawer open/close

    private func openDrawer(_ side: DrawerSide, animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        // Close opposite drawer first if open
        if let current = openDrawerSide, current != side {
            closeDrawer(animated: false)
        }

        let wasOpen = openDrawerSide != nil
        openDrawerSide = side
        nativeDrawerState.isOpen = true

        if !wasOpen {
            emitDrawerState()
        }

        drawerTapShieldView.isHidden = false
        view.bringSubviewToFront(drawerTapShieldView)

        let applyState = { self.applyDrawerVisualState() }

        let completion: (Bool) -> Void = { _ in
            self.mainShellContainerView.isUserInteractionEnabled = false
            self.drawerTapShieldView.isHidden = false
            self.layoutDrawerTapShield()
        }

        if animated {
            UIView.animate(
                withDuration: 0.34, delay: 0,
                usingSpringWithDamping: 0.9, initialSpringVelocity: 0.18,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: applyState, completion: completion
            )
        } else {
            applyState()
            completion(true)
        }
    }

    private func closeDrawer(animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        guard openDrawerSide != nil else { return }

        openDrawerSide = nil
        nativeDrawerState.isOpen = false
        emitDrawerState()

        let applyState = { self.applyDrawerVisualState() }

        let completion: (Bool) -> Void = { _ in
            self.mainShellContainerView.isUserInteractionEnabled = true
            self.drawerTapShieldView.isHidden = true
            self.layoutDrawerTapShield()
        }

        if animated {
            UIView.animate(
                withDuration: 0.34, delay: 0,
                usingSpringWithDamping: 0.9, initialSpringVelocity: 0.18,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: applyState, completion: completion
            )
        } else {
            applyState()
            completion(true)
        }
    }

    private func applyDrawerVisualState() {
        let offset = resolvedDrawerSlideOffset()
        // NOTE: We never set isHidden on drawer containers. WKWebView suspends
        // JavaScript when its hosting view is hidden, causing stale/missing
        // content when the drawer reopens. Instead, drawers live behind the
        // main shell container (z-order) and are naturally occluded when closed.
        // We only toggle isUserInteractionEnabled for hit-testing.
        switch openDrawerSide {
        case .left:
            leftDrawerContainerView.isUserInteractionEnabled = true
            rightDrawerContainerView.isUserInteractionEnabled = false
            mainShellContainerView.transform = CGAffineTransform(translationX: offset, y: 0)
            mainShellContainerView.layer.shadowOffset = CGSize(width: -10, height: 0)
            mainShellContainerView.layer.shadowOpacity = 0.16
        case .right:
            leftDrawerContainerView.isUserInteractionEnabled = false
            rightDrawerContainerView.isUserInteractionEnabled = true
            mainShellContainerView.transform = CGAffineTransform(translationX: -offset, y: 0)
            mainShellContainerView.layer.shadowOffset = CGSize(width: 10, height: 0)
            mainShellContainerView.layer.shadowOpacity = 0.16
        case nil:
            leftDrawerContainerView.isUserInteractionEnabled = false
            rightDrawerContainerView.isUserInteractionEnabled = false
            mainShellContainerView.transform = .identity
            mainShellContainerView.layer.shadowOpacity = 0
        }
        drawerTapShieldView.alpha = openDrawerSide != nil ? 1 : 0
        layoutDrawerTapShield()
    }

    private func layoutDrawerTapShield() {
        guard let side = openDrawerSide else {
            drawerTapShieldView.frame = .zero
            return
        }

        let offset = resolvedDrawerSlideOffset()
        switch side {
        case .left:
            drawerTapShieldView.frame = CGRect(
                x: offset, y: 0,
                width: max(view.bounds.width - offset, 0),
                height: view.bounds.height
            )
        case .right:
            drawerTapShieldView.frame = CGRect(
                x: 0, y: 0,
                width: max(view.bounds.width - offset, 0),
                height: view.bounds.height
            )
        }
    }

    // MARK: - Chrome visibility

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
            self.bottomChromeContainerView.isUserInteractionEnabled = shouldShowBottomBar && self.openDrawerSide == nil
        }

        if animated {
            UIView.animate(
                withDuration: 0.32, delay: 0,
                usingSpringWithDamping: 0.9, initialSpringVelocity: 0.18,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: animations, completion: completion
            )
        } else {
            animations()
            completion(true)
        }
    }

    // MARK: - Gesture handlers

    @objc private func handleDrawerTapShield() {
        let side = openDrawerSide ?? .left
        closeDrawer(animated: true)
        dispatchDrawerEventToMainWebView(type: "close", side: side, payloadJson: nil)
    }

    @objc private func handleLeftEdgePan(_ recognizer: UIScreenEdgePanGestureRecognizer) {
        guard openDrawerSide == nil else { return }
        let translation = recognizer.translation(in: view)
        guard abs(translation.y) <= drawerVerticalDriftTolerance else { return }

        if translation.x >= drawerOpenThreshold {
            openDrawer(.left, animated: true)
            dispatchDrawerEventToMainWebView(type: "open", side: .left, payloadJson: nil)
            recognizer.isEnabled = false
            recognizer.isEnabled = true
        }
    }

    @objc private func handleRightEdgePan(_ recognizer: UIScreenEdgePanGestureRecognizer) {
        guard openDrawerSide == nil else { return }
        let translation = recognizer.translation(in: view)
        guard abs(translation.y) <= drawerVerticalDriftTolerance else { return }

        if translation.x <= drawerCloseThreshold {
            openDrawer(.right, animated: true)
            dispatchDrawerEventToMainWebView(type: "open", side: .right, payloadJson: nil)
            recognizer.isEnabled = false
            recognizer.isEnabled = true
        }
    }

    @objc private func handleDrawerClosePan(_ recognizer: UIPanGestureRecognizer) {
        guard let side = openDrawerSide else { return }
        let translation = recognizer.translation(in: view)
        guard abs(translation.y) <= drawerVerticalDriftTolerance else { return }

        let shouldClose: Bool
        switch side {
        case .left:
            shouldClose = translation.x <= drawerCloseThreshold
        case .right:
            shouldClose = translation.x >= drawerOpenThreshold
        }

        if shouldClose {
            closeDrawer(animated: true)
            dispatchDrawerEventToMainWebView(type: "close", side: side, payloadJson: nil)
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
