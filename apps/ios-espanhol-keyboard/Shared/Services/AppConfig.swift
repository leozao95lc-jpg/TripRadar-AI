import Foundation

/// Decides how the app talks to Claude.
///
/// - `.directAnthropic` calls `api.anthropic.com` straight from the device using
///   a key stored in the Keychain. This is **only** safe for local development:
///   anyone who jailbreaks the device or inspects network traffic before TLS
///   (e.g. via a re-signed build) can recover the key. Never ship this mode in
///   a build distributed through TestFlight/App Store.
/// - `.backendProxy` sends the request to your own server, which holds the real
///   Anthropic key server-side and forwards the completion back. This is the
///   only architecture safe for production distribution. See
///   `BackendProxyExample/` for a minimal reference implementation.
enum APIMode: Equatable {
    case directAnthropic
    case backendProxy(baseURL: URL)
}

enum AppConfig {
    /// Flip this — or better, drive it from a build configuration / xcconfig —
    /// before archiving for TestFlight or the App Store.
    #if DEBUG
    static let mode: APIMode = .directAnthropic
    #else
    static let mode: APIMode = .backendProxy(
        baseURL: URL(string: "https://your-backend.example.com")!
    )
    #endif

    static let anthropicModel = "claude-sonnet-5"
    static let anthropicVersion = "2023-06-01"
    static let requestTimeout: TimeInterval = 15
    static let maxRetries = 2
}
