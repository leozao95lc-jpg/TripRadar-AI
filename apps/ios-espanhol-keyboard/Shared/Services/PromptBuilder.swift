import Foundation

/// Builds the system + user prompt sent to Claude for each toolbar action.
/// Kept in one place so prompt tuning never means hunting through UI code.
enum PromptBuilder {
    static func systemPrompt(for action: TranslationAction, direction: TranslationDirection, variant: SpanishVariant) -> String {
        switch action {
        case .translate:
            return translatePrompt(direction: direction, variant: variant)
        case .natural:
            return naturalPrompt(direction: direction, variant: variant)
        case .correct:
            return correctPrompt(direction: direction)
        }
    }

    // MARK: - Translate

    private static func translatePrompt(direction: TranslationDirection, variant: SpanishVariant) -> String {
        let (sourceName, targetName) = languageNames(for: direction, variant: variant)
        return """
        Traduza o texto do usuário de \(sourceName) para \(targetName).

        Regras:
        - Preserve o significado original.
        - Preserve a intenção.
        - Preserve o nível de informalidade ou formalidade.
        - Use uma linguagem natural, do jeito que um nativo escreveria.
        - Não traduza literalmente quando isso gerar uma frase estranha.
        - Adapte expressões idiomáticas para equivalentes naturais no idioma de destino.
        - Preserve emojis exatamente como estão.
        - Preserve nomes próprios, marcas e handles (@usuario).
        - Não adicione explicações, notas ou comentários.
        - Não coloque aspas ao redor do resultado.
        - Retorne SOMENTE o texto traduzido, nada mais.
        """
    }

    // MARK: - Natural (idiomatic rewrite, not a literal translation)

    private static func naturalPrompt(direction: TranslationDirection, variant: SpanishVariant) -> String {
        let (sourceName, targetName) = languageNames(for: direction, variant: variant)
        return """
        Reescreva o texto do usuário, que está em \(sourceName), como uma frase equivalente
        em \(targetName), do jeito que uma pessoa nativa realmente diria no dia a dia —
        não uma tradução automática/literal.

        Regras:
        - Priorize naturalidade sobre fidelidade palavra-por-palavra.
        - Use gírias, contrações e construções coloquiais quando fizerem sentido para o registro do texto original.
        - Preserve o significado, a intenção e o tom (formal, informal, engraçado, sério etc.).
        - Preserve emojis.
        - Preserve nomes próprios.
        - Não adicione explicações nem comentários sobre a tradução.
        - Não coloque aspas ao redor do resultado.
        - Retorne SOMENTE o texto reescrito, nada mais.
        """
    }

    // MARK: - Correct (same language, fix grammar/typos/punctuation)

    private static func correctPrompt(direction: TranslationDirection) -> String {
        let languageName = direction.source == .portuguese ? "português brasileiro" : "espanhol"
        return """
        Corrija o texto do usuário, escrito em \(languageName).

        Regras:
        - Corrija ortografia, digitação, concordância e pontuação.
        - Mantenha o estilo, o tom e o vocabulário originais do autor.
        - Não reescreva a mensagem nem mude o significado.
        - Não traduza para outro idioma.
        - Preserve emojis e nomes próprios.
        - Não adicione explicações nem comentários.
        - Não coloque aspas ao redor do resultado.
        - Retorne SOMENTE o texto corrigido, nada mais.
        """
    }

    private static func languageNames(for direction: TranslationDirection, variant: SpanishVariant) -> (source: String, target: String) {
        switch direction {
        case .ptToEs:
            return ("português brasileiro", variant.promptLabel)
        case .esToPt:
            return (variant.promptLabel, "português brasileiro")
        }
    }
}
