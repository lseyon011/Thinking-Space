import SwiftUI

/// `id` is the canonical route path — same value the React side sends as
/// `navItemId` (see frontend/src/App.tsx handleNativeTopDrawerNavItemTap).
struct RailTab: Identifiable, Equatable {
    let id: String
    let title: String
    let systemImage: String
    /// Additional pathnames that should also light up this tab as selected.
    /// Mirrors `activePaths` in frontend/src/data/navItems.ts.
    let activePaths: [String]
}

final class RailState: ObservableObject {
    @Published var tabs: [RailTab] = RailState.defaultTabs
    @Published var selectedId: String = "/thinking-space"

    /// Mirrors PRIMARY_NAV_ITEMS in frontend/src/data/navItems.ts. Order, labels,
    /// and paths must stay in sync with the Electron primary nav. SF Symbols
    /// chosen to approximate the lucide icons used on the React side.
    static let defaultTabs: [RailTab] = [
        RailTab(id: "/thinking-space",     title: "Thinking Space",     systemImage: "safari",                activePaths: []),
        RailTab(id: "/new-thought",        title: "New Note",           systemImage: "plus.square",           activePaths: []),
        RailTab(id: "/git-insights",       title: "Insights",           systemImage: "arrow.triangle.branch", activePaths: []),
        RailTab(id: "/ai/chat",            title: "AI",                 systemImage: "bubble.left",           activePaths: ["/ai/schedules"]),
        RailTab(id: "/password-manager",   title: "Passwords",          systemImage: "key",                   activePaths: []),
        RailTab(id: "/thinking-organizer", title: "Thinking Organizer", systemImage: "rectangle.3.group",     activePaths: ["/file-organizer"]),
    ]

    /// Resolve the selected tab from a current path. Used when React pushes
    /// route changes to Swift so the rail highlight stays in sync.
    func selectTab(forPath path: String) {
        if let match = tabs.first(where: { $0.id == path || $0.activePaths.contains(path) }) {
            selectedId = match.id
        }
    }
}

struct RailView: View {
    @ObservedObject var headerState: DrawerHeaderState
    @ObservedObject var railState: RailState
    var onSelect: (RailTab) -> Void
    var onClose: () -> Void

    private let beigeBackground = Color(red: 245.0 / 255.0, green: 243.0 / 255.0, blue: 238.0 / 255.0)

    var body: some View {
        VStack(spacing: 0) {
            DrawerHeaderView(state: headerState, onClose: onClose)

            ScrollView {
                VStack(spacing: 2) {
                    ForEach(railState.tabs) { tab in
                        RailRow(
                            tab: tab,
                            isSelected: tab.id == railState.selectedId,
                            onTap: { onSelect(tab) }
                        )
                    }
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
        }
        .background(beigeBackground.ignoresSafeArea())
    }
}

private struct RailRow: View {
    let tab: RailTab
    let isSelected: Bool
    let onTap: () -> Void

    @State private var pressed: Bool = false

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 14) {
                Image(systemName: tab.systemImage)
                    .font(.system(size: 18, weight: .regular))
                    .foregroundColor(isSelected ? .primary : Color(white: 0.35))
                    .frame(width: 28)

                Text(tab.title)
                    .font(.system(size: 16, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(.primary)

                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.white.opacity(0.7) : (pressed ? Color.black.opacity(0.04) : .clear))
            )
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in pressed = true }
                .onEnded { _ in pressed = false }
        )
    }
}
