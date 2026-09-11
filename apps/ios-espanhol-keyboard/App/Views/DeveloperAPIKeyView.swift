#if DEBUG
import SwiftUI

/// Development-only screen. Lets you paste an Anthropic API key so the app
/// and keyboard extension can call `api.anthropic.com` directly while you
/// iterate locally. **Never ship a build with this screen reachable** — see
/// `AppConfig` and the README for the production (backend proxy) path.
struct DeveloperAPIKeyView: View {
    @ObservedObject var viewModel: SettingsViewModel

    var body: some View {
        Form {
            Section {
                SecureField("sk-ant-...", text: $viewModel.devAPIKey)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            } header: {
                Text("Chave de API da Anthropic")
            } footer: {
                Text("Armazenada no Keychain, compartilhada apenas entre este app e a extensão de teclado via App Group + Keychain Access Group. Nunca é enviada para nenhum lugar além de api.anthropic.com.")
            }

            Section {
                Button("Salvar", action: viewModel.saveDevAPIKey)
            }

            Section {
                Label("Modo de desenvolvimento ativo", systemImage: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
            } footer: {
                Text("Builds de produção (TestFlight/App Store) devem usar AppConfig.mode = .backendProxy, que mantém a chave real apenas no seu servidor. Ver BackendProxyExample/.")
            }
        }
        .navigationTitle("API Key (Dev)")
    }
}
#endif
