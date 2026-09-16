import Foundation

/// Single entry point the keyboard (and app, for previews/testing) call into.
/// Owns backend selection, prompt construction, and the cache lookup — no
/// other code should build HTTP requests directly.
struct AnthropicService {
    private let backend: TranslationBackend
    private let cache: TranslationCache

    init(cache: TranslationCache = .shared) {
        switch AppConfig.mode {
        case .directAnthropic:
            self.backend = AnthropicDirectClient()
        case .backendProxy(let baseURL):
            self.backend = BackendProxyClient(baseURL: baseURL)
        }
        self.cache = cache
    }

    /// Runs one toolbar action end-to-end: cache check → prompt build → API
    /// call → cache store. Text is trimmed but never logged or persisted.
    func perform(
        action: TranslationAction,
        direction: TranslationDirection,
        variant: SpanishVariant,
        text: String
    ) async throws -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw TranslationBackendError.emptyCompletion
        }

        if let cached = await cache.lookup(action: action, direction: direction, variant: variant, text: trimmed) {
            return cached
        }

        let system = PromptBuilder.systemPrompt(for: action, direction: direction, variant: variant)
        let result = try await backend.complete(system: system, userText: trimmed)

        await cache.store(action: action, direction: direction, variant: variant, text: trimmed, result: result)
        return result
    }
}
