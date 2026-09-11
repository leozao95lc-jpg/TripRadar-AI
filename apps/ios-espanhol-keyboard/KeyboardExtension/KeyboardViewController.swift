import UIKit
import SwiftUI

/// Entry point registered in Info.plist (`NSExtensionPrincipalClass`).
///
/// Apple's `UIInputViewController` gives extensions a `textDocumentProxy`
/// (limited to `documentContextBeforeInput` / `documentContextAfterInput`,
/// `insertText`, `deleteBackward` and cursor-offset adjustment — there is no
/// API to read an arbitrary selection or the full contents of the host
/// app's text field). See the repo README for the full limitations writeup.
final class KeyboardViewController: UIInputViewController {
    private var viewModel: KeyboardViewModel!
    private var hostingController: UIHostingController<KeyboardContainerView>!

    override func viewDidLoad() {
        super.viewDidLoad()

        let vm = KeyboardViewModel()
        vm.proxy = SystemTextDocumentProxy(proxy: textDocumentProxy)
        vm.hasFullAccessProvider = { [weak self] in self?.hasFullAccess ?? false }
        vm.advanceToNextInputMode = { [weak self] in self?.advanceToNextInputMode() }
        self.viewModel = vm

        let hosting = UIHostingController(rootView: KeyboardContainerView(viewModel: vm))
        self.hostingController = hosting

        addChild(hosting)
        view.addSubview(hosting.view)
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hosting.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hosting.view.topAnchor.constraint(equalTo: view.topAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        hosting.didMove(toParent: self)

        let heightConstraint = view.heightAnchor.constraint(equalToConstant: 280)
        heightConstraint.priority = .defaultHigh
        heightConstraint.isActive = true
    }

    override func textWillChange(_ textInput: UITextInput?) {
        super.textWillChange(textInput)
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // Refresh the proxy reference: iOS may hand out a new proxy instance
        // as the host app's text field changes.
        viewModel.proxy = SystemTextDocumentProxy(proxy: textDocumentProxy)
    }

    deinit {
        // Never let cached translations survive past this keyboard session.
        Task { await TranslationCache.shared.clear() }
    }
}
