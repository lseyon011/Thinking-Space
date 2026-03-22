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
        let topBarCollapsed = call.getBool("topBarCollapsed")
        let bottomBarCollapsed = call.getBool("bottomBarCollapsed")
        let showSearch = call.getBool("showSearch")
        let showTools = call.getBool("showTools")
        let toolsBadgeCount = call.getInt("toolsBadgeCount")
        let canToggleSidebar = call.getBool("canToggleSidebar")
        let sidebarToggleActive = call.getBool("sidebarToggleActive")
        let sidebarToggleLabel = call.getString("sidebarToggleLabel")
        let canToggleHeader = call.getBool("canToggleHeader")
        let headerToggleLabel = call.getString("headerToggleLabel")
        let tabsPayload = call.getString("tabsPayload")
        let bottomBarHidden = call.getBool("bottomBarHidden")
        let canRefresh = call.getBool("canRefresh")
        let canSync = call.getBool("canSync")
        let canRebuild = call.getBool("canRebuild")
        let canGitCommit = call.getBool("canGitCommit")
        let canGitPush = call.getBool("canGitPush")

        DispatchQueue.main.async {
            guard let state = self.chromeState else {
                call.resolve()
                return
            }

            if let title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                state.title = title
            }
            if let isVisible {
                state.isVisible = isVisible
            }
            if let topBarCollapsed {
                state.isTopBarCollapsed = topBarCollapsed
            }
            if let bottomBarCollapsed {
                state.isBottomBarCollapsed = bottomBarCollapsed
            }
            if let showSearch {
                state.showSearch = showSearch
            }
            if let showTools {
                state.showTools = showTools
            }
            if let toolsBadgeCount {
                state.toolsBadgeCount = max(0, toolsBadgeCount)
            }
            if let canToggleSidebar {
                state.canToggleSidebar = canToggleSidebar
            }
            if let sidebarToggleActive {
                state.sidebarToggleActive = sidebarToggleActive
            }
            if let sidebarToggleLabel, !sidebarToggleLabel.isEmpty {
                state.sidebarToggleLabel = sidebarToggleLabel
            }
            if let canToggleHeader {
                state.canToggleHeader = canToggleHeader
            }
            if let headerToggleLabel, !headerToggleLabel.isEmpty {
                state.headerToggleLabel = headerToggleLabel
            }
            if let tabsPayload {
                state.tabs = self.decodeTabs(from: tabsPayload)
            }
            if let bottomBarHidden {
                state.isBottomBarHidden = bottomBarHidden
            }
            if let canRefresh {
                state.canRefresh = canRefresh
            }
            if let canSync {
                state.canSync = canSync
            }
            if let canRebuild {
                state.canRebuild = canRebuild
            }
            if let canGitCommit {
                state.canGitCommit = canGitCommit
            }
            if let canGitPush {
                state.canGitPush = canGitPush
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

    func emitOpenDebugTap() {
        notifyListeners("topChromeOpenDebugTap", data: [:])
    }

    func emitRefreshTap() {
        notifyListeners("topChromeRefreshTap", data: [:])
    }

    func emitSyncTap() {
        notifyListeners("topChromeSyncTap", data: [:])
    }

    func emitRebuildTap() {
        notifyListeners("topChromeRebuildTap", data: [:])
    }

    func emitGitCommitTap() {
        notifyListeners("topChromeGitCommitTap", data: [:])
    }

    func emitGitPushTap() {
        notifyListeners("topChromeGitPushTap", data: [:])
    }

    func emitHeaderToggleTap() {
        notifyListeners("topChromeHeaderToggleTap", data: [:])
    }

    func emitSidebarToggleTap() {
        notifyListeners("topChromeSidebarToggleTap", data: [:])
    }

    func emitCreateTap() {
        notifyListeners("topChromeCreateTap", data: [:])
    }

    func emitExpandBottomTap() {
        notifyListeners("topChromeExpandBottomTap", data: [:])
    }

    func emitSelectTab(tabId: String) {
        notifyListeners("topChromeSelectTab", data: ["tabId": tabId])
    }

    func emitCloseTab(tabId: String) {
        notifyListeners("topChromeCloseTab", data: ["tabId": tabId])
    }

    private func decodeTabs(from payload: String) -> [TopChromeTabItem] {
        guard let data = payload.data(using: .utf8) else {
            return []
        }

        do {
            return try JSONDecoder().decode([TopChromeTabItem].self, from: data)
        } catch {
            NSLog("[TopChromePlugin] Failed to decode tabs payload: %@", error.localizedDescription)
            return []
        }
    }
}
