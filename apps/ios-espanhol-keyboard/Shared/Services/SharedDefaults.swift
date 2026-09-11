import Foundation

/// Thin wrapper around the App Group `UserDefaults` suite that the host app
/// and the keyboard extension both read/write. Only non-sensitive settings
/// live here (never the API key — that goes to the Keychain).
enum SharedDefaults {
    static let appGroupID = "group.com.tripradar.espanholiakeyboard"
    private static let settingsKey = "app_settings_v1"

    private static var suite: UserDefaults {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            assertionFailure("App Group '\(appGroupID)' is not configured for this target.")
            return .standard
        }
        return defaults
    }

    static func loadSettings() -> AppSettings {
        guard
            let data = suite.data(forKey: settingsKey),
            let decoded = try? JSONDecoder().decode(AppSettings.self, from: data)
        else {
            return .default
        }
        return decoded
    }

    static func save(_ settings: AppSettings) {
        guard let data = try? JSONEncoder().encode(settings) else { return }
        suite.set(data, forKey: settingsKey)
    }
}
