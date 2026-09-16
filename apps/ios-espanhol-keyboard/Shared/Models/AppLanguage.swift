import Foundation

/// The two natural languages this app moves text between.
enum AppLanguage: String, Codable {
    case portuguese
    case spanish
}

/// Which Spanish should be produced when the target language is `.spanish`.
enum SpanishVariant: String, Codable, CaseIterable, Identifiable {
    case spain
    case latam

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .spain: return "Espanhol da Espanha 🇪🇸"
        case .latam: return "Espanhol Latino-Americano 🌎"
        }
    }

    /// Wording injected into prompts so Claude targets the right dialect.
    var promptLabel: String {
        switch self {
        case .spain: return "español de España (castellano, como se habla en Madrid/Barcelona)"
        case .latam: return "español latinoamericano neutro"
        }
    }
}

/// Which way text flows through the translator.
enum TranslationDirection: String, Codable, CaseIterable, Identifiable {
    case ptToEs
    case esToPt

    var id: String { rawValue }

    var source: AppLanguage { self == .ptToEs ? .portuguese : .spanish }
    var target: AppLanguage { self == .ptToEs ? .spanish : .portuguese }

    var toggled: TranslationDirection { self == .ptToEs ? .esToPt : .ptToEs }

    var shortLabel: String {
        switch self {
        case .ptToEs: return "🇧🇷 → 🇪🇸"
        case .esToPt: return "🇪🇸 → 🇧🇷"
        }
    }
}
