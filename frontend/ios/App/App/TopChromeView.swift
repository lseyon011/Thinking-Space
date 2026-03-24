import SwiftUI
import UIKit

private enum NativeChromeMetrics {
    static let outerHorizontalPadding: CGFloat = 16
    static let bottomChromeBottomPadding: CGFloat = 0
    static let floatingControlHeight: CGFloat = 40
    static let floatingCollapsedControlHeight: CGFloat = 34
    static let groupedControlHeight: CGFloat = 42
    static let groupedCollapsedControlHeight: CGFloat = 36
    static let iconButtonSize: CGFloat = 40
    static let collapsedIconButtonSize: CGFloat = 34
    static let floatingCornerRadius: CGFloat = 21
    static let smallCornerRadius: CGFloat = 15
    static let fixedTabSwitcherWidth: CGFloat = 204
}

private enum NativeTopDrawerMetrics {
    static let horizontalPadding: CGFloat = 20
    static let titleTopSpacing: CGFloat = 10
    static let sectionSpacing: CGFloat = 14
    static let maxContentWidth: CGFloat = 312
    static let sectionCornerRadius: CGFloat = 14
    static let sectionStrokeOpacity: CGFloat = 0.1
    static let rowHorizontalPadding: CGFloat = 12
    static let rowMinimumHeight: CGFloat = 46
    static let rowIconSize: CGFloat = 26
    static let rowIconCornerRadius: CGFloat = 8
    static let rowSpacing: CGFloat = 14
    static let dividerInset: CGFloat = 50
}

private func resolvedNativeTopDrawerSafeAreaTopInset() -> CGFloat {
    UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .flatMap(\.windows)
        .filter(\.isKeyWindow)
        .map(\.safeAreaInsets.top)
        .max() ?? 0
}

private func floatingChromeCapsule() -> some View {
    Capsule()
        .fill(.ultraThinMaterial)
        .overlay {
            Capsule()
                .stroke(Color.white.opacity(0.6), lineWidth: 0.75)
        }
        .shadow(color: Color.black.opacity(0.09), radius: 18, x: 0, y: 8)
}

private func formatBadgeCount(_ count: Int) -> String {
    count > 99 ? "99+" : "\(max(0, count))"
}

private enum NativeTopDrawerIconStyle {
    case symbol(String)
}

private struct NativeTopDrawerItem: Identifiable {
    let id: String
    let title: String
    let iconStyle: NativeTopDrawerIconStyle
    let badgeColor: Color
}

private struct NativeTopDrawerSection: Identifiable {
    let id: String
    let title: String
    let items: [NativeTopDrawerItem]
}

private let nativeTopDrawerSections: [NativeTopDrawerSection] = [
    NativeTopDrawerSection(id: "core", title: "Core", items: [
        NativeTopDrawerItem(id: "/", title: "Home", iconStyle: .symbol("house"), badgeColor: .black),
        NativeTopDrawerItem(id: "/thinking-space", title: "Thinking Space", iconStyle: .symbol("safari"), badgeColor: .black),
        NativeTopDrawerItem(id: "/new-thought", title: "New Note", iconStyle: .symbol("plus.rectangle"), badgeColor: .black),
        NativeTopDrawerItem(id: "/git-insights", title: "Insights", iconStyle: .symbol("tuningfork"), badgeColor: .black),
        NativeTopDrawerItem(id: "/chat", title: "AI", iconStyle: .symbol("bubble.left"), badgeColor: .black),
        NativeTopDrawerItem(id: "/web", title: "Web", iconStyle: .symbol("globe"), badgeColor: .black),
        NativeTopDrawerItem(id: "/webull", title: "F9", iconStyle: .symbol("chart.xyaxis.line"), badgeColor: .black),
        NativeTopDrawerItem(id: "/thinking-organizer", title: "Thinking Organizer", iconStyle: .symbol("tablecells"), badgeColor: .black),
    ]),
    NativeTopDrawerSection(id: "workspace", title: "Workspace", items: [
        NativeTopDrawerItem(id: "/terminal", title: "Terminal", iconStyle: .symbol("terminal"), badgeColor: .black),
        NativeTopDrawerItem(id: "/settings", title: "Settings", iconStyle: .symbol("gearshape"), badgeColor: .black),
    ]),
    NativeTopDrawerSection(id: "search", title: "", items: [
        NativeTopDrawerItem(id: "search", title: "Search", iconStyle: .symbol("magnifyingglass"), badgeColor: .black),
    ]),
]

