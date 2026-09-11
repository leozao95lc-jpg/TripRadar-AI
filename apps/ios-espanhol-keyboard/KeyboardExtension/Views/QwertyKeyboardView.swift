import SwiftUI

struct QwertyKeyboardView: View {
    @ObservedObject var viewModel: KeyboardViewModel

    var body: some View {
        VStack(spacing: 6) {
            let rows = KeyboardLayout.rows(for: viewModel.page)

            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                HStack(spacing: 5) {
                    if index == rows.count - 1, viewModel.page == .letters {
                        KeyButton(label: "⇧", isSpecial: true) {
                            viewModel.handleKey(.shift)
                        }
                    }

                    ForEach(row, id: \.self) { character in
                        KeyButton(label: displayLabel(for: character)) {
                            viewModel.handleKey(.character(character))
                        }
                    }

                    if index == rows.count - 1 {
                        KeyButton(label: "⌫", isSpecial: true) {
                            viewModel.handleKey(.backspace)
                        }
                    }
                }
            }

            HStack(spacing: 5) {
                KeyButton(label: viewModel.page == .letters ? "123" : "ABC", isSpecial: true) {
                    viewModel.handleKey(viewModel.page == .letters ? .switchToNumbers : .switchToLetters)
                }

                if viewModel.page == .numbers {
                    KeyButton(label: "#+=", isSpecial: true) {
                        viewModel.handleKey(.switchToSymbols)
                    }
                } else if viewModel.page == .symbols {
                    KeyButton(label: "123", isSpecial: true) {
                        viewModel.handleKey(.switchToNumbers)
                    }
                }

                KeyButton(label: "🌐", isSpecial: true) {
                    viewModel.handleKey(.nextKeyboard)
                }

                KeyButton(label: "espaço", isSpecial: false, flexWidth: true) {
                    viewModel.handleKey(.space)
                }

                KeyButton(label: "return", isSpecial: true) {
                    viewModel.handleKey(.return)
                }
            }
        }
        .padding(.horizontal, 6)
        .padding(.bottom, 6)
    }

    private func displayLabel(for character: String) -> String {
        guard viewModel.page == .letters else { return character }
        return viewModel.isShifted ? character.uppercased() : character
    }
}
