import UIKit
import Capacitor
import UniformTypeIdentifiers
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {
        // Dismiss any inline WKWebView overlay so it doesn't persist
        // over the iOS app switcher or home screen.
        if let vc = window?.rootViewController as? RootShellViewController {
            vc.dismissInlineWebView()
        }
    }
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

// MARK: - Custom Bridge ViewController
// Subclass CAPBridgeViewController to register local plugins.
// Main.storyboard must reference "RootShellViewController" as the custom class.

class LTMBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    /// Set by RootShellViewController so that the bridge can wire plugins back.
    weak var rootShellVC: RootShellViewController?

    /// TopChromePlugin needs deferred wiring if rootShellVC isn't available during init.
    private var pendingTopChromePlugin: TopChromePlugin?

    private let shellBackgroundColor = UIColor(
        red: 242.0 / 255.0,
        green: 242.0 / 255.0,
        blue: 247.0 / 255.0,
        alpha: 1.0
    )

    private var inlineWebViewPlugin: InlineWebViewPlugin?
    private var scrollObserver: NSKeyValueObservation?
    private var lastScrollOffset: CGFloat = 0
    
    // Scroll thresholds for chrome collapse behavior
    private let topChromeCollapseThreshold: CGFloat = 50
    private let bottomChromeCollapseThreshold: CGFloat = 150

    override open func viewDidLoad() {
        super.viewDidLoad()
        configureShellSurface()
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        configureShellSurface()
        bridge?.registerPluginInstance(FolderPickerPlugin())
        bridge?.registerPluginInstance(PencilEventsPlugin())
        let webViewPlugin = InlineWebViewPlugin()
        inlineWebViewPlugin = webViewPlugin
        bridge?.registerPluginInstance(webViewPlugin)
        let topChromePlugin = TopChromePlugin()
        bridge?.registerPluginInstance(topChromePlugin)
        bridge?.registerPluginInstance(NativeDrawerShellPlugin())

        let host = rootShellVC ?? (parent as? RootShellViewController)
        if let host {
            host.wireTopChromePlugin(topChromePlugin)
        } else {
            pendingTopChromePlugin = topChromePlugin
        }
    }
    
    override open func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        // Set up native scroll detection on iPhone after view appears
        if UIDevice.current.userInterfaceIdiom == .phone && scrollObserver == nil {
            setupScrollDetection()
            
            // Register message handler for JS scroll events
            if let webView = webView ?? bridge?.webView {
                webView.configuration.userContentController.add(self, name: "chromeScroll")
                print("[Chrome] ✅ Registered chromeScroll message handler")
            }
        }
    }
    
    // WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "chromeScroll",
              let body = message.body as? [String: Any],
              let scrollY = body["scrollY"] as? Double,
              let direction = body["direction"] as? String else {
            return
        }
        
        print("[Chrome] 🌐 JS scroll event: \(Int(scrollY))pt, direction: \(direction)")
        
        let scrollDirection: ScrollDirection = direction == "down" ? .down : .up
        updateChromeForScroll(offsetY: CGFloat(scrollY), direction: scrollDirection)
    }

    func dismissInlineWebView() {
        inlineWebViewPlugin?.closeWebView()
    }

    /// Called by RootShellViewController after the main bridge is fully embedded.
    func wirePendingPluginsIfNeeded(to host: RootShellViewController) {
        if let plugin = pendingTopChromePlugin {
            pendingTopChromePlugin = nil
            host.wireTopChromePlugin(plugin)
        }
    }

    private func configureShellSurface() {
        view.backgroundColor = shellBackgroundColor
        guard let nativeWebView = webView ?? bridge?.webView else { return }
        nativeWebView.isOpaque = false
        nativeWebView.backgroundColor = shellBackgroundColor
        nativeWebView.scrollView.backgroundColor = shellBackgroundColor

        if #available(iOS 11.0, *) {
            nativeWebView.scrollView.contentInsetAdjustmentBehavior = .automatic
        }
        
        // Keep original scroll settings - changing these broke scrolling!
        nativeWebView.scrollView.bounces = false
        nativeWebView.scrollView.alwaysBounceVertical = false
        nativeWebView.scrollView.alwaysBounceHorizontal = false
        
        print("[Chrome] 📱 Configured webView scrollView")
    }
    
    private func setupScrollDetection() {
        guard let webView = webView ?? bridge?.webView else {
            print("[Chrome] ⚠️ WebView not available for scroll detection")
            return
        }
        
        print("[Chrome] ✅ Setting up scroll detection")
        print("[Chrome] 📊 WebView scrollView contentSize: \(webView.scrollView.contentSize)")
        print("[Chrome] 📊 WebView scrollView frame: \(webView.scrollView.frame)")
        
        // Method 1: Observe native scrollView
        scrollObserver = webView.scrollView.observe(\.contentOffset, options: [.new, .old]) { [weak self] scrollView, change in
            guard let self = self else { return }
            
            let offsetY = scrollView.contentOffset.y
            let scrollDirection: ScrollDirection = offsetY > self.lastScrollOffset ? .down : .up
            
            if abs(offsetY - self.lastScrollOffset) > 5 {
                print("[Chrome] 📍 Native scroll: \(Int(offsetY))pt, direction: \(scrollDirection)")
            }
            
            self.updateChromeForScroll(offsetY: offsetY, direction: scrollDirection)
            self.lastScrollOffset = offsetY
        }
        
        // Method 2: Inject JavaScript to detect web-side scroll events
        let scrollDetectionJS = """
        (function() {
            let lastScrollY = 0;
            let ticking = false;
            
            function detectScroll() {
                const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
                
                if (Math.abs(scrollY - lastScrollY) > 5) {
                    const direction = scrollY > lastScrollY ? 'down' : 'up';
                    
                    // Send scroll info to native side
                    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.chromeScroll) {
                        window.webkit.messageHandlers.chromeScroll.postMessage({
                            scrollY: scrollY,
                            direction: direction
                        });
                    }
                    
                    // Also try via TopChrome plugin if available
                    if (window.TopChrome && window.TopChrome.setState) {
                        const shouldCollapseTop = direction === 'down' && scrollY > 50;
                        const shouldCollapseBottom = direction === 'down' && scrollY > 150;
                        
                        window.TopChrome.setState({
                            topBarCollapsed: shouldCollapseTop,
                            bottomBarCollapsed: shouldCollapseBottom
                        });
                    }
                    
                    lastScrollY = scrollY;
                }
                
                ticking = false;
            }
            
            function requestTick() {
                if (!ticking) {
                    window.requestAnimationFrame(detectScroll);
                    ticking = true;
                }
            }
            
            // Listen to both window scroll and all scroll events
            window.addEventListener('scroll', requestTick, { passive: true });
            document.addEventListener('scroll', requestTick, { passive: true, capture: true });
            
            console.log('[Chrome] 🌐 JavaScript scroll detection installed');
        })();
        """
        
        webView.evaluateJavaScript(scrollDetectionJS) { result, error in
            if let error = error {
                print("[Chrome] ⚠️ Failed to inject scroll detection JS: \(error)")
            } else {
                print("[Chrome] ✅ JavaScript scroll detection injected")
            }
        }
    }
    
    private enum ScrollDirection {
        case up, down
    }
    
    private func updateChromeForScroll(offsetY: CGFloat, direction: ScrollDirection) {
        guard let rootVC = rootShellVC ?? (parent as? RootShellViewController) else {
            print("[Chrome] ⚠️ Parent is not RootShellViewController")
            return
        }
        let chromeState = rootVC.chromeState
        
        // Determine if top chrome should be collapsed
        let shouldCollapseTop: Bool
        if direction == .down && offsetY > topChromeCollapseThreshold {
            shouldCollapseTop = true
        } else if direction == .up || offsetY < 10 {
            shouldCollapseTop = false
        } else {
            shouldCollapseTop = chromeState.isTopBarCollapsed
        }
        
        // Determine if bottom chrome should be collapsed
        let shouldCollapseBottom: Bool
        if direction == .down && offsetY > bottomChromeCollapseThreshold {
            shouldCollapseBottom = true
        } else if direction == .up || offsetY < 100 {
            shouldCollapseBottom = false
        } else {
            shouldCollapseBottom = chromeState.isBottomBarCollapsed
        }
        
        // Only update if state changed (avoid unnecessary updates)
        if shouldCollapseTop != chromeState.isTopBarCollapsed {
            print("[Chrome] 🔄 Top chrome: \(shouldCollapseTop ? "COLLAPSED" : "EXPANDED")")
            chromeState.isTopBarCollapsed = shouldCollapseTop
        }
        
        if shouldCollapseBottom != chromeState.isBottomBarCollapsed {
            print("[Chrome] 🔄 Bottom chrome: \(shouldCollapseBottom ? "COLLAPSED" : "EXPANDED")")
            chromeState.isBottomBarCollapsed = shouldCollapseBottom
        }
    }
    
    deinit {
        scrollObserver?.invalidate()
        
        // Clean up message handler
        if let webView = webView ?? bridge?.webView {
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "chromeScroll")
        }
    }
}