private struct NativeTopDrawerRowView: View {
    let item: NativeTopDrawerItem
    let active: Bool
    let action: () -> Void

    private var rowBackgroundColor: Color {
        .clear
    }

    private var rowForegroundColor: Color {
        .primary
    }

    private var rowChevronColor: Color {
        .secondary.opacity(0.7)
    }

    private var iconBackgroundColor: Color {
        active ? item.badgeColor : Color(UIColor.systemBackground)
    }

    private var iconForegroundColor: Color {
        active ? .white : .primary
    }

    private var iconStrokeColor: Color {
        active ? item.badgeColor : .black.opacity(0.1)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: NativeTopDrawerMetrics.rowSpacing) {
                iconView

                Text(item.title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(rowForegroundColor)
                    .lineLimit(1)

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(rowChevronColor)
            }
            .padding(.horizontal, NativeTopDrawerMetrics.rowHorizontalPadding)
            .frame(minHeight: NativeTopDrawerMetrics.rowMinimumHeight)
            .background(rowBackgroundColor)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var iconView: some View {
        switch item.iconStyle {
        case .symbol(let systemImage):
            Image(systemName: systemImage)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(iconForegroundColor)
                .frame(width: NativeTopDrawerMetrics.rowIconSize, height: NativeTopDrawerMetrics.rowIconSize)
                .background(
                    RoundedRectangle(cornerRadius: NativeTopDrawerMetrics.rowIconCornerRadius, style: .continuous)
                        .fill(iconBackgroundColor)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: NativeTopDrawerMetrics.rowIconCornerRadius, style: .continuous)
                        .stroke(iconStrokeColor, lineWidth: 0.75)
                )
        }
    }
}

private struct NativeTopDrawerSectionCardView: View {
    let state: TopChromeState
    let section: NativeTopDrawerSection
    let onSelectNavItem: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                NativeTopDrawerRowView(
                    item: item,
                    active: state.activeNavItemId == item.id,
                    action: { onSelectNavItem(item.id) }
                )

                if index < section.items.count - 1 {
                    Divider()
                        .padding(.leading, NativeTopDrawerMetrics.dividerInset)
                }
            }
        }
        .background(Color(UIColor.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: NativeTopDrawerMetrics.sectionCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: NativeTopDrawerMetrics.sectionCornerRadius, style: .continuous)
                .stroke(Color.primary.opacity(NativeTopDrawerMetrics.sectionStrokeOpacity), lineWidth: 0.75)
        )
    }
}

// MARK: - Top Chrome (minimal status bar cover)

struct TopChromeView: View {
    @ObservedObject var state: TopChromeState

    var body: some View {
        Rectangle()
            .fill(.ultraThinMaterial)
    }
}

struct TopChromeDrawerButtonView: View {
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "line.3.horizontal")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(active ? Color.accentColor : .primary)
                .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.iconButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(active ? "Close navigation" : "Open navigation")
        .padding(6)
        .background {
            floatingChromeCapsule()
                .overlay {
                    if active {
                        Capsule()
                            .stroke(Color.accentColor.opacity(0.28), lineWidth: 1)
                    }
                }
        }
    }
}

struct TopDrawerMenuView: View {
    @ObservedObject var state: TopChromeState

    let onSelectNavItem: (String) -> Void

