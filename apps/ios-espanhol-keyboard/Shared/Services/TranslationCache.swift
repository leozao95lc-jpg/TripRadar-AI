import Foundation

/// A small in-memory-only cache for recent translations.
///
/// Deliberately never touches disk: keyboard extensions can see private
/// messages, so nothing here should outlive the process. The cache exists
/// purely to avoid re-billing/re-calling the API when the user taps a
/// toolbar button twice on the same text (e.g. after a failed send).
actor TranslationCache {
    static let shared = TranslationCache()

    private var storage: [String: String] = [:]
    private var order: [String] = []
    private let maxEntries = 30

    private init() {}

    func lookup(action: TranslationAction, direction: TranslationDirection, variant: SpanishVariant, text: String) -> String? {
        storage[key(action: action, direction: direction, variant: variant, text: text)]
    }

    func store(action: TranslationAction, direction: TranslationDirection, variant: SpanishVariant, text: String, result: String) {
        let k = key(action: action, direction: direction, variant: variant, text: text)
        if storage[k] == nil {
            order.append(k)
        }
        storage[k] = result

        while order.count > maxEntries {
            let oldest = order.removeFirst()
            storage.removeValue(forKey: oldest)
        }
    }

    /// Called when the keyboard loses focus / the extension is about to be
    /// torn down, so nothing lingers longer than the active session.
    func clear() {
        storage.removeAll()
        order.removeAll()
    }

    private func key(action: TranslationAction, direction: TranslationDirection, variant: SpanishVariant, text: String) -> String {
        "\(action.rawValue)|\(direction.rawValue)|\(variant.rawValue)|\(text)"
    }
}
