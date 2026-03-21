import SwiftUI

private enum NativeChromeMetrics {
    static let outerHorizontalPadding: CGFloat = 16
    static let topChromeBottomPadding: CGFloat = 10
    static let bottomChromeBottomPadding: CGFloat = 12
    static let floatingControlHeight: CGFloat = 40
    static let groupedControlHeight: CGFloat = 42
    static let iconButtonSize: CGFloat = 40
    static let floatingCornerRadius: CGFloat = 21
    static let smallCornerRadius: CGFloat = 15
    static let titleSidePadding: CGFloat = 120
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

struct TopChromeView: View {
    @ObservedObject var state: TopChromeState

    let onMenuTap: () -> Void
    let onSearchTap: () -> Void
    let onDebugTap: () -> Void
    let onRefreshTap: () -> Void
    let onSyncTap: () -> Void
    let onRebuildTap: () -> Void
    let onGitCommitTap: () -> Void
    let onGitPushTap: () -> Void
    let onHeaderToggleTap: () -> Void

    var body: some View {
        ZStack {
            Text(state.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Thinking Space" : state.title)
                .font(.system(size: 17, weight: .semibold))
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.horizontal, NativeChromeMetrics.titleSidePadding)

            HStack(alignment: .center, spacing: 12) {
                standaloneButton(
                    systemName: "line.3.horizontal",
                    action: onMenuTap,
                    accessibilityLabel: "Open navigation"
                )

                Spacer(minLength: 12)

                actionCluster
            }
        }
        .padding(.horizontal, NativeChromeMetrics.outerHorizontalPadding)
        .padding(.top, 6)
        .padding(.bottom, NativeChromeMetrics.topChromeBottomPadding)
    }

    private var actionCluster: some View {
        HStack(spacing: 2) {
            if state.showSearch {
                groupedIconButton(
                    systemName: "magnifyingglass",
                    action: onSearchTap,
                    accessibilityLabel: "Search"
                )
            }

            if state.showTools {
                Menu {
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
                        groupedIconSurface(systemName: "ellipsis.circle")

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
                .accessibilityLabel("Tools")
            }
        }
        .padding(.horizontal, 6)
        .frame(height: NativeChromeMetrics.groupedControlHeight)
        .background {
            floatingChromeCapsule()
        }
    }

    private func standaloneButton(
        systemName: String,
        action: @escaping () -> Void,
        accessibilityLabel: String
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.primary)
                .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.iconButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .background {
            floatingChromeCapsule()
        }
    }

    private func groupedIconButton(
        systemName: String,
        action: @escaping () -> Void,
        accessibilityLabel: String
    ) -> some View {
        Button(action: action) {
            groupedIconSurface(systemName: systemName)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private func groupedIconSurface(systemName: String) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 17, weight: .medium))
            .foregroundStyle(.primary)
            .frame(width: NativeChromeMetrics.iconButtonSize, height: NativeChromeMetrics.groupedControlHeight)
            .contentShape(Rectangle())
    }
}

struct BottomChromeView: View {
    @ObservedObject var state: TopChromeState

    let onSidebarToggleTap: () -> Void
    let onCreateTap: () -> Void
    let onSelectTab: (String) -> Void
    let onCloseTab: (String) -> Void

    @State private var tabSwitcherPresented = false

    var body: some View {
        HStack {
            Spacer(minLength: 0)

            HStack(spacing: 2) {
                bottomBarIconButton(
                    systemName: "sidebar.left",
                    action: onSidebarToggleTap,
                    accessibilityLabel: state.sidebarToggleLabel,
                    enabled: state.canToggleSidebar
                )

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
        .padding(.horizontal, NativeChromeMetrics.outerHorizontalPadding)
        .padding(.top, 4)
        .padding(.bottom, NativeChromeMetrics.bottomChromeBottomPadding)
    }

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