    var body: some View {
        GeometryReader { proxy in
            let safeTopInset = max(proxy.safeAreaInsets.top, resolvedNativeTopDrawerSafeAreaTopInset())

            ScrollView {
                LazyVStack(alignment: .leading, spacing: NativeTopDrawerMetrics.sectionSpacing) {
                    Text("Thinking Space")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(Color.primary)
                        .padding(.bottom, 2)

                    ForEach(nativeTopDrawerSections) { section in
                        VStack(alignment: .leading, spacing: 8) {
                            if !section.title.isEmpty {
                                Text(section.title)
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundStyle(Color.secondary)
                                    .padding(.horizontal, 2)
                            }

                            NativeTopDrawerSectionCardView(
                                state: state,
                                section: section,
                                onSelectNavItem: onSelectNavItem
                            )
                        }
                    }
                }
                .frame(maxWidth: NativeTopDrawerMetrics.maxContentWidth)
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.horizontal, NativeTopDrawerMetrics.horizontalPadding)
                .padding(.top, safeTopInset + NativeTopDrawerMetrics.titleTopSpacing)
                .padding(.bottom, 28)
            }
        }
        .background(Color(UIColor.systemGroupedBackground).ignoresSafeArea())
    }
}

// MARK: - Bottom Chrome

struct BottomChromeView: View {
    @ObservedObject var state: TopChromeState

    let onSidebarToggleTap: () -> Void
    let onDrawerToggleTap: () -> Void
    let onSearchTap: () -> Void
    let onCreateTap: () -> Void
    let onExpandTap: () -> Void
    let onSelectTab: (String) -> Void
    let onCloseTab: (String) -> Void
    let onDebugTap: () -> Void
    let onRefreshTap: () -> Void
    let onSyncTap: () -> Void
    let onRebuildTap: () -> Void
    let onGitCommitTap: () -> Void
    let onGitPushTap: () -> Void
    let onHeaderToggleTap: () -> Void

    @State private var tabSwitcherPresented = false
    @State private var toolsMenuPresented = false

    var body: some View {
        HStack(spacing: 8) {
            leadingControlPill
            if state.isBottomBarCollapsed {
                collapsedBottomPill
                Spacer(minLength: 0)
            } else {
                expandedBottomPill
                    .frame(maxWidth: .infinity)
            }
            drawerToggleButton
        }
        .padding(.horizontal, NativeChromeMetrics.outerHorizontalPadding)
        .padding(.top, 4)
        .padding(.bottom, NativeChromeMetrics.bottomChromeBottomPadding)
        .animation(.easeInOut(duration: 0.28), value: state.isBottomBarCollapsed)
    }

    // MARK: - Sidebar toggle (left drawer)

    private var leadingControlPill: some View {
        HStack(spacing: 0) {
            sidebarToggleButton

            Rectangle()
                .fill(Color.primary.opacity(0.1))
                .frame(width: 1, height: 26)

            toolsMenuButton
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background {
            floatingChromeCapsule()
        }
    }

    private var sidebarToggleButton: some View {
        Button(action: onSidebarToggleTap) {
            Image(systemName: "sidebar.left")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(state.canToggleSidebar ? .primary : .secondary)
                .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.iconButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!state.canToggleSidebar)
        .accessibilityLabel(state.sidebarToggleLabel)
    }

    // MARK: - More menu (search + tools combined)

    private var toolsMenuButton: some View {
        Button(action: { toolsMenuPresented = true }) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: toolsMenuPresented ? "chevron.down" : "chevron.up")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.iconButtonSize)
                    .contentShape(Rectangle())

                if state.toolsBadgeCount > 0 {
                    Text(formatBadgeCount(state.toolsBadgeCount))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .frame(minWidth: 18, minHeight: 18)
                        .background(Color.red)
                        .clipShape(Capsule())
                        .offset(x: 5, y: -4)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("More options")
        .confirmationDialog("More Options", isPresented: $toolsMenuPresented, titleVisibility: .visible) {
            if state.showSearch {
                Button(action: onSearchTap) {
                    Label("Search", systemImage: "magnifyingglass")
                }
            }

            if state.canToggleHeader {
                Button(action: onHeaderToggleTap) {
                    Label(state.headerToggleLabel, systemImage: "switch.2")
                }
            }

            Button(action: onDebugTap) {
                Label("Debug Console", systemImage: "ladybug")
            }

            Button(action: onRefreshTap) {
                Label("Refresh Workspace", systemImage: "arrow.clockwise")
            }
            .disabled(!state.canRefresh)

            Button(action: onSyncTap) {
                Label("Sync Folder", systemImage: "arrow.triangle.2.circlepath")
            }
            .disabled(!state.canSync)

            Button(action: onRebuildTap) {
                Label("Rebuild Index + Cache", systemImage: "externaldrive")
            }
            .disabled(!state.canRebuild)

            if state.canGitCommit {
                Divider()

                Button(action: onGitCommitTap) {
                    Label("Git Commit", systemImage: "checkmark.circle")
                }
            }

            if state.canGitPush {
                Button(action: onGitPushTap) {
                    Label("Git Push", systemImage: "arrow.up.circle")
                }
            }
        }
    }

