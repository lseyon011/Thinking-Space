import SwiftUI
import UIKit

private let phoneShellDrawerDismissVelocityThreshold: CGFloat = 220
private let phoneShellDrawerOpenThreshold: CGFloat = 0.42
private let phoneShellContentCornerRadius: CGFloat = 16
private let phoneShellContentScale: CGFloat = 0.92

struct PhoneShellView: View {
    @ObservedObject var chromeState: TopChromeState

    let bridgeController: UIViewController
    let onSelectNavItem: (String) -> Void
    @State private var drawerDragStartProgress: CGFloat? = nil

    var body: some View {
        GeometryReader { proxy in
            let safeTop = proxy.safeAreaInsets.top
            let revealHeight = resolvedDrawerRevealHeight(containerHeight: proxy.size.height, safeTop: safeTop)
            let progress = chromeState.drawerProgress
            let contentScale = 1 - (1 - phoneShellContentScale) * progress
            let contentCornerRadius = phoneShellContentCornerRadius * progress
            let topOverlayReservedHeight: CGFloat = chromeState.isVisible ? max(52, safeTop + 8) : 0

            ZStack(alignment: .top) {
                // Menu behind content
                TopDrawerMenuView(
                    state: chromeState,
                    onSelectNavItem: { navItemId in
                        closeDrawer()
                        onSelectNavItem(navItemId)
                    }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .opacity(progress)
                .allowsHitTesting(progress > 0.001)

                // Main content that slides down
                ZStack(alignment: .bottom) {
                    BridgeControllerContainerView(controller: bridgeController)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.top, topOverlayReservedHeight)
                        .ignoresSafeArea(edges: .all)
                }
                .overlay(alignment: .top) {
                    TopChromeView(state: chromeState)
                        .frame(height: safeTop, alignment: .top)
                        .opacity(chromeState.isVisible ? 1 : 0)
                        .offset(y: chromeState.isVisible ? 0 : -18)
                        .contentShape(Rectangle())
                        .highPriorityGesture(topHandleDragGesture(revealHeight: revealHeight))
                }
                .overlay {
                    if progress > 0.001 {
                        Color.black.opacity(0.3 * progress)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                closeDrawer()
                            }
                            .highPriorityGesture(contentDismissDragGesture(revealHeight: revealHeight))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: contentCornerRadius, style: .continuous))
                .scaleEffect(contentScale, anchor: .bottom)
                .offset(y: progress * revealHeight)
                .shadow(color: Color.black.opacity(0.18 * progress), radius: 30, x: 0, y: 10)
                .ignoresSafeArea()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .clipped()
            .animation(.easeInOut(duration: 0.22), value: chromeState.isVisible)
        }
        .ignoresSafeArea()
        .background(Color(uiColor: .systemGroupedBackground))
    }

    private func resolvedDrawerRevealHeight(containerHeight: CGFloat, safeTop: CGFloat) -> CGFloat {
        let minimumHeight: CGFloat = 360
        let preferredHeight = safeTop + 460
        let maxHeight = containerHeight * 0.74
        return max(minimumHeight, min(preferredHeight, maxHeight))
    }

    private func closeDrawer() {
        withAnimation(.spring(response: 0.34, dampingFraction: 0.88)) {
            chromeState.drawerProgress = 0
        }
    }

    private func topHandleDragGesture(revealHeight: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .local)
            .onChanged { value in
                if drawerDragStartProgress == nil {
                    drawerDragStartProgress = chromeState.drawerProgress
                }
                guard let startProgress = drawerDragStartProgress else { return }
                let nextProgress = min(max(startProgress + (value.translation.height / max(revealHeight, 1)), 0), 1)
                chromeState.drawerProgress = nextProgress
            }
            .onEnded { value in
                finishDrawerDrag(translation: value.translation.height, predictedEndTranslation: value.predictedEndTranslation.height, revealHeight: revealHeight)
            }
    }

    private func contentDismissDragGesture(revealHeight: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6, coordinateSpace: .local)
            .onChanged { value in
                if drawerDragStartProgress == nil {
                    drawerDragStartProgress = chromeState.drawerProgress
                }
                guard let startProgress = drawerDragStartProgress else { return }
                let nextProgress = min(max(startProgress + (value.translation.height / max(revealHeight, 1)), 0), 1)
                chromeState.drawerProgress = nextProgress
            }
            .onEnded { value in
                finishDrawerDrag(translation: value.translation.height, predictedEndTranslation: value.predictedEndTranslation.height, revealHeight: revealHeight)
            }
    }

    private func finishDrawerDrag(translation: CGFloat, predictedEndTranslation: CGFloat, revealHeight: CGFloat) {
        let velocityEstimate = predictedEndTranslation - translation
        let predictedProgress = min(
            max((drawerDragStartProgress ?? chromeState.drawerProgress) + (predictedEndTranslation / max(revealHeight, 1)), 0),
            1
        )

        drawerDragStartProgress = nil

        let shouldOpen: Bool
        if velocityEstimate > phoneShellDrawerDismissVelocityThreshold {
            shouldOpen = true
        } else if velocityEstimate < -phoneShellDrawerDismissVelocityThreshold {
            shouldOpen = false
        } else {
            shouldOpen = predictedProgress >= phoneShellDrawerOpenThreshold
        }

        withAnimation(.spring(response: 0.34, dampingFraction: 0.88)) {
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
