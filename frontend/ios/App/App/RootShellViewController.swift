import UIKit
import SwiftUI
import Combine

final class RootShellViewController: UIViewController {
    private let shellBackgroundColor = UIColor.systemBackground

    private let bridgeVC = LTMBridgeViewController()
    let chromeState = TopChromeState()
    private var chromePlugin: TopChromePlugin?
    private var chromeVisibilityCancellable: AnyCancellable?
    private var bottomBarVisibilityCancellable: AnyCancellable?
    private var bottomBarLayoutCancellable: AnyCancellable?
    private var bottomChromeHeightConstraint: NSLayoutConstraint?

    private lazy var phoneShellHostingVC = UIHostingController(
        rootView: PhoneShellView(
            chromeState: chromeState,
            bridgeController: bridgeVC,
            onSelectNavItem: { [weak self] navItemId in
                self?.chromePlugin?.emitNavItemTap(navItemId: navItemId)
            }
        )
    )

    private lazy var bottomChromeHostingVC = UIHostingController(
        rootView: BottomChromeView(
            state: chromeState,
            onSidebarToggleTap: { [weak self] in self?.chromePlugin?.emitSidebarToggleTap() },
            onDrawerToggleTap: { [weak self] in self?.toggleDrawer() },
            onSearchTap: { [weak self] in self?.chromePlugin?.emitSearchTap() },
            onCreateTap: { [weak self] in self?.chromePlugin?.emitCreateTap() },
            onExpandTap: { [weak self] in self?.chromePlugin?.emitExpandBottomTap() },
            onSelectTab: { [weak self] tabId in self?.chromePlugin?.emitSelectTab(tabId: tabId) },
            onCloseTab: { [weak self] tabId in self?.chromePlugin?.emitCloseTab(tabId: tabId) },
            onDebugTap: { [weak self] in self?.chromePlugin?.emitOpenDebugTap() },
            onRefreshTap: { [weak self] in self?.chromePlugin?.emitRefreshTap() },
            onSyncTap: { [weak self] in self?.chromePlugin?.emitSyncTap() },
            onRebuildTap: { [weak self] in self?.chromePlugin?.emitRebuildTap() },
            onGitCommitTap: { [weak self] in self?.chromePlugin?.emitGitCommitTap() },
            onGitPushTap: { [weak self] in self?.chromePlugin?.emitGitPushTap() },
            onHeaderToggleTap: { [weak self] in self?.chromePlugin?.emitHeaderToggleTap() }
        )
    )

