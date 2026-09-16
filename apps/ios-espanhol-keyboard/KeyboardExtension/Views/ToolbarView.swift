import SwiftUI

struct ToolbarView: View {
    @ObservedObject var viewModel: KeyboardViewModel

    var body: some View {
        VStack(spacing: 4) {
            HStack(spacing: 8) {
                ForEach(TranslationAction.allCases) { action in
                    Button {
                        viewModel.performToolbarAction(action)
                    } label: {
                        HStack(spacing: 4) {
                            Text(action.toolbarSymbol)
                            Text(action.toolbarTitle)
                                .font(.system(size: 13, weight: .medium))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.primary.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .disabled(isBusy)
                }

                Spacer()

                Button {
                    viewModel.toggleDirection()
                } label: {
                    Text(viewModel.direction.shortLabel)
                        .font(.system(size: 13, weight: .medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.primary.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .disabled(isBusy)
            }

            if !viewModel.status.message.isEmpty {
                HStack(spacing: 6) {
                    if case .working = viewModel.status {
                        ProgressView().scaleEffect(0.7)
                    }
                    Text(viewModel.status.message)
                        .font(.system(size: 12))
                        .foregroundColor(statusColor)
                        .lineLimit(1)
                    Spacer()
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
    }

    private var isBusy: Bool {
        if case .working = viewModel.status { return true }
        return false
    }

    private var statusColor: Color {
        switch viewModel.status {
        case .error, .needsFullAccess: return .red
        case .success: return .green
        default: return .secondary
        }
    }
}
