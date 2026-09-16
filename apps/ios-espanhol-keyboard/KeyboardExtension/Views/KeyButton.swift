import SwiftUI

struct KeyButton: View {
    let label: String
    var isSpecial: Bool = false
    var flexWidth: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 20))
                .frame(maxWidth: flexWidth ? .infinity : nil)
                .frame(minWidth: flexWidth ? nil : 30, minHeight: 42)
                .padding(.horizontal, flexWidth ? 0 : 6)
                .background(isSpecial ? Color.primary.opacity(0.12) : Color.primary.opacity(0.06))
                .foregroundColor(.primary)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}