    private let bottomChromeContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private var shouldUseNativeTopChrome: Bool {
        UIDevice.current.userInterfaceIdiom == .phone
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = shellBackgroundColor

        bridgeVC.chromeState = chromeState
        bridgeVC.onTopChromePluginReady = { [weak self] plugin in
            self?.wireTopChromePlugin(plugin)
        }

        if shouldUseNativeTopChrome {
            configurePhoneShell()
            observeBottomChromeState()
        } else {
            embedBridgeFullscreen()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyBottomBarVisibility(animated: false)
    }

    func wireTopChromePlugin(_ plugin: TopChromePlugin) {
        chromePlugin = plugin
        plugin.chromeState = chromeState
    }

    func dismissInlineWebView() {
        bridgeVC.dismissInlineWebView()
    }

    private func configurePhoneShell() {
        phoneShellHostingVC.view.backgroundColor = .clear
        bottomChromeContainerView.backgroundColor = .clear
        bottomChromeHostingVC.view.backgroundColor = .clear

        addChild(phoneShellHostingVC)
        view.addSubview(phoneShellHostingVC.view)
        phoneShellHostingVC.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            phoneShellHostingVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            phoneShellHostingVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            phoneShellHostingVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            phoneShellHostingVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        phoneShellHostingVC.didMove(toParent: self)

        embedBottomChromeOverlay()
        view.bringSubviewToFront(bottomChromeContainerView)
    }

    private func embedBottomChromeOverlay() {
        addChild(bottomChromeHostingVC)
        view.addSubview(bottomChromeContainerView)
        bottomChromeContainerView.addSubview(bottomChromeHostingVC.view)

        bottomChromeHostingVC.view.translatesAutoresizingMaskIntoConstraints = false

        let heightConstraint = bottomChromeContainerView.heightAnchor.constraint(equalToConstant: resolvedBottomChromeHeight())
        bottomChromeHeightConstraint = heightConstraint

        NSLayoutConstraint.activate([
            bottomChromeContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomChromeContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomChromeContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            heightConstraint,
            bottomChromeHostingVC.view.leadingAnchor.constraint(equalTo: bottomChromeContainerView.leadingAnchor),
            bottomChromeHostingVC.view.trailingAnchor.constraint(equalTo: bottomChromeContainerView.trailingAnchor),
            bottomChromeHostingVC.view.topAnchor.constraint(equalTo: bottomChromeContainerView.safeAreaLayoutGuide.topAnchor),
            bottomChromeHostingVC.view.bottomAnchor.constraint(equalTo: bottomChromeContainerView.bottomAnchor),
        ])

        bottomChromeContainerView.isHidden = true
        bottomChromeContainerView.alpha = 0
        bottomChromeContainerView.isUserInteractionEnabled = false

        bottomChromeHostingVC.didMove(toParent: self)
    }

    private func embedBridgeFullscreen() {
        addChild(bridgeVC)
        view.addSubview(bridgeVC.view)
        bridgeVC.view.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            bridgeVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        bridgeVC.didMove(toParent: self)
    }

    private func observeBottomChromeState() {
        chromeVisibilityCancellable = chromeState.$isVisible
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyBottomBarVisibility(animated: true)
            }

        bottomBarVisibilityCancellable = chromeState.$isBottomBarHidden
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyBottomBarVisibility(animated: true)
            }

        bottomBarLayoutCancellable = chromeState.$isBottomBarCollapsed
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                guard let self else { return }
                self.updateBottomChromeSizeConstraint()
                UIView.animate(
                    withDuration: 0.32,
                    delay: 0,
                    usingSpringWithDamping: 0.9,
                    initialSpringVelocity: 0.2,
                    options: [.curveEaseInOut, .beginFromCurrentState]
                ) {
                    self.bottomChromeHostingVC.view.invalidateIntrinsicContentSize()
                    self.view.layoutIfNeeded()
                }
            }
    }

    private func resolvedBottomChromeHeight() -> CGFloat {
        view.safeAreaInsets.bottom + (chromeState.isBottomBarCollapsed ? 42 : 64)
    }

    private func updateBottomChromeSizeConstraint() {
        bottomChromeHeightConstraint?.constant = resolvedBottomChromeHeight()
    }

    private func applyBottomBarVisibility(animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        updateBottomChromeSizeConstraint()

        let shouldShowBottomBar = chromeState.isVisible && !chromeState.isBottomBarHidden
        let hiddenOffset = max(bottomChromeContainerView.bounds.height, 96) + 12

        let animations = {
            if shouldShowBottomBar {
                self.bottomChromeContainerView.isHidden = false
                self.bottomChromeContainerView.alpha = 1
                self.bottomChromeContainerView.transform = .identity
            } else {
                self.bottomChromeContainerView.alpha = 0
                self.bottomChromeContainerView.transform = CGAffineTransform(translationX: 0, y: hiddenOffset)
            }
        }

        let completion: (Bool) -> Void = { _ in
            self.bottomChromeContainerView.isHidden = !shouldShowBottomBar
            self.bottomChromeContainerView.isUserInteractionEnabled = shouldShowBottomBar
        }

        if animated {
            UIView.animate(
                withDuration: 0.32,
                delay: 0,
                usingSpringWithDamping: 0.9,
                initialSpringVelocity: 0.18,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: animations,
                completion: completion
            )
        } else {
            animations()
            completion(true)
        }
    }

    private func toggleDrawer() {
        withAnimation(.spring(response: 0.34, dampingFraction: 0.88)) {
            chromeState.drawerProgress = chromeState.drawerProgress > 0.01 ? 0 : 1
        }
    }
}
