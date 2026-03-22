import SwiftUI
import UIKit

private let phoneShellDrawerWidth: CGFloat = 300
private let phoneShellContentCornerRadius: CGFloat = 20
private let phoneShellDismissVelocityThreshold: CGFloat = 300
private let phoneShellOpenThreshold: CGFloat = 0.4

struct PhoneShellView: View {
    @ObservedObject var chromeState: TopChromeState

    let bridgeController: UIViewController
    let onSelectNavItem: (String) -> Void
    @State private var drawerDragStartProgress: CGFloat? = nil

    var body: some View {
        GeometryReader { proxy in
            let safeTop = proxy.safeAreaInsets.top
            let progress = chromeState.drawerProgress
            let contentOffset = progress * phoneShellDrawerWidth
            let contentCornerRadius = phoneShellContentCornerRadius * progress
            let topOverlayReservedHeight: CGFloat = chromeState.isVisible ? max(52, safeTop + 8) : 0

            ZStack(alignment: .leading) {
                // Menu behind content (left side)
                TopDrawerMenuView(
                    state: chromeState,
                    onSelectNavItem: { navItemId in
                        closeDrawer()
                        onSelectNavItem(navItemId)
                    }
                )
                .frame(width: phoneShellDrawerWidth)
                .frame(maxHeight: .infinity)
                .opacity(0.4 + 0.6 * progress)
                .offset(x: -30 * (1 - progress))
                .allowsHitTesting(progress > 0.001)

                // Main content that slides right
                ZStack {
                    BridgeControllerContainerView(controller: bridgeController)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.top, topOverlayReservedHeight)
                        .ignoresSafeArea(edges: .all)

                    // Top chrome overlay
                    VStack {
                        TopChromeView(state: chromeState)
                            .frame(height: safeTop, alignment: .top)
                            .opacity(chromeState.isVisible ? 1 : 0)
                            .offset(y: chromeState.isVisible ? 0 : -18)
                        Spacer()
                    }
                    .ignoresSafeArea(edges: .top)

                    // Dismiss overlay
                    if progress > 0.001 {
                        Color.black.opacity(0.15 * progress)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                closeDrawer()
                            }
                            .gesture(contentDismissDragGesture())
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: contentCornerRadius, style: .continuous))
                .offset(x: contentOffset)
                .shadow(color: Color.black.opacity(0.2 * progress), radius: 20, x: -5, y: 0)
                .gesture(edgeDragGesture())
                .ignoresSafeArea()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .animation(.easeInOut(duration: 0.22), value: chromeState.isVisible)
        }
        .ignoresSafeArea()
        .background(Color(UIColor.systemGroupedBackground))
    }

    private func closeDrawer() {
        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            chromeState.drawerProgress = 0
        }
    }

    private func edgeDragGesture() -> some Gesture {
        DragGesture(minimumDistance: 10, coordinateSpace: .local)
            .onChanged { value in
                // Only start from left edge
                if drawerDragStartProgress == nil {
                    if chromeState.drawerProgress < 0.01 && value.startLocation.x > 30 {
                        return
                    }
                    drawerDragStartProgress = chromeState.drawerProgress
                }
                guard let startProgress = drawerDragStartProgress else { return }
                let delta = value.translation.width / phoneShellDrawerWidth
                chromeState.drawerProgress = min(max(startProgress + delta, 0), 1)
            }
            .onEnded { value in
                finishDrag(velocity: value.predictedEndTranslation.width - value.translation.width)
            }
    }

    private func contentDismissDragGesture() -> some Gesture {
        DragGesture(minimumDistance: 10, coordinateSpace: .local)
            .onChanged { value in
                if drawerDragStartProgress == nil {
                    drawerDragStartProgress = chromeState.drawerProgress
                }
                guard let startProgress = drawerDragStartProgress else { return }
                let delta = value.translation.width / phoneShellDrawerWidth
                chromeState.drawerProgress = min(max(startProgress + delta, 0), 1)
            }
            .onEnded { value in
                finishDrag(velocity: value.predictedEndTranslation.width - value.translation.width)
            }
    }

    private func finishDrag(velocity: CGFloat) {
        let currentProgress = chromeState.drawerProgress
        drawerDragStartProgress = nil

        let shouldOpen: Bool
        if velocity > phoneShellDismissVelocityThreshold {
            shouldOpen = true
        } else if velocity < -phoneShellDismissVelocityThreshold {
            shouldOpen = false
        } else {
            shouldOpen = currentProgress >= phoneShellOpenThreshold
        }

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            chromeState.drawerProgress = shouldOpen ? 1 : 0
        }
    }
}

private struct BridgeControllerContainerView: UIViewControllerRepresentable {
    let controller: UIViewController

    func makeUIViewController(context: Context) -> UIViewController {
        controller
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
