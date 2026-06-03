import SwiftUI

/// Source of an icon: either an SF Symbol or an image from the asset catalog.
/// Asset icons render with rounded corners (app-icon style); SF Symbols
/// render as monochrome glyphs.
enum RailIcon: Equatable {
    case system(String)
    case asset(String)
}

/// `id` is the canonical route path — same value the React side sends as
/// `navItemId` (see frontend/src/App.tsx handleNativeTopDrawerNavItemTap).
struct RailTab: Identifiable, Equatable {
    let id: String
    let title: String
    let icon: RailIcon
    /// Additional pathnames that should also light up this tab as selected.
    /// Mirrors `activePaths` in frontend/src/data/navItems.ts.
    let activePaths: [String]
}

final class RailState: ObservableObject {
    @Published var tabs: [RailTab] = RailState.defaultTabs
    @Published var selectedId: String = "/"

    /// Mirrors the Electron primary nav (frontend/src/data/navItems.ts plus
    /// the workspace tabs declared in App.tsx). Home opens the app's root
    /// route; F9 is the Webull workspace; Tools is the personal-tools shell.
    static let defaultTabs: [RailTab] = [
        RailTab(id: "/",                   title: "Home",               icon: .asset("RailHomeIcon"),                  activePaths: []),
        RailTab(id: "/thinking-space",     title: "Thinking Space Explorer", icon: .system("safari"),                  activePaths: []),
        RailTab(id: "/new-thought",        title: "New Note",           icon: .system("plus.square"),                  activePaths: []),
        RailTab(id: "/git-insights",       title: "Insights",           icon: .system("arrow.triangle.branch"),        activePaths: []),
        RailTab(id: "/ai/chat",            title: "AI",                 icon: .system("bubble.left"),                  activePaths: ["/ai/schedules"]),
        RailTab(id: "/webull",             title: "Webull",             icon: .system("chart.line.uptrend.xyaxis"),    activePaths: []),
        RailTab(id: "/thinking-organizer", title: "Thinking Organizer", icon: .system("rectangle.3.group"),            activePaths: ["/file-organizer"]),
        RailTab(id: "/personal-tools",     title: "Tools",              icon: .system("wrench.and.screwdriver"),       activePaths: ["/personal-extension"]),
    ]

    /// Resolve the selected tab from a current path. Used when React pushes
    /// route changes to Swift so the rail highlight stays in sync.
    func selectTab(forPath path: String) {
        if let match = tabs.first(where: { $0.id == path || $0.activePaths.contains(path) }) {
            selectedId = match.id
        }
    }

    /// Override the label for a tab. Used when React tells us a user-configured
    /// label (e.g. the user-renamed Webull → "F9"). No-op if no tab matches.
    func setLabel(forPath path: String, _ label: String) {
        guard !label.isEmpty else { return }
        guard let idx = tabs.firstIndex(where: { $0.id == path }) else { return }
        let old = tabs[idx]
        guard old.title != label else { return }
        tabs[idx] = RailTab(id: old.id, title: label, icon: old.icon, activePaths: old.activePaths)
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
                iconView
                    .frame(width: 28, height: 28)

                Text(tab.title)
                    .font(.system(size: 16, weight: isSelected ? .semibold : .regular))
                    .foregroundColor(.primary)

                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
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

    @ViewBuilder
    private var iconView: some View {
        switch tab.icon {
        case .system(let name):
            Image(systemName: name)
                .font(.system(size: 18, weight: .regular))
                .foregroundColor(isSelected ? .primary : Color(white: 0.35))
        case .asset(let name):
            // Render the asset like a mini app icon: full bleed with the
            // standard ~22% continuous-corner radius iOS uses for icons.
            Image(name)
                .resizable()
                .scaledToFill()
                .frame(width: 24, height: 24)
                .clipShape(RoundedRectangle(cornerRadius: 5.5, style: .continuous))
        }
    }
}
