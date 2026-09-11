import SwiftUI

struct OnboardingView: View {
    @ObservedObject var viewModel: SettingsViewModel
    @State private var step = 0

    private let pages: [(title: String, text: String, symbol: String)] = [
        ("Bem-vindo(a)!", "O Espanhol IA Keyboard traduz suas mensagens para espanhol direto de onde você está digitando: WhatsApp, Instagram, Telegram, Gmail e mais.", "character.bubble"),
        ("1. Ative o teclado", "Vá em Ajustes → Geral → Teclado → Teclados → Adicionar Novo Teclado, e escolha \"Espanhol IA\".", "keyboard"),
        ("2. Permita Acesso Total", "Isso é necessário para o teclado conseguir enviar o texto que você digitou para a IA e receber a tradução. Sem isso, os botões de tradução não funcionam — é uma exigência do próprio iOS para qualquer teclado que precise de internet.", "wifi"),
        ("Sua privacidade", "Suas mensagens não são armazenadas por nós. Elas são enviadas apenas para a IA processar a tradução e descartadas em seguida. Veja os detalhes completos na aba Privacidade.", "lock.shield")
    ]

    var body: some View {
        VStack {
            TabView(selection: $step) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    VStack(spacing: 20) {
                        Image(systemName: page.symbol)
                            .font(.system(size: 56))
                            .foregroundColor(.accentColor)
                        Text(page.title).font(.title2.bold())
                        Text(page.text)
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 24)
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(.page)

            Button(step == pages.count - 1 ? "Começar" : "Próximo") {
                if step == pages.count - 1 {
                    viewModel.completeOnboarding()
                } else {
                    step += 1
                }
            }
            .buttonStyle(.borderedProminent)
            .padding(.bottom, 32)
        }
    }
}