class LTMDrawerBridgeViewController: CAPBridgeViewController {
    let side: DrawerSide

    private let shellBackgroundColor = UIColor(
        red: 245.0 / 255.0,
        green: 243.0 / 255.0,
        blue: 238.0 / 255.0,
        alpha: 1.0
    )

    init(side: DrawerSide = .left) {
        self.side = side
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }

    override open func viewDidLoad() {
        super.viewDidLoad()
        configureDrawerSurface()
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        configureDrawerSurface()

        let contentPlugin = NativeDrawerContentPlugin(drawerSide: side)
        bridge?.registerPluginInstance(contentPlugin)
        switch side {
        case .left:
            DrawerBridge.shared.leftContentPlugin = contentPlugin
        case .right:
            DrawerBridge.shared.rightContentPlugin = contentPlugin
        }
    }

    private func configureDrawerSurface() {
        view.backgroundColor = shellBackgroundColor
        guard let nativeWebView = webView ?? bridge?.webView else { return }
        nativeWebView.isOpaque = false
        nativeWebView.backgroundColor = shellBackgroundColor
        nativeWebView.scrollView.backgroundColor = shellBackgroundColor
        // .never: the native SwiftUI header already handles safe area.
        // .automatic would add extra top insets inside the WebView, causing
        // content to render below the native header (overlapping) and breaking scroll.
        nativeWebView.scrollView.contentInsetAdjustmentBehavior = .never

        let sideString = side == .left ? "left" : "right"
        let hashRoute = "#/native-drawer-\(sideString)"

        let userContentController = nativeWebView.configuration.userContentController
        let alreadyInstalled = userContentController.userScripts.contains {
            $0.source.contains("__LTM_NATIVE_DRAWER__")
        }
        if !alreadyInstalled {
            let markerScript = WKUserScript(
                source: """
                window.__LTM_NATIVE_DRAWER__ = true;
                window.__LTM_NATIVE_DRAWER_SIDE__ = '\(sideString)';
                window.__LTM_NATIVE_DRAWER_EMBEDDED__ = true;
                if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#') {
                    window.location.hash = '\(hashRoute)';
                }
                """,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            userContentController.addUserScript(markerScript)
        }
    }
}

@objc(NativeDrawerShellPlugin)
public class NativeDrawerShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeDrawerShellPlugin"
    public let jsName = "NativeDrawerShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openLeft", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openRight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addListener", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),
    ]

    private var shell: RootShellViewController? { DrawerBridge.shared.shellVC }

    @objc func setState(_ call: CAPPluginCall) {
        var nextState = NativeDrawerShellStateRecord()
        nextState.kind = call.getString("kind") ?? nextState.kind
        nextState.title = call.getString("title") ?? nextState.title
        nextState.currentPath = call.getString("currentPath") ?? nextState.currentPath
        nextState.currentSearch = call.getString("currentSearch") ?? nextState.currentSearch
        shell?.updateNativeDrawerState(nextState, open: call.getBool("open"))
        call.resolve()
    }

    @objc func openLeft(_ call: CAPPluginCall) {
        if let shell {
            shell.updateNativeDrawerState(shell.currentDrawerState(isOpen: true), open: true, side: .left)
        }
        call.resolve()
    }

    @objc func openRight(_ call: CAPPluginCall) {
        if let shell {
            shell.updateNativeDrawerState(shell.currentDrawerState(isOpen: true), open: true, side: .right)
        }
        call.resolve()
    }

    @objc func close(_ call: CAPPluginCall) {
        if let shell {
            shell.updateNativeDrawerState(shell.currentDrawerState(isOpen: false), open: false)
        }
        call.resolve()
    }
}

