import Foundation

/// User-configurable preferences, persisted in the shared App Group container
/// so both the host app and the keyboard extension see the same values.
struct AppSettings: Codable, Equatable {
    var variant: SpanishVariant
    var defaultDirection: TranslationDirection
    var autoDetectEnabled: Bool
    var hasCompletedOnboarding: Bool

    static let `default` = AppSettings(
        variant: .spain,
        defaultDirection: .ptToEs,
        autoDetectEnabled: false,
        hasCompletedOnboarding: false
    )
}
