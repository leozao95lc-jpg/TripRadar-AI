import SwiftUI

struct KeyboardContainerView: View {
    @ObservedObject var viewModel: KeyboardViewModel

    var body: some View {
        VStack(spacing: 0) {
            ToolbarView(viewModel: viewModel)
            Divider().padding(.vertical, 4)
            QwertyKeyboardView(viewModel: viewModel)
        }
        .frame(maxWidth: .infinity)
    }
}
