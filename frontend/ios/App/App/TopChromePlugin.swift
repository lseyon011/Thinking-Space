import Foundation
import Capacitor

@objc(TopChromePlugin)
public class TopChromePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TopChromePlugin"
    public let jsName = "TopChrome"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addListener", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),
    ]

    var chromeState: TopChromeState?

    @objc func setState(_ call: CAPPluginCall) {
        let title = call.getString("title")
        let isVisible = call.getBool("visible")
        let showSearch = call.getBool("showSearch")
        let showCreate = call.getBool("showCreate")

        DispatchQueue.main.async {
            if let state = self.chromeState {
                if let title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    state.title = title
                }
                if let isVisible {
                    state.isVisible = isVisible
                }
                if let showSearch {
                    state.showSearch = showSearch
                }
                if let showCreate {
                    state.showCreate = showCreate
                }
            }
            call.resolve()
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.chromeState?.isVisible = true
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.chromeState?.isVisible = false
            call.resolve()
        }
    }

    func emitMenuTap() {
        notifyListeners("topChromeMenuTap", data: [:])
    }

    func emitSearchTap() {
        notifyListeners("topChromeSearchTap", data: [:])
    }

    func emitCreateTap() {
        notifyListeners("topChromeCreateTap", data: [:])
    }
}
