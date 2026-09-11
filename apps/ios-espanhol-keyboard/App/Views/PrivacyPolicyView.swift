import SwiftUI

struct PrivacyPolicyView: View {
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(PrivacyPolicyView.bodyText)
                        .font(.body)
                }
                .padding()
            }
            .navigationTitle("Privacidade")
        }
    }

    static let bodyText = """
    POLÍTICA DE PRIVACIDADE — ESPANHOL IA KEYBOARD

    O que o teclado faz com o seu texto
    Quando você toca em um dos botões da barra (Traduzir, Natural ou Corrigir), o texto \
    visível no campo onde você está digitando é enviado para processamento por IA \
    (Anthropic Claude, diretamente em builds de desenvolvimento, ou através do nosso \
    backend em builds de produção) com o único propósito de gerar a tradução/correção \
    solicitada. O resultado é inserido de volta no mesmo campo.

    O que NÃO fazemos
    • Não armazenamos suas mensagens em nenhum banco de dados, nosso ou de terceiros.
    • Não mantemos histórico de conversas.
    • Não registramos o conteúdo do seu texto em logs.
    • Não compartilhamos dados com terceiros além do provedor de IA necessário para a \
    tradução (e, em produção, nosso próprio backend, que também não armazena o conteúdo).
    • Não usamos suas mensagens para treinar modelos.

    Cache temporário
    Para evitar chamadas repetidas à IA com o mesmo texto, mantemos um cache pequeno \
    apenas em memória (RAM), que é apagado automaticamente quando você troca de teclado \
    ou fecha o app onde estava digitando. Nada é gravado em disco.

    "Permitir Acesso Total"
    O iOS exige essa permissão para qualquer teclado de terceiros que precise acessar a \
    internet — sem ela, não é tecnicamente possível fazer chamadas de rede a partir do \
    teclado. Ativá-la não dá ao teclado acesso a outros dados do seu iPhone além do que \
    o próprio teclado já processa (o texto que você digita nos campos onde ele está ativo).

    Campos seguros (senhas, dados de pagamento)
    O iOS desativa automaticamente teclados de terceiros em campos marcados como \
    entrada segura (por exemplo, campos de senha). Nesses casos, o teclado padrão do \
    sistema é usado automaticamente e o Espanhol IA Keyboard não tem acesso a esse texto.

    Chave de API
    Em builds de desenvolvimento, a chave de API é guardada no Keychain do dispositivo, \
    protegida pelo sistema operacional. Em builds de produção, a chave real da Anthropic \
    nunca existe no aplicativo: as chamadas passam por um backend próprio que a mantém \
    em segredo no servidor.

    Contato
    Dúvidas sobre privacidade podem ser enviadas para o desenvolvedor do aplicativo.
    """
}