    private var drawerToggleButton: some View {
        Button(action: onDrawerToggleTap) {
            Image(systemName: "line.3.horizontal")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(state.drawerProgress > 0.01 ? Color.accentColor : .primary)
                .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.iconButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(state.drawerProgress > 0.01 ? "Close navigation" : "Open navigation")
        .padding(6)
        .background {
            floatingChromeCapsule()
        }
    }

    // MARK: - Tab controls

    private var tabSwitcherButton: some View {
        Button(action: { tabSwitcherPresented = true }) {
            HStack(spacing: 9) {
                tabCountBadge
                    .frame(width: 24, height: 20)

                Text(activeTabLabel)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: NativeChromeMetrics.floatingControlHeight)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Tab switcher")
    }

    private var expandedBottomPill: some View {
        HStack(spacing: 2) {
            tabSwitcherButton

            bottomBarIconButton(
                systemName: "plus",
                action: onCreateTap,
                accessibilityLabel: "Create note",
                enabled: true
            )
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background {
            floatingChromeCapsule()
        }
        .sheet(isPresented: $tabSwitcherPresented) {
            tabSwitcherSheet
        }
    }

    private var activeTabLabel: String {
        state.tabs.first(where: { $0.active })?.label ?? "Tabs"
    }

    private var collapsedBottomPill: some View {
        Button(action: onExpandTap) {
            HStack(spacing: 8) {
                tabCountBadge
                    .frame(width: 20, height: 18)

                Text("Tabs")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 13)
            .frame(height: NativeChromeMetrics.floatingCollapsedControlHeight)
            .background {
                floatingChromeCapsule()
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Expand tab controls")
    }

    @ViewBuilder
    private var tabSwitcherSheet: some View {
        let content = NativeTabSwitcherSheetView(
            tabs: state.tabs,
            onSelectTab: { tabId in
                tabSwitcherPresented = false
                onSelectTab(tabId)
            },
            onCloseTab: onCloseTab,
            onCreateTap: {
                tabSwitcherPresented = false
                onCreateTap()
            }
        )

        if #available(iOS 16.0, *) {
            content
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        } else {
            content
        }
    }

    private func bottomBarIconButton(
        systemName: String,
        action: @escaping () -> Void,
        accessibilityLabel: String,
        enabled: Bool
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(enabled ? .primary : .secondary)
                .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.floatingControlHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(accessibilityLabel)
    }

    private var tabCountBadge: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 6.5, style: .continuous)
                .fill(Color.primary.opacity(0.09))

            RoundedRectangle(cornerRadius: 6.5, style: .continuous)
                .stroke(Color.primary.opacity(0.18), lineWidth: 0.8)

            Text("\(max(state.tabs.count, 1))")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.primary)
        }
    }
}

// MARK: - Tab Switcher Sheet

private struct NativeTabSwitcherSheetView: View {
    @Environment(\.dismiss) private var dismiss

    let tabs: [TopChromeTabItem]
    let onSelectTab: (String) -> Void
    let onCloseTab: (String) -> Void
    let onCreateTap: () -> Void

    var body: some View {
        NavigationView {
            List {
                ForEach(tabs) { tab in
                    HStack(spacing: 12) {
                        Button(action: { onSelectTab(tab.id) }) {
                            HStack(spacing: 12) {
                                Image(systemName: tab.active ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(tab.active ? .blue : .secondary)

                                Text(tab.label)
                                    .font(.system(size: 17, weight: tab.active ? .semibold : .regular))
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if tabs.count > 1 {
                            Button(action: { onCloseTab(tab.id) }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.secondary)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Close \(tab.label)")
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Tabs")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button(action: onCreateTap) {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Create tab")
                }
            }
        }
    }
}
