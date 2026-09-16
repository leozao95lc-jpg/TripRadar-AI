import SwiftUI

struct SettingsView: View {
    @ObservedObject var viewModel: SettingsViewModel

    var body: some View {
        NavigationView {
            Form {
                Section("Variante do espanhol") {
                    Picker("Variante", selection: $viewModel.settings.variant) {
                        ForEach(SpanishVariant.allCases) { variant in
                            Text(variant.displayName).tag(variant)
                        }
                    }
                    .pickerStyle(.inline)
                }

                Section("Direção padrão") {
                    Picker("Direção", selection: $viewModel.settings.defaultDirection) {
                        Text("🇧🇷 Português → 🇪🇸 Espanhol").tag(TranslationDirection.ptToEs)
                        Text("🇪🇸 Espanhol → 🇧🇷 Português").tag(TranslationDirection.esToPt)
                    }
                    .pickerStyle(.inline)
                }

                Section {
                    Toggle("Detecção automática de idioma", isOn: $viewModel.settings.autoDetectEnabled)
                } footer: {
                    Text("Quando ativada, o teclado detecta automaticamente se você escreveu em português ou espanhol e traduz na direção correta, ignorando a direção padrão acima.")
                }

                #if DEBUG
                Section {
                    NavigationLink("Chave de API (desenvolvimento)") {
                        DeveloperAPIKeyView(viewModel: viewModel)
                    }
                } footer: {
                    Text("Disponível apenas em builds de desenvolvimento. Builds de produção usam um backend seguro — veja BackendProxyExample/.")
                }
                #endif

                Section {
                    NavigationLink("Política de Privacidade") {
                        PrivacyPolicyView()
                    }
                }
            }
            .navigationTitle("Ajustes")
        }
    }
}
