import UIKit
import Capacitor
import UniformTypeIdentifiers

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
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
// Main.storyboard must reference "LTMBridgeViewController" as the custom class.

class LTMBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FolderPickerPlugin())
        bridge?.registerPluginInstance(PencilEventsPlugin())
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
