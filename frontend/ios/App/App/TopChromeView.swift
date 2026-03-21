import SwiftUI

struct TopChromeView: View {
    @ObservedObject var state: TopChromeState

    let onMenuTap: () -> Void
    let onSearchTap: () -> Void
    let onCreateTap: () -> Void

    private let shellBackgroundColor = Color(
        red: 242.0 / 255.0,
        green: 242.0 / 255.0,
        blue: 247.0 / 255.0
    )

    var body: some View {
        HStack(spacing: 12) {
            chromeButton(systemName: "line.3.horizontal", action: onMenuTap, accessibilityLabel: "Open navigation")

            Text(state.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Thinking Space" : state.title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .minimumScaleFactor(0.85)
                .frame(maxWidth: .infinity, alignment: .leading)

            if state.showSearch {
                chromeButton(systemName: "magnifyingglass", action: onSearchTap, accessibilityLabel: "Search")
            }

            if state.showCreate {
                chromeButton(systemName: "plus", action: onCreateTap, accessibilityLabel: "Create note")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(shellBackgroundColor)
    }

    private func chromeButton(
        systemName: String,
        action: @escaping () -> Void,
        accessibilityLabel: String
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: 30, height: 30)
                .background(Color.white.opacity(0.7))
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}
