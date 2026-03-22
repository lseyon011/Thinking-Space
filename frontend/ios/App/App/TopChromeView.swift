import SwiftUI

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

private struct NativeTopDrawerItem: Identifiable {
    let id: String
    let title: String
    let systemImage: String
}

private struct NativeTopDrawerSection: Identifiable {
    let id: String
    let title: String
    let items: [NativeTopDrawerItem]
}

private let nativeTopDrawerSections: [NativeTopDrawerSection] = [
    NativeTopDrawerSection(id: "core", title: "Core", items: [
        NativeTopDrawerItem(id: "/thinking-space", title: "Thinking Space", systemImage: "safari"),
        NativeTopDrawerItem(id: "/new-thought", title: "New Note", systemImage: "plus.rectangle"),
        NativeTopDrawerItem(id: "/git-insights", title: "Insights", systemImage: "arrow.triangle.branch"),
        NativeTopDrawerItem(id: "/chat", title: "AI", systemImage: "bubble.left.and.bubble.right"),
        NativeTopDrawerItem(id: "/web", title: "Web", systemImage: "globe"),
        NativeTopDrawerItem(id: "/webull", title: "F9", systemImage: "chart.line.uptrend.xyaxis"),
        NativeTopDrawerItem(id: "/thinking-organizer", title: "Thinking Organizer", systemImage: "rectangle.3.group"),
    ]),
    NativeTopDrawerSection(id: "workspace", title: "Workspace", items: [
        NativeTopDrawerItem(id: "/terminal", title: "Terminal", systemImage: "terminal"),
        NativeTopDrawerItem(id: "/settings", title: "Settings", systemImage: "gearshape"),
    ]),
]

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
        ZStack(alignment: .top) {
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Drag handle
                Capsule()
                    .fill(Color.primary.opacity(0.18))
                    .frame(width: 36, height: 5)
                    .padding(.top, 8)
                    .padding(.bottom, 16)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(nativeTopDrawerSections) { section in
                            drawerSection(section)
                        }

                        // Search row at the bottom
                        drawerRow(
                            NativeTopDrawerItem(id: "search", title: "Search", systemImage: "magnifyingglass")
                        )
                        .padding(.horizontal, 16)
                    }
                    .padding(.bottom, 24)
                }
            }
        }
    }

    private func drawerSection(_ section: NativeTopDrawerSection) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(section.title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 20)
                .padding(.bottom, 2)

            VStack(spacing: 0) {
                ForEach(section.items) { item in
                    drawerRow(item)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func drawerRow(_ item: NativeTopDrawerItem) -> some View {
        let isActive = state.activeNavItemId == item.id

        return Button(action: { onSelectNavItem(item.id) }) {
            HStack(spacing: 10) {
                Image(systemName: item.systemImage)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(isActive ? Color(uiColor: .systemBackground) : .primary)
                    .frame(width: 20)

                Text(item.title)
                    .font(.system(size: 15, weight: isActive ? .semibold : .regular))
                    .foregroundStyle(isActive ? Color(uiColor: .systemBackground) : .primary)
                    .lineLimit(1)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(isActive ? Color.primary : Color.clear)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
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

    var body: some View {
        ZStack {
            // Left: sidebar toggle + tools
            HStack(spacing: 8) {
                sidebarToggleButton
                moreMenuButton
                Spacer(minLength: 0)
            }

            // Right: drawer toggle
            HStack {
                Spacer(minLength: 0)
                drawerToggleButton
            }

            if state.isBottomBarCollapsed {
                // Collapsed: centered pill
                HStack {
                    Spacer(minLength: 120)
                    collapsedBottomPill
                    Spacer(minLength: 60)
                }
            } else {
                // Expanded: centered tab controls
                HStack {
                    Spacer(minLength: 120)

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

                    Spacer(minLength: 60)
                }
            }
        }
        .padding(.horizontal, NativeChromeMetrics.outerHorizontalPadding)
        .padding(.top, 4)
        .padding(.bottom, NativeChromeMetrics.bottomChromeBottomPadding)
        .animation(.easeInOut(duration: 0.28), value: state.isBottomBarCollapsed)
    }

    // MARK: - Sidebar toggle (left drawer)

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
        .padding(6)
        .background {
            floatingChromeCapsule()
        }
    }

    // MARK: - More menu (search + tools combined)

    private var moreMenuButton: some View {
        Menu {
            if state.showSearch {
                Button(action: onSearchTap) {
                    Label("Search", systemImage: "magnifyingglass")
                }
            }

            Divider()

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
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "wrench.and.screwdriver")
                    .font(.system(size: 18, weight: .medium))
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
        .accessibilityLabel("More options")
        .padding(6)
        .background {
            floatingChromeCapsule()
        }
    }

    private var drawerToggleButton: some View {
        TopChromeDrawerButtonView(
            active: state.drawerProgress > 0.01,
            action: onDrawerToggleTap
        )
    }

    // MARK: - Tab controls

    private var tabSwitcherButton: some View {
        Button(action: { tabSwitcherPresented = true }) {
            HStack(spacing: 7) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(Color.primary, lineWidth: 1.8)
                        .frame(width: 20, height: 18)

                    Text("\(max(state.tabs.count, 1))")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.primary)
                }

                Text(activeTabLabel)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .frame(maxWidth: 80, alignment: .leading)
            }
            .padding(.horizontal, 14)
            .frame(height: NativeChromeMetrics.floatingControlHeight)
            .background(
                RoundedRectangle(cornerRadius: NativeChromeMetrics.smallCornerRadius, style: .continuous)
                    .fill(Color.primary.opacity(0.07))
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Tab switcher")
    }

    private var activeTabLabel: String {
        state.tabs.first(where: { $0.active })?.label ?? "Tabs"
    }

    private var collapsedBottomPill: some View {
        Button(action: onExpandTap) {
            HStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(Color.primary, lineWidth: 1.6)
                        .frame(width: 19, height: 17)

                    Text("\(max(state.tabs.count, 1))")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.primary)
                }

                Text("Tabs")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.primary)
            }
            .padding(.horizontal, 14)
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
