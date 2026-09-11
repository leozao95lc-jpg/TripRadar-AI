import UIKit

/// Thin protocol over `UITextDocumentProxy` so the view model doesn't depend
/// directly on `UIInputViewController` internals and can be unit tested with
/// a fake.
///
/// `UITextDocumentProxy` is itself a protocol, and Swift does not allow
/// retroactively declaring that one protocol conforms to another via an
/// extension (`extension UITextDocumentProxy: TextDocumentProxyProviding {}`
/// fails to compile: "extension of protocol ... cannot have an inheritance
/// clause"). `SystemTextDocumentProxy` below adapts a concrete
/// `UITextDocumentProxy` instance instead.
protocol TextDocumentProxyProviding {
    var documentContextBeforeInput: String? { get }
    var documentContextAfterInput: String? { get }
    func insertText(_ text: String)
    func deleteBackward()
    func adjustTextPosition(byCharacterOffset offset: Int)
}

struct SystemTextDocumentProxy: TextDocumentProxyProviding {
    let proxy: UITextDocumentProxy

    var documentContextBeforeInput: String? { proxy.documentContextBeforeInput }
    var documentContextAfterInput: String? { proxy.documentContextAfterInput }

    func insertText(_ text: String) { proxy.insertText(text) }
    func deleteBackward() { proxy.deleteBackward() }
    func adjustTextPosition(byCharacterOffset offset: Int) {
        proxy.adjustTextPosition(byCharacterOffset: offset)
    }
}
