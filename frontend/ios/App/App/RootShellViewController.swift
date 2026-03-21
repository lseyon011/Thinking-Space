import UIKit
import SwiftUI
import Combine

final class RootShellViewController: UIViewController {
    private let shellBackgroundColor = UIColor(
        red: 242.0 / 255.0,
        green: 242.0 / 255.0,
        blue: 247.0 / 255.0,
        alpha: 1.0
    )

    private let bridgeVC = LTMBridgeViewController()
    private let chromeState = TopChromeState()
    private var chromePlugin: TopChromePlugin?
    private var chromeVisibilityCancellable: AnyCancellable?

    private lazy var chromeHostingVC = UIHostingController(
        rootView: TopChromeView(
            state: chromeState,
            onMenuTap: { [weak self] in self?.chromePlugin?.emitMenuTap() },
            onSearchTap: { [weak self] in self?.chromePlugin?.emitSearchTap() },
            onCreateTap: { [weak self] in self?.chromePlugin?.emitCreateTap() }
        )
    )

    private let stackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .fill
        stack.distribution = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()

    private let chromeContainerView: UIView = {
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
        } else {
            embedBridgeFullscreen()
        }
    }

    func wireTopChromePlugin(_ plugin: TopChromePlugin) {
        chromePlugin = plugin
        plugin.chromeState = chromeState
    }

    func dismissInlineWebView() {
        bridgeVC.dismissInlineWebView()
    }

    private func configurePhoneShell() {
        chromeContainerView.backgroundColor = shellBackgroundColor
        chromeHostingVC.view.backgroundColor = shellBackgroundColor

        view.addSubview(stackView)
        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stackView.topAnchor.constraint(equalTo: view.topAnchor),
            stackView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        embedChromeInContainer()
        embedBridgeInStack()
    }

    private func embedChromeInContainer() {
        addChild(chromeHostingVC)
        stackView.addArrangedSubview(chromeContainerView)
        chromeContainerView.addSubview(chromeHostingVC.view)

        chromeHostingVC.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            chromeHostingVC.view.leadingAnchor.constraint(equalTo: chromeContainerView.safeAreaLayoutGuide.leadingAnchor),
            chromeHostingVC.view.trailingAnchor.constraint(equalTo: chromeContainerView.safeAreaLayoutGuide.trailingAnchor),
            chromeHostingVC.view.topAnchor.constraint(equalTo: chromeContainerView.safeAreaLayoutGuide.topAnchor),
            chromeHostingVC.view.bottomAnchor.constraint(equalTo: chromeContainerView.bottomAnchor),
            chromeHostingVC.view.heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
        ])

        chromeHostingVC.didMove(toParent: self)
    }

    private func embedBridgeInStack() {
        addChild(bridgeVC)
        stackView.addArrangedSubview(bridgeVC.view)
        bridgeVC.view.translatesAutoresizingMaskIntoConstraints = false
        bridgeVC.didMove(toParent: self)
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
            .sink { [weak self] isVisible in
                self?.chromeContainerView.isHidden = !isVisible
            }
    }
}
