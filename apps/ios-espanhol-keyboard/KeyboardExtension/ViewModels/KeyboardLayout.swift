import Foundation

enum KeyboardPage {
    case letters
    case numbers
    case symbols
}

enum KeyAction: Hashable {
    case character(String)
    case backspace
    case shift
    case space
    case `return`
    case switchToNumbers
    case switchToSymbols
    case switchToLetters
    case nextKeyboard
}

/// Static QWERTY-ish layout data. Kept separate from the view so the rows
/// are easy to tweak without touching rendering/gesture code.
enum KeyboardLayout {
    static let letterRows: [[String]] = [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
        ["z", "x", "c", "v", "b", "n", "m"]
    ]

    static let numberRows: [[String]] = [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""],
        [".", ",", "?", "!", "'"]
    ]

    static let symbolRows: [[String]] = [
        ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
        ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "·"],
        ["¿", "¡", ".", ",", "?", "!", "'"]
    ]

    static func rows(for page: KeyboardPage) -> [[String]] {
        switch page {
        case .letters: return letterRows
        case .numbers: return numberRows
        case .symbols: return symbolRows
        }
    }
}
