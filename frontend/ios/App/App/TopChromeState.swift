import Foundation
import Combine

struct TopChromeTabItem: Identifiable, Decodable, Equatable {
    let id: String
    let label: String
    let active: Bool
}

final class TopChromeState: ObservableObject {
    @Published var title: String = "Thinking Space"
    @Published var isVisible: Bool = true
    @Published var isTopBarCollapsed: Bool = false
    @Published var isBottomBarCollapsed: Bool = false
    @Published var showSearch: Bool = true
    @Published var showTools: Bool = true
    @Published var toolsBadgeCount: Int = 0
    @Published var canToggleSidebar: Bool = true
    @Published var sidebarToggleActive: Bool = false
    @Published var sidebarToggleLabel: String = "Show Navigation"
    @Published var canToggleHeader: Bool = false
    @Published var headerToggleLabel: String = "Toggle Header"
    @Published var tabs: [TopChromeTabItem] = []
    @Published var isBottomBarHidden: Bool = false
    @Published var canRefresh: Bool = true
    @Published var canSync: Bool = true
    @Published var canRebuild: Bool = true
    @Published var canGitCommit: Bool = false
    @Published var canGitPush: Bool = false
}
