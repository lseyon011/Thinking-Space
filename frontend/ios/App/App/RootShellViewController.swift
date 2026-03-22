import UIKit
import SwiftUI
import Combine

final class RootShellViewController: UIViewController {
    private let shellBackgroundColor = UIColor.systemBackground

    private let bridgeVC = LTMBridgeViewController()
    let chromeState = TopChromeState() // Made internal so bridge can access it
    private var chromePlugin: TopChromePlugin?
    private var chromeVisibilityCancellable: AnyCancellable?
    private var bottomBarVisibilityCancellable: AnyCancellable?
    private var chromeLayoutCancellable: AnyCancellable?
    private var topChromeHeightConstraint: NSLayoutConstraint?
    private var topChromeHostingHeightConstraint: NSLayoutConstraint?
    private var bottomChromeHeightConstraint: NSLayoutConstraint?

    private lazy var topChromeHostingVC = UIHostingController(
        rootView: TopChromeView(
            state: chromeState,
            onMenuTap: { [weak self] in self?.chromePlugin?.emitMenuTap() },
            onSearchTap: { [weak self] in self?.chromePlugin?.emitSearchTap() },
            onDebugTap: { [weak self] in self?.chromePlugin?.emitOpenDebugTap() },
            onRefreshTap: { [weak self] in self?.chromePlugin?.emitRefreshTap() },
            onSyncTap: { [weak self] in self?.chromePlugin?.emitSyncTap() },
            onRebuildTap: { [weak self] in self?.chromePlugin?.emitRebuildTap() },
            onGitCommitTap: { [weak self] in self?.chromePlugin?.emitGitCommitTap() },
            onGitPushTap: { [weak self] in self?.chromePlugin?.emitGitPushTap() },
            onHeaderToggleTap: { [weak self] in self?.chromePlugin?.emitHeaderToggleTap() }
        )
    )

    private lazy var bottomChromeHostingVC = UIHostingController(
        rootView: BottomChromeView(
            state: chromeState,
            onSidebarToggleTap: { [weak self] in self?.chromePlugin?.emitSidebarToggleTap() },
            onCreateTap: { [weak self] in self?.chromePlugin?.emitCreateTap() },
            onExpandTap: { [weak self] in self?.chromePlugin?.emitExpandBottomTap() },
            onSelectTab: { [weak self] tabId in self?.chromePlugin?.emitSelectTab(tabId: tabId) },
            onCloseTab: { [weak self] tabId in self?.chromePlugin?.emitCloseTab(tabId: tabId) }
        )
    )

    private let topChromeContainerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

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

        if shouldUseNativeTopChrome {
            configurePhoneShell()
            observeChromeVisibility()
            observeBottomBarVisibility()
            observeChromeLayoutChanges()
        } else {
            embedBridgeFullscreen()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        applyChromeVisibility(animated: false)
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
        topChromeContainerView.backgroundColor = .clear
        bottomChromeContainerView.backgroundColor = .clear
        topChromeHostingVC.view.backgroundColor = .clear
        bottomChromeHostingVC.view.backgroundColor = .clear

        embedTopChrome()
        embedBridgeUnderTopChrome()
        embedBottomChromeOverlay()
        view.bringSubviewToFront(topChromeContainerView)
        view.bringSubviewToFront(bottomChromeContainerView)
    }

    private func embedTopChrome() {
        addChild(topChromeHostingVC)
        view.addSubview(topChromeContainerView)
        topChromeContainerView.addSubview(topChromeHostingVC.view)

        topChromeHostingVC.view.translatesAutoresizingMaskIntoConstraints = false

        let topChromeHeightConstraint = topChromeContainerView.heightAnchor.constraint(equalToConstant: resolvedTopChromeHeight())
        self.topChromeHeightConstraint = topChromeHeightConstraint
        let topChromeHostingHeightConstraint = topChromeHostingVC.view.heightAnchor.constraint(equalToConstant: resolvedTopChromeContentHeight())
        self.topChromeHostingHeightConstraint = topChromeHostingHeightConstraint

        NSLayoutConstraint.activate([
            topChromeContainerView.topAnchor.constraint(equalTo: view.topAnchor),
            topChromeContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topChromeContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topChromeHeightConstraint,
            topChromeHostingVC.view.leadingAnchor.constraint(equalTo: topChromeContainerView.leadingAnchor),
            topChromeHostingVC.view.trailingAnchor.constraint(equalTo: topChromeContainerView.trailingAnchor),
            topChromeHostingVC.view.topAnchor.constraint(equalTo: topChromeContainerView.safeAreaLayoutGuide.topAnchor),
            topChromeHostingHeightConstraint,
        ])

        topChromeHostingVC.didMove(toParent: self)
    }

