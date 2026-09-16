import Foundation
import Security

/// Stores the *development-only* Anthropic API key in the Keychain, shared
/// between the host app and the keyboard extension via a Keychain Access
/// Group (both targets must list the same group in their entitlements).
///
/// This is deliberately not used for anything else — no message text, no
/// translation history, nothing user-generated ever touches the Keychain.
enum KeychainService {
    private static let service = "com.tripradar.espanholiakeyboard.anthropic"
    private static let account = "dev-api-key"

    private static var accessGroup: String {
        Bundle.main.object(forInfoDictionaryKey: "KeychainAccessGroup") as? String
            ?? "$(AppIdentifierPrefix)com.tripradar.espanholiakeyboard.shared"
    }

    static func saveDevAPIKey(_ key: String) {
        let data = Data(key.utf8)
        var query = baseQuery()
        SecItemDelete(query as CFDictionary)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(query as CFDictionary, nil)
    }

    static func loadDevAPIKey() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func deleteDevAPIKey() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup
        ]
    }
}
