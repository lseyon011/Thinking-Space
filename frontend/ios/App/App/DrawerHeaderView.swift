import SwiftUI

/// Observable state for a native drawer header.
/// Updated by RootShellViewController when drawer state changes.
final class DrawerHeaderState: ObservableObject {
    @Published var sectionLabel: String
    @Published var title: String

    init(sectionLabel: String = "Sidebar", title: String = "Explorer") {
        self.sectionLabel = sectionLabel
        self.title = title
    }
}

/// Native SwiftUI header rendered above the embedded drawer WKWebView.
/// Matches the visual style of the React drawer headers (warm beige gradient,
/// uppercase section label, semibold title, circular close button).
struct DrawerHeaderView: View {
    @ObservedObject var state: DrawerHeaderState
    var onClose: () -> Void

    private let beigeLighter = Color(red: 245.0 / 255.0, green: 243.0 / 255.0, blue: 238.0 / 255.0)
    private let beigeDarker  = Color(red: 241.0 / 255.0, green: 239.0 / 255.0, blue: 232.0 / 255.0)

    @ViewBuilder
    private var sectionLabelText: some View {
        let base = Text(state.sectionLabel)
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .foregroundColor(Color(white: 0.45))
        if #available(iOS 16.0, *) {
            base.kerning(2.4)
        } else {
            base
        }
    }

    @ViewBuilder
    private var titleText: some View {
        let base = Text(state.title)
            .font(.system(size: 17, weight: .semibold))
            .foregroundColor(.primary)
            .lineLimit(1)
        if #available(iOS 16.0, *) {
            base.kerning(-0.4)
        } else {
            base
        }
    }

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                sectionLabelText
                titleText
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color(white: 0.45))
                    .frame(width: 40, height: 40)
                    .background(Color.white.opacity(0.85))
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(Color.black.opacity(0.12), lineWidth: 0.5)
                    )
                    .shadow(color: .black.opacity(0.04), radius: 2, y: 1)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 12)
        .padding(.top, 4)
        .background(
            LinearGradient(colors: [beigeLighter, beigeDarker], startPoint: .top, endPoint: .bottom)
        )
    }
}
