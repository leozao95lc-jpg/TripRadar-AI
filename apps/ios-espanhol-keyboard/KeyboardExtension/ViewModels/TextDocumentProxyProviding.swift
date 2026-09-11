import UIKit

/// Thin protocol over `UITextDocumentProxy` so the view model doesn't depend
/// directly on `UIInputViewController` internals and can be unit tested with
/// a fake.
protocol TextDocumentProxyProviding: AnyObject {
    var documentContextBeforeInput: String? { get }
    var documentContextAfterInput: String? { get }
    func insertText(_ text: String)
    func deleteBackward()
    func adjustTextPosition(byCharacterOffset offset: Int)
}

extension UITextDocumentProxy: TextDocumentProxyProviding {}