@objc(NativeDrawerContentPlugin)
public class NativeDrawerContentPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeDrawerContentPlugin"
    public let jsName = "NativeDrawerContent"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "postAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addListener", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),
    ]

    private let drawerSide: DrawerSide
    private var shell: RootShellViewController? { DrawerBridge.shared.shellVC }

    init(drawerSide: DrawerSide = .left) {
        self.drawerSide = drawerSide
        super.init()
    }

    @objc func getState(_ call: CAPPluginCall) {
        call.resolve(shell?.nativeDrawerStatePayload() ?? NativeDrawerShellStateRecord().asPayload())
    }

    @objc func postAction(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? ""
        let payloadJson = call.getString("payloadJson")
        shell?.handleNativeDrawerAction(type: type, payloadJson: payloadJson, side: drawerSide)
        call.resolve()
    }

    func emitState(_ payload: [String: Any]) {
        notifyListeners("nativeDrawerState", data: payload)
    }
}

// MARK: - FolderPickerPlugin

/// Native Capacitor plugin that opens the iOS document picker for folder selection.
/// Shows both local storage and iCloud Drive. Bookmarks the selected folder
/// for persistent access across app launches.
@objc(FolderPickerPlugin)
public class FolderPickerPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FolderPickerPlugin"
    public let jsName = "FolderPicker"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restoreBookmark", returnType: CAPPluginReturnPromise),
    ]

    private var pendingCall: CAPPluginCall?

    @objc func pickFolder(_ call: CAPPluginCall) {
        self.pendingCall = call

        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    @objc func restoreBookmark(_ call: CAPPluginCall) {
        guard let bookmarkData = UserDefaults.standard.data(forKey: "vault-folder-bookmark") else {
            call.reject("No bookmark saved")
            return
        }

        do {
            var isStale = false
            let url = try URL(
                resolvingBookmarkData: bookmarkData,
                options: [],
                relativeTo: nil,
                bookmarkDataIsStale: &isStale
            )

            let accessing = url.startAccessingSecurityScopedResource()

            if isStale {
                if let newData = try? url.bookmarkData(
                    options: .minimalBookmark,
                    includingResourceValuesForKeys: nil,
                    relativeTo: nil
                ) {
                    UserDefaults.standard.set(newData, forKey: "vault-folder-bookmark")
                }
            }

            call.resolve([
                "url": url.path,
                "accessing": accessing,
            ])
        } catch {
            call.reject("Failed to restore bookmark: \(error.localizedDescription)")
        }
    }

    // MARK: - UIDocumentPickerDelegate

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else {
            pendingCall?.reject("No folder selected")
            pendingCall = nil
            return
        }

        let accessing = url.startAccessingSecurityScopedResource()

        do {
            let bookmarkData = try url.bookmarkData(
                options: .minimalBookmark,
                includingResourceValuesForKeys: nil,
                relativeTo: nil
            )
            UserDefaults.standard.set(bookmarkData, forKey: "vault-folder-bookmark")
        } catch {
            print("Failed to create bookmark: \(error)")
        }

        pendingCall?.resolve([
            "url": url.path,
            "accessing": accessing,
        ])
        pendingCall = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingCall?.reject("User cancelled folder selection")
        pendingCall = nil
    }
}