    private func embedBridgeUnderTopChrome() {
        addChild(bridgeVC)
        view.addSubview(bridgeVC.view)
        bridgeVC.view.translatesAutoresizingMaskIntoConstraints = false
        
        // Ensure content panel is rectangular (no rounded corners) on iPhone
        bridgeVC.view.layer.cornerRadius = 0
        bridgeVC.view.layer.masksToBounds = false
        bridgeVC.view.clipsToBounds = false

        NSLayoutConstraint.activate([
            bridgeVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeVC.view.topAnchor.constraint(equalTo: topChromeContainerView.bottomAnchor),
            bridgeVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        bridgeVC.didMove(toParent: self)
    }

    private func embedBottomChromeOverlay() {
        addChild(bottomChromeHostingVC)
        view.addSubview(bottomChromeContainerView)
        bottomChromeContainerView.addSubview(bottomChromeHostingVC.view)

        bottomChromeHostingVC.view.translatesAutoresizingMaskIntoConstraints = false

        let bottomChromeHeightConstraint = bottomChromeContainerView.heightAnchor.constraint(equalToConstant: resolvedBottomChromeHeight())
        self.bottomChromeHeightConstraint = bottomChromeHeightConstraint

        NSLayoutConstraint.activate([
            bottomChromeContainerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomChromeContainerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomChromeContainerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomChromeHeightConstraint,
            bottomChromeHostingVC.view.leadingAnchor.constraint(equalTo: bottomChromeContainerView.leadingAnchor),
            bottomChromeHostingVC.view.trailingAnchor.constraint(equalTo: bottomChromeContainerView.trailingAnchor),
            bottomChromeHostingVC.view.topAnchor.constraint(equalTo: bottomChromeContainerView.safeAreaLayoutGuide.topAnchor),
            bottomChromeHostingVC.view.bottomAnchor.constraint(equalTo: bottomChromeContainerView.bottomAnchor),
        ])

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

    private func observeChromeVisibility() {
        chromeVisibilityCancellable = chromeState.$isVisible
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyChromeVisibility(animated: true)
            }
    }

    private func observeBottomBarVisibility() {
        bottomBarVisibilityCancellable = chromeState.$isBottomBarHidden
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyBottomBarVisibility(animated: true)
            }
    }

    private func observeChromeLayoutChanges() {
        chromeLayoutCancellable = Publishers.CombineLatest(chromeState.$isTopBarCollapsed, chromeState.$isBottomBarCollapsed)
            .receive(on: RunLoop.main)
            .sink { [weak self] _, _ in
                guard let self else { return }
                self.updateChromeSizeConstraints()
                UIView.animate(
                    withDuration: 0.32,
                    delay: 0,
                    usingSpringWithDamping: 0.9,
                    initialSpringVelocity: 0.2,
                    options: [.curveEaseInOut, .beginFromCurrentState]
                ) {
                    self.topChromeHostingVC.view.invalidateIntrinsicContentSize()
                    self.bottomChromeHostingVC.view.invalidateIntrinsicContentSize()
                    self.view.layoutIfNeeded()
                }
            }
    }

    private func resolvedTopChromeHeight() -> CGFloat {
        view.safeAreaInsets.top + (chromeState.isTopBarCollapsed ? 6 : 56)
    }

    private func resolvedTopChromeContentHeight() -> CGFloat {
        chromeState.isTopBarCollapsed ? 33 : 52
    }

    private func resolvedBottomChromeHeight() -> CGFloat {
        view.safeAreaInsets.bottom + (chromeState.isBottomBarCollapsed ? 42 : 64)
    }

    private func updateChromeSizeConstraints() {
        topChromeHeightConstraint?.constant = resolvedTopChromeHeight()
        topChromeHostingHeightConstraint?.constant = resolvedTopChromeContentHeight()
        bottomChromeHeightConstraint?.constant = resolvedBottomChromeHeight()
    }

    private func applyChromeVisibility(animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        updateChromeSizeConstraints()

        let animations = {
            if self.chromeState.isVisible {
                self.topChromeContainerView.isHidden = false
                self.topChromeContainerView.alpha = 1
                self.topChromeContainerView.transform = .identity
            } else {
                self.topChromeContainerView.alpha = 0
                self.topChromeContainerView.transform = CGAffineTransform(translationX: 0, y: -18)
            }
        }

        let completion: (Bool) -> Void = { _ in
            self.topChromeContainerView.isHidden = !self.chromeState.isVisible
            self.applyBottomBarVisibility(animated: animated)
        }

        if animated {
            UIView.animate(
                withDuration: 0.22,
                delay: 0,
                options: [.curveEaseInOut, .beginFromCurrentState],
                animations: animations,
                completion: completion
            )
        } else {
            animations()
            completion(true)
        }
    }

    private func applyBottomBarVisibility(animated: Bool) {
        guard shouldUseNativeTopChrome else { return }
        updateChromeSizeConstraints()

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
}
