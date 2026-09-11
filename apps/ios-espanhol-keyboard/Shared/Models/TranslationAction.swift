import Foundation

/// The four toolbar actions the keyboard exposes.
enum TranslationAction: String, Codable, CaseIterable, Identifiable {
    case translate
    case natural
    case correct

    var id: String { rawValue }

    var toolbarSymbol: String {
        switch self {
        case .translate: return "🇪🇸"
        case .natural: return "✨"
        case .correct: return "✍️"
        }
    }

    var toolbarTitle: String {
        switch self {
        case .translate: return "Traduzir"
        case .natural: return "Natural"
        case .correct: return "Corrigir"
        }
    }
}

/// Transient UI state shown in the keyboard's status strip.
enum KeyboardStatus: Equatable {
    case idle
    case working(action: TranslationAction)
    case success
    case needsFullAccess
    case emptyText
    case error(String)

    var message: String {
        switch self {
        case .idle:
            return ""
        case .working:
            return "Traduzindo..."
        case .success:
            return "✓ Traduzido"
        case .needsFullAccess:
            return "Ative \"Permitir Acesso Total\" nos Ajustes para usar a IA."
        case .emptyText:
            return "Digite algo antes de usar esse botão."
        case .error:
            return "Não foi possível traduzir. Tente novamente."
        }
    }
}