// MARK: - PencilEventsPlugin

/// Native Capacitor plugin that exposes Apple Pencil signals to the web layer.
/// Emits:
/// - `pencilDoubleTap`
/// - `pencilMetrics` (force/tilt/azimuth/location samples)
@objc(PencilEventsPlugin)
public class PencilEventsPlugin: CAPPlugin, CAPBridgedPlugin, UIPencilInteractionDelegate, UIGestureRecognizerDelegate {
    public let identifier = "PencilEventsPlugin"
    public let jsName = "PencilEvents"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addListener", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),
    ]

    private var monitoring = false
    private var pencilInteraction: UIPencilInteraction?
    private var samplingGesture: PencilSamplingGestureRecognizer?

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.startMonitoring()
            call.resolve([
                "monitoring": self.monitoring,
            ])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopMonitoring()
            call.resolve([
                "monitoring": self.monitoring,
            ])
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve([
            "monitoring": monitoring,
            "supportsPencilInteraction": true,
        ])
    }

    private func startMonitoring() {
        if monitoring { return }
        guard let targetView = bridge?.webView ?? bridge?.viewController?.view else {
            return
        }

        if #available(iOS 12.1, *) {
            let interaction = UIPencilInteraction()
            interaction.delegate = self
            targetView.addInteraction(interaction)
            pencilInteraction = interaction
        }

        let recognizer = PencilSamplingGestureRecognizer()
        recognizer.cancelsTouchesInView = false
        recognizer.delaysTouchesBegan = false
        recognizer.delaysTouchesEnded = false
        recognizer.delegate = self
        recognizer.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
        recognizer.onSample = { [weak self, weak targetView] touch, phase in
            self?.emitPencilMetrics(touch: touch, phase: phase, in: targetView)
        }
        targetView.addGestureRecognizer(recognizer)
        samplingGesture = recognizer

        monitoring = true
    }

    private func stopMonitoring() {
        if let recognizer = samplingGesture {
            recognizer.view?.removeGestureRecognizer(recognizer)
        }
        samplingGesture = nil

        if let interaction = pencilInteraction {
            bridge?.webView?.removeInteraction(interaction)
            bridge?.viewController?.view.removeInteraction(interaction)
        }
        pencilInteraction = nil
        monitoring = false
    }

    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        return touch.type == .pencil
    }

    public func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        return true
    }

    @available(iOS 12.1, *)
    public func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        notifyListeners("pencilDoubleTap", data: [
            "timestamp": Date().timeIntervalSince1970 * 1000,
            "preferredAction": preferredActionLabel(UIPencilInteraction.preferredTapAction),
        ])
    }

    private func emitPencilMetrics(touch: UITouch, phase: String, in view: UIView?) {
        var payload: [String: Any] = [
            "phase": phase,
            "timestamp": Date().timeIntervalSince1970 * 1000,
        ]

        let force = touch.force
        let maxForce = touch.maximumPossibleForce
        if force.isFinite { payload["force"] = force }
        if maxForce.isFinite && maxForce > 0 {
            payload["maxForce"] = maxForce
            payload["normalizedPressure"] = max(0, min(force / maxForce, 1))
        }

        let altitude = touch.altitudeAngle
        if altitude.isFinite { payload["altitudeAngle"] = altitude }

        if let view {
            let azimuth = touch.azimuthAngle(in: view)
            if azimuth.isFinite { payload["azimuthAngle"] = azimuth }
            let point = touch.preciseLocation(in: view)
            if point.x.isFinite { payload["locationX"] = point.x }
            if point.y.isFinite { payload["locationY"] = point.y }
        }

        notifyListeners("pencilMetrics", data: payload)
    }

    @available(iOS 12.1, *)
    private func preferredActionLabel(_ action: UIPencilPreferredAction) -> String {
        switch action {
        case .switchEraser:
            return "switchEraser"
        case .switchPrevious:
            return "switchPrevious"
        case .showColorPalette:
            return "showColorPalette"
        case .ignore:
            return "ignore"
        @unknown default:
            return "unknown"
        }
    }

    deinit {
        stopMonitoring()
    }
}

