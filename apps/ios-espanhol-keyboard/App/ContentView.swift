import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = SettingsViewModel()

    var body: some View {
        Group {
            if viewModel.settings.hasCompletedOnboarding {
                MainTabView(viewModel: viewModel)
            } else {
                OnboardingView(viewModel: viewModel)
            }
        }
    }
}

private struct MainTabView: View {
    @ObservedObject var viewModel: SettingsViewModel

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Início", systemImage: "house") }

            SettingsView(viewModel: viewModel)
                .tabItem { Label("Ajustes", systemImage: "gearshape") }

            PrivacyPolicyView()
                .tabItem { Label("Privacidade", systemImage: "lock") }
        }
    }
}
