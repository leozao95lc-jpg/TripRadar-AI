# Espanhol IA Keyboard

Teclado personalizado para iOS que traduz/adapta texto entre português
brasileiro e espanhol (Espanha ou América Latina) usando a API da Anthropic
(Claude), sem sair do app onde você está digitando (WhatsApp, Instagram,
Telegram, Gmail, Safari, etc.).

Este diretório é um projeto Xcode completo (app + extensão de teclado),
organizado para evoluir até publicação na App Store — não é um protótipo
descartável.

## Estrutura

```
ios-espanhol-keyboard/
├── project.yml                  # definição do projeto (XcodeGen)
├── App/                          # app principal (SwiftUI)
│   ├── EspanholIAKeyboardApp.swift
│   ├── ContentView.swift
│   ├── Views/                    # Home, Onboarding, Settings, Privacidade, Dev API Key
│   └── ViewModels/
├── KeyboardExtension/             # a Custom Keyboard Extension (UIKit host + SwiftUI UI)
│   ├── KeyboardViewController.swift
│   ├── Views/                    # ToolbarView, QwertyKeyboardView, KeyButton
│   └── ViewModels/                # KeyboardViewModel, layout, proxy abstraction
├── Shared/                        # código usado pelos dois targets
│   ├── Models/                    # AppLanguage, TranslationAction, AppSettings...
│   └── Services/                  # AnthropicService, cliente HTTP, prompts, cache, Keychain
└── BackendProxyExample/           # servidor Node de referência para produção
```

Arquitetura: **MVVM** em cada target (App e KeyboardExtension), com uma
camada `Shared/Services` compartilhada — nenhuma chamada HTTP é feita fora
de `AnthropicAPIClient`/`AnthropicService`.

## Gerando o projeto Xcode