private final class PencilSamplingGestureRecognizer: UIGestureRecognizer {
    var onSample: ((UITouch, String) -> Void)?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        handleTouches(touches, phase: "began")
        if state == .possible { state = .began }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        handleTouches(touches, phase: "moved")
        if state != .failed && state != .cancelled { state = .changed }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        handleTouches(touches, phase: "ended")
        if state != .failed && state != .cancelled { state = .ended }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        handleTouches(touches, phase: "cancelled")
        state = .cancelled
    }

    override func reset() {
        super.reset()
    }

    private func handleTouches(_ touches: Set<UITouch>, phase: String) {
        guard let touch = touches.first(where: { $0.type == .pencil }) else { return }
        onSample?(touch, phase)
    }
}

// MARK: - InlineWebViewPlugin

/// Native Capacitor plugin that overlays a real WKWebView over a React layout
/// slot, positioned using coordinates from getBoundingClientRect() in JS.
/// This lets the iOS app display external web pages inline (like Electron's
/// <webview>) without the cross-origin restrictions that block iframes in
/// WKWebView.
///
/// Coordinate mapping: JS getBoundingClientRect() returns CSS logical pixels
/// relative to the viewport. UIKit uses points. On iOS both are the same unit.
/// We add safeAreaInsets.top so that JS y=0 (top of visible content) maps to
/// the correct native y (below the status bar).
@objc(InlineWebViewPlugin)
public class InlineWebViewPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate, UIGestureRecognizerDelegate {
    public let identifier = "InlineWebViewPlugin"
    public let jsName = "InlineWebView"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateFrame", returnType: CAPPluginReturnPromise),
    ]

    // Swipe gesture thresholds matching uiGestureBlock.ts DEFAULT_DRAWER_SWIPE_THRESHOLDS
    private let edgeStartMaxX: CGFloat = 24
    private let openDeltaXMin: CGFloat = 72
    private let closeDeltaXMax: CGFloat = -56
    private let maxVerticalDrift: CGFloat = 44

    private var inlineWebView: WKWebView?
    /// Transparent 28pt-wide overlay on the left edge — intercepts open-swipe touches
    /// before the WKWebView can consume them.
    private var edgeSwipeOverlay: UIView?

    // Convert JS viewport rect → UIKit frame.
    // getBoundingClientRect() returns coordinates in the WKWebView coordinate space,
    // which starts at y=0 = top of screen (the WKWebView extends behind the status bar).
    // The React app accounts for the safe area via env(safe-area-inset-top) CSS padding,
    // so all y values already include the status bar offset — do NOT add safeAreaInsets.top.
    private func nativeFrame(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat) -> CGRect {
        return CGRect(x: x, y: y, width: width, height: height)
    }

    @objc func open(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Invalid URL"); return
        }
        let x = CGFloat(call.getFloat("x") ?? 0)
        let y = CGFloat(call.getFloat("y") ?? 0)
        let w = CGFloat(call.getFloat("width") ?? 0)
        let h = CGFloat(call.getFloat("height") ?? 0)

        DispatchQueue.main.async {
            guard let parentView = self.bridge?.viewController?.view else {
                call.reject("No parent view"); return
            }
            let frame = self.nativeFrame(x: x, y: y, width: w, height: h)

            if self.inlineWebView == nil {
                let config = WKWebViewConfiguration()
                config.allowsInlineMediaPlayback = true
                let wkView = WKWebView(frame: frame, configuration: config)
                wkView.navigationDelegate = self
                wkView.allowsBackForwardNavigationGestures = true
                wkView.backgroundColor = .systemBackground
                parentView.addSubview(wkView)
                self.inlineWebView = wkView

                // Add close-swipe recognizer directly on the WKWebView.
                // cancelsTouchesInView=false + simultaneous delegate lets WKWebView
                // still receive all scrolling/tapping while we track the gesture.
                let closePan = UIPanGestureRecognizer(target: self, action: #selector(self.handleCloseSwipe(_:)))
                closePan.cancelsTouchesInView = false
                closePan.delaysTouchesBegan = false
                closePan.delegate = self
                wkView.addGestureRecognizer(closePan)
            } else {
                self.inlineWebView?.frame = frame
            }

            self.inlineWebView?.load(URLRequest(url: url))
            self.setupEdgeSwipeOverlay(parentView: parentView, frame: frame)
            call.resolve()
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        closeWebView()
        call.resolve()
    }

    func closeWebView() {
        DispatchQueue.main.async {
            self.inlineWebView?.removeFromSuperview()
            self.inlineWebView = nil
            self.edgeSwipeOverlay?.removeFromSuperview()
            self.edgeSwipeOverlay = nil
        }
    }

    @objc func updateFrame(_ call: CAPPluginCall) {
        let x = CGFloat(call.getFloat("x") ?? 0)
        let y = CGFloat(call.getFloat("y") ?? 0)
        let w = CGFloat(call.getFloat("width") ?? 0)
        let h = CGFloat(call.getFloat("height") ?? 0)
        DispatchQueue.main.async {
            let frame = self.nativeFrame(x: x, y: y, width: w, height: h)
            self.inlineWebView?.frame = frame
            if let overlay = self.edgeSwipeOverlay {
                overlay.frame = CGRect(x: 0, y: frame.minY, width: 28, height: frame.height)
            }
            call.resolve()
        }
    }

    // MARK: - Sidebar swipe gestures

    /// Adds a transparent 28pt-wide UIView on the left edge of the screen, above the WKWebView.
    /// Touches on this strip are captured here (not by the WKWebView), allowing us to detect
    /// the open-sidebar swipe without fighting the WKWebView's own gesture recognizers.
    private func setupEdgeSwipeOverlay(parentView: UIView, frame: CGRect) {
        edgeSwipeOverlay?.removeFromSuperview()
        let overlay = UIView(frame: CGRect(x: 0, y: frame.minY, width: 28, height: frame.height))
        overlay.backgroundColor = .clear
        overlay.isUserInteractionEnabled = true
        parentView.addSubview(overlay)
        edgeSwipeOverlay = overlay

        let openPan = UIPanGestureRecognizer(target: self, action: #selector(handleOpenSwipe(_:)))
        openPan.cancelsTouchesInView = false
        overlay.addGestureRecognizer(openPan)
    }

    /// Detects rightward swipe on the left-edge overlay → open sidebar.
    @objc private func handleOpenSwipe(_ pan: UIPanGestureRecognizer) {
        guard pan.state == .changed else { return }
        let t = pan.translation(in: pan.view)
        guard t.x >= openDeltaXMin, abs(t.y) < maxVerticalDrift else { return }
        // Disable+re-enable resets the recognizer so it fires only once per gesture.
        pan.isEnabled = false
        pan.isEnabled = true
        notifyListeners("inlineWebViewEdgeSwipeOpen", data: [:])
    }

    /// Detects leftward swipe anywhere on the WKWebView → close sidebar.
    @objc private func handleCloseSwipe(_ pan: UIPanGestureRecognizer) {
        guard pan.state == .changed else { return }
        let t = pan.translation(in: pan.view)
        guard t.x <= closeDeltaXMax, abs(t.y) < maxVerticalDrift else { return }
        pan.isEnabled = false
        pan.isEnabled = true
        notifyListeners("inlineWebViewEdgeSwipeClose", data: [:])
    }

    // MARK: - UIGestureRecognizerDelegate

    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        return true
    }
}
