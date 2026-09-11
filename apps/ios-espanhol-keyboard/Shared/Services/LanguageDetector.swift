import Foundation
import NaturalLanguage

/// On-device language detection (no network call) used only when the user
/// opts into "Detecção automática" in Settings.
enum LanguageDetector {
    static func detectDirection(for text: String, fallback: TranslationDirection) -> TranslationDirection {
        let recognizer = NLLanguageRecognizer()
        recognizer.processString(text)
        guard let language = recognizer.dominantLanguage else { return fallback }

        switch language {
        case .portuguese:
            return .ptToEs
        case .spanish:
            return .esToPt
        default:
            return fallback
        }
    }
}