Este repositório não versiona o `.xcodeproj` (evita conflitos de merge em
arquivos binários/XML gigantes). Em vez disso, use o
[XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd apps/ios-espanhol-keyboard
xcodegen generate
open EspanholIAKeyboard.xcodeproj
```

Depois, no Xcode:

1. Selecione seu Team em **Signing & Capabilities** para os dois targets
   (`EspanholIAKeyboard` e `KeyboardExtension`).
2. Ajuste os identificadores de App Group / Keychain Group em
   `project.yml` (`group.com.tripradar.espanholiakeyboard`) para algo sob o
   seu próprio Team ID, e rode `xcodegen generate` de novo.
3. (Dev) Rode o target `EspanholIAKeyboard`, abra **Ajustes → Chave de API
   (desenvolvimento)** e cole sua chave da Anthropic.
4. No dispositivo: **Ajustes → Geral → Teclado → Teclados → Adicionar Novo
   Teclado → Espanhol IA**, depois toque no teclado adicionado e ative
   **Permitir Acesso Total**.

> Este código foi escrito e revisado neste ambiente sem acesso a macOS/Xcode,
> então não foi compilado aqui. Ele segue as APIs públicas documentadas da
> Apple (`UIInputViewController`, `UITextDocumentProxy`, App Groups,
> Keychain Sharing) e estruturas de projeto padrão, mas a primeira coisa a
> fazer num Mac é `xcodegen generate` + build, e corrigir qualquer detalhe de
> configuração de assinatura/target que só aparece no Xcode.

## Como a tradução funciona

1. Usuário digita normalmente no teclado do app (ex.: WhatsApp).
2. Toca em 🇪🇸 Traduzir / ✨ Natural / ✍️ Corrigir.
3. `KeyboardViewModel` lê o texto via `documentContextBeforeInput` +
   `documentContextAfterInput` (ver limitação abaixo), monta o prompt em
   `PromptBuilder`, e chama `AnthropicService`.
4. `AnthropicService` consulta um cache em memória (evita chamadas
   repetidas) e, se necessário, chama a Anthropic (dev) ou o backend próprio
   (produção) via `AnthropicAPIClient`.
5. O resultado substitui o texto original diretamente no campo, via
   `deleteBackward()`/`insertText()`.

Os prompts de cada ação (Traduzir, Natural, Corrigir) ficam centralizados em
`Shared/Services/PromptBuilder.swift`.

## Chave de API da Anthropic: dev vs. produção

**Nunca** coloque uma chave real da Anthropic hardcoded no código-fonte de
um app distribuído. Uma chave embutida em um binário de app iOS pode ser
extraída por qualquer pessoa com acesso ao IPA (mesmo com ofuscação).

| | Desenvolvimento | Produção |
|---|---|---|
| Onde a chave mora | Keychain do dispositivo (tela **Ajustes → Chave de API**, compilada só em `DEBUG`) | Apenas no seu backend (variável de ambiente) |
| Quem chama a Anthropic | O próprio iPhone (`AnthropicDirectClient`) | Seu servidor (`BackendProxyClient` → `BackendProxyExample/server.js`) |
| Configuração | `AppConfig.mode = .directAnthropic` (já é o padrão em builds `DEBUG`) | `AppConfig.mode = .backendProxy(baseURL:)` (padrão em builds `RELEASE`) |
| Risco se o binário vazar | Sua chave pessoal de dev pode ser extraída — revogue-a se distribuir esse build | Nenhum: o binário não contém segredo algum |

`Shared/Services/AppConfig.swift` já faz essa troca automaticamente por
configuração de build (`#if DEBUG`). Antes de arquivar para TestFlight/App
Store, aponte `baseURL` para o seu backend implantado (ver
`BackendProxyExample/README.md`).

```
iPhone (Keyboard Extension)
   │  dev: chamada direta com chave do Keychain
   │  prod: POST /v1/translate
   ▼
Backend seguro (produção)     ──skip em dev──►
   │
   ▼
Anthropic API
```

## Limitações reais de uma Custom Keyboard Extension (e como lidamos com cada uma)

Isto foi verificado contra a documentação pública da Apple antes de
implementar, para não prometer nada que o iOS não permite:

1. **Não existe "texto selecionado" para o teclado.** `UITextDocumentProxy`
   não expõe a seleção do usuário nem o conteúdo integral do campo — apenas
   `documentContextBeforeInput` e `documentContextAfterInput` (texto antes e
   depois do cursor, e a Apple documenta que pode truncar textos muito
   longos). **O que fizemos:** tratamos `before + after` como "a mensagem
   atual" — funciona bem para o caso de uso real (uma mensagem de chat), mas
   uma conversa gigante em um campo de texto multilinha pode, em teoria, ter
   contexto truncado nas pontas. Não há API pública para contornar isso.

2. **Substituir o texto exige apagar e reinserir.** Não há um
   "replace selection". **O que fizemos:** em
   `KeyboardViewModel.replaceEntireText`, movemos o cursor para o fim do
   texto com `adjustTextPosition(byCharacterOffset:)`, apagamos caractere a
   caractere com `deleteBackward()` e inserimos o resultado com
   `insertText()`. Funciona de forma confiável, mas é literalmente esse o
   mecanismo — não existe atalho mais "atômico" na API pública.

3. **"Permitir Acesso Total" é obrigatório para qualquer rede.** Sem essa
   permissão (que o usuário precisa ativar manualmente nos Ajustes — o app
   não pode ativá-la por código, por design de segurança da Apple), o
   sistema bloqueia chamadas de rede feitas pela extensão. **O que
   fizemos:** checamos `hasFullAccess` antes de qualquer chamada e mostramos
   uma mensagem clara pedindo para ativar, em vez de travar ou falhar
   silenciosamente.

4. **Campos de senha/seguros desativam teclados de terceiros
   automaticamente** (`isSecureTextEntry`) — isso é feito pelo próprio iOS,
   não há nada que o app precise (ou consiga) fazer; o sistema já troca para
   o teclado padrão nesses campos.

5. **Alguns apps podem restringir teclados de terceiros** em campos
   específicos por política própria; não há uma lista pública garantida.
   WhatsApp, Instagram, Telegram, Gmail e Safari usam campos de texto padrão
   e funcionam normalmente com teclados de terceiros nos nossos testes de
   referência de mercado — mas isso pode mudar a critério de cada app.

6. **Limite de memória da extensão.** Keyboard Extensions rodam com um
   teto de memória bem mais baixo que um app normal (na prática, dezenas de
   MB) — o processo é encerrado pelo iOS se ultrapassar. **O que fizemos:**
   mantivemos a extensão enxuta (SwiftUI simples, sem modelos on-device, sem
   imagens pesadas) e todo processamento pesado (a IA) acontece fora do
   dispositivo, via rede.

7. **Sem "Acesso Total", nem sequer tentamos.** Detectar `hasFullAccess ==
   false` cedo evita gastar o orçamento de memória/tempo da extensão em uma
   chamada de rede que o sistema vai bloquear de qualquer forma.

8. **`advanceToNextInputMode()` é obrigatório sempre que
   `needsInputModeSwitchKey` for verdadeiro** (varia por contexto/idioma do
   host) — implementamos o botão 🌐 chamando exatamente esse método, como a
   Apple exige para qualquer teclado de terceiros passar na revisão da App
   Store.

## Detecção automática de idioma

Ativável em Ajustes (`AppSettings.autoDetectEnabled`). Usa o framework
`NaturalLanguage` da Apple **no dispositivo** (`LanguageDetector.swift`) —
não faz chamada de rede só para detectar o idioma, e o usuário pode
desativar a qualquer momento.

## Privacidade

Resumo em `App/Views/PrivacyPolicyView.swift` (texto completo exibido no
app). Pontos-chave: nenhuma mensagem é persistida em disco ou log; o cache
de traduções é só em memória e é limpo quando a extensão é encerrada
(`TranslationCache.clear()` em `KeyboardViewController.deinit`); a chave de
API nunca é logada; em produção, o backend também não grava conteúdo de
mensagens.

## Roadmap sugerido (fora do escopo desta primeira versão)

- Testes unitários para `PromptBuilder`, `AnthropicService` (com um
  `TranslationBackend` fake) e `KeyboardViewModel` (com um
  `TextDocumentProxyProviding` fake).
- Telemetria agregada e anônima de erros (sem conteúdo de texto) para saber
  taxa de falha real em produção.
- Suporte a temas claro/escuro customizados e Dynamic Type na extensão.
- Histórico opcional (opt-in, local, criptografado) das últimas traduções,
  claramente distinto do comportamento padrão "não guarda nada".
