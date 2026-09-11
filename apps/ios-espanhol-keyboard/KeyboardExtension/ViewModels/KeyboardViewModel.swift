import Foundation
import Combine

@MainActor
final class KeyboardViewModel: ObservableObject {
    @Published private(set) var status: KeyboardStatus = .idle
    @Published var page: KeyboardPage = .letters
    @Published var isShifted: Bool = false
    @Published var direction: TranslationDirection
    @Published var variant: SpanishVariant
    @Published var autoDetectEnabled: Bool

    var proxy: TextDocumentProxyProviding?
    var hasFullAccessProvider: () -> Bool = { false }
    var advanceToNextInputMode: () -> Void = {}

    private let service = AnthropicService()
    private var statusResetTask: Task<Void, Never>?

    init(settings: AppSettings = SharedDefaults.loadSettings()) {
        self.direction = settings.defaultDirection
        self.variant = settings.variant
        self.autoDetectEnabled = settings.autoDetectEnabled
    }

    // MARK: - Regular typing

    func handleKey(_ action: KeyAction) {
        guard let proxy else { return }

        switch action {
        case .character(let raw):
            let text = isShifted ? raw.uppercased() : raw
            proxy.insertText(text)
            if isShifted { isShifted = false }

        case .backspace:
            proxy.deleteBackward()

        case .shift:
            isShifted.toggle()

        case .space:
            proxy.insertText(" ")

        case .return:
            proxy.insertText("\n")

        case .switchToNumbers:
            page = .numbers

        case .switchToSymbols:
            page = .symbols

        case .switchToLetters:
            page = .letters

        case .nextKeyboard:
            advanceToNextInputMode()
        }
    }

    // MARK: - Direction toggle

    func toggleDirection() {
        direction = direction.toggled
        persistSettings()
    }

    // MARK: - Toolbar actions

    func performToolbarAction(_ action: TranslationAction) {
        guard hasFullAccessProvider() else {
            show(.needsFullAccess, autoResetAfter: 4)
            return
        }
        guard let proxy else { return }

        let before = proxy.documentContextBeforeInput ?? ""
        let after = proxy.documentContextAfterInput ?? ""
        let fullText = before + after

        guard !fullText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            show(.emptyText, autoResetAfter: 2)
            return
        }

        let effectiveDirection = autoDetectEnabled
            ? LanguageDetector.detectDirection(for: fullText, fallback: direction)
            : direction

        show(.working(action: action))

        let capturedVariant = variant
        let beforeCount = before.count
        let afterCount = after.count

        Task { [weak self] in
            guard let self else { return }
            do {
                let result = try await service.perform(
                    action: action,
                    direction: effectiveDirection,
                    variant: capturedVariant,
                    text: fullText
                )
                self.replaceEntireText(oldBeforeCount: beforeCount, oldAfterCount: afterCount, with: result)
                self.show(.success, autoResetAfter: 2)
            } catch {
                self.show(.error(error.localizedDescription), autoResetAfter: 3)
            }
        }
    }

    /// Clears whatever the proxy currently exposes and inserts the new text.
    /// See README "Custom Keyboard limitations" for why this
    /// before/after-cursor dance is necessary instead of a direct
    /// "select all + replace".
    private func replaceEntireText(oldBeforeCount: Int, oldAfterCount: Int, with newText: String) {
        guard let proxy else { return }

        // Move the cursor to the very end of the existing text...
        proxy.adjustTextPosition(byCharacterOffset: oldAfterCount)
        // ...then delete everything, back to front.
        for _ in 0..<(oldBeforeCount + oldAfterCount) {
            proxy.deleteBackward()
        }
        proxy.insertText(newText)
    }

    // MARK: - Status strip

    private func show(_ status: KeyboardStatus, autoResetAfter seconds: TimeInterval? = nil) {
        statusResetTask?.cancel()
        self.status = status

        guard let seconds else { return }
        statusResetTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.status = .idle
        }
    }

    private func persistSettings() {
        var settings = SharedDefaults.loadSettings()
        settings.defaultDirection = direction
        settings.variant = variant
        settings.autoDetectEnabled = autoDetectEnabled
        SharedDefaults.save(settings)
    }
}
