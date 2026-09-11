import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("🇪🇸 Espanhol IA Keyboard")
                        .font(.title.bold())

                    Text("Traduza qualquer mensagem para espanhol sem sair do app onde você está digitando.")
                        .foregroundColor(.secondary)

                    stepCard(
                        number: "1",
                        title: "Ative o teclado",
                        text: "Ajustes do iPhone → Geral → Teclado → Teclados → Adicionar Novo Teclado → Espanhol IA."
                    )
                    stepCard(
                        number: "2",
                        title: "Permita Acesso Total",
                        text: "Necessário para o teclado poder chamar a IA pela internet. Veja a aba Privacidade para entender exatamente o que isso significa."
                    )
                    stepCard(
                        number: "3",
                        title: "Use no WhatsApp, Instagram, etc.",
                        text: "Troque para o teclado 🌐 e toque em 🇪🇸 Traduzir, ✨ Natural ou ✍️ Corrigir."
                    )
                }
                .padding()
            }
            .navigationTitle("Início")
        }
    }

    private func stepCard(number: String, title: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.headline)
                .frame(width: 28, height: 28)
                .background(Color.accentColor.opacity(0.15))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(text).font(.subheadline).foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
