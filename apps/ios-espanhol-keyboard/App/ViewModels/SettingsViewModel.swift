import Foundation
import Combine

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var settings: AppSettings {
        didSet { SharedDefaults.save(settings) }
    }

    @Published var devAPIKey: String = ""

    init() {
        self.settings = SharedDefaults.loadSettings()
        self.devAPIKey = KeychainService.loadDevAPIKey() ?? ""
    }

    func completeOnboarding() {
        settings.hasCompletedOnboarding = true
    }

    func saveDevAPIKey() {
        let trimmed = devAPIKey.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            KeychainService.deleteDevAPIKey()
        } else {
            KeychainService.saveDevAPIKey(trimmed)
        }
    }
}
