import Foundation

enum TranslationBackendError: LocalizedError {
    case missingAPIKey
    case invalidResponse
    case http(status: Int, body: String)
    case emptyCompletion
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Nenhuma API key configurada. Abra o app e configure o modo de desenvolvimento."
        case .invalidResponse:
            return "Resposta inesperada do servidor."
        case .http(let status, _):
            return "Erro de rede (HTTP \(status))."
        case .emptyCompletion:
            return "A IA não retornou nenhum texto."
        case .network(let error):
            return error.localizedDescription
        }
    }

    /// Whether a retry is worth attempting.
    var isTransient: Bool {
        switch self {
        case .http(let status, _):
            return status == 429 || (500...599).contains(status)
        case .network:
            return true
        case .missingAPIKey, .invalidResponse, .emptyCompletion:
            return false
        }
    }
}

/// Something that can turn (system prompt, user text) into a completion.
/// Two implementations exist: one that talks to Anthropic directly (dev
/// only) and one that talks through our own backend (production).
protocol TranslationBackend {
    func complete(system: String, userText: String) async throws -> String
}

/// Shared retry-with-backoff wrapper. Both backends route their single HTTP
/// call through this so we don't duplicate retry logic.
enum NetworkRetry {
    static func run<T>(maxRetries: Int = AppConfig.maxRetries, _ operation: @escaping () async throws -> T) async throws -> T {
        var attempt = 0
        while true {
            do {
                return try await operation()
            } catch let error as TranslationBackendError {
                attempt += 1
                guard error.isTransient, attempt <= maxRetries else { throw error }
                let backoffNanos = UInt64(pow(2.0, Double(attempt)) * 200_000_000)
                try? await Task.sleep(nanoseconds: backoffNanos)
            }
        }
    }
}

/// Calls `api.anthropic.com` directly using a Keychain-stored key.
/// **Development only** — see `AppConfig` for why this must never ship.
struct AnthropicDirectClient: TranslationBackend {
    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = AppConfig.requestTimeout
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)
    }

    func complete(system: String, userText: String) async throws -> String {
        guard let apiKey = KeychainService.loadDevAPIKey(), !apiKey.isEmpty else {
            throw TranslationBackendError.missingAPIKey
        }

        return try await NetworkRetry.run {
            var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
            request.httpMethod = "POST"
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
            request.setValue(AppConfig.anthropicVersion, forHTTPHeaderField: "anthropic-version")
            request.setValue("application/json", forHTTPHeaderField: "content-type")

            let payload: [String: Any] = [
                "model": AppConfig.anthropicModel,
                "max_tokens": 1024,
                "system": system,
                "messages": [
                    ["role": "user", "content": userText]
                ]
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (data, response): (Data, URLResponse)
            do {
                (data, response) = try await session.data(for: request)
            } catch {
                throw TranslationBackendError.network(error)
            }

            guard let http = response as? HTTPURLResponse else {
                throw TranslationBackendError.invalidResponse
            }
            guard (200...299).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                throw TranslationBackendError.http(status: http.statusCode, body: body)
            }

            return try Self.extractText(from: data)
        }
    }

    private static func extractText(from data: Data) throws -> String {
        guard
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let content = json["content"] as? [[String: Any]],
            let firstBlock = content.first,
            let text = firstBlock["text"] as? String
        else {
            throw TranslationBackendError.invalidResponse
        }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw TranslationBackendError.emptyCompletion }
        return trimmed
    }
}

/// Calls our own backend, which holds the real Anthropic key server-side.
/// This is the architecture used for any build distributed to real users.
/// See `BackendProxyExample/` for a reference server implementation.
struct BackendProxyClient: TranslationBackend {
    let baseURL: URL
    private let session: URLSession

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = AppConfig.requestTimeout
        self.session = URLSession(configuration: config)
    }

    func complete(system: String, userText: String) async throws -> String {
        try await NetworkRetry.run {
            var request = URLRequest(url: baseURL.appendingPathComponent("v1/translate"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "content-type")

            let payload: [String: Any] = ["system": system, "text": userText]
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (data, response): (Data, URLResponse)
            do {
                (data, response) = try await session.data(for: request)
            } catch {
                throw TranslationBackendError.network(error)
            }

            guard let http = response as? HTTPURLResponse else {
                throw TranslationBackendError.invalidResponse
            }
            guard (200...299).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                throw TranslationBackendError.http(status: http.statusCode, body: body)
            }

            guard
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let text = json["text"] as? String,
                !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else {
                throw TranslationBackendError.invalidResponse
            }
            return text.trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }
}
