import SwiftUI
import Observation

@Observable
final class MangaDetailViewModel {

    let manga: MangaSummary

    var chapters: [ChapterSummary] = []
    var isLoading = false
    var error: String?
    var selectedLanguage: String = "it"

    private var total = 0
    private var offset = 0

    init(manga: MangaSummary) {
        self.manga = manga
        // Auto-select language: prefer italian if available
        if manga.availableLanguages.contains("it") {
            selectedLanguage = "it"
        } else if manga.availableLanguages.contains("en") {
            selectedLanguage = "en"
        } else {
            selectedLanguage = manga.availableLanguages.first ?? "en"
        }
    }

    @MainActor
    func loadChapters() async {
        chapters = []
        offset = 0
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            var allChapters: [ChapterSummary] = []
            var currentOffset = 0
            repeat {
                let result = try await MangaDexService.shared.fetchChapters(
                    mangaId: manga.id,
                    languages: [selectedLanguage],
                    offset: currentOffset,
                    limit: 100
                )
                allChapters.append(contentsOf: result.items)
                total = result.total
                currentOffset += result.items.count
            } while allChapters.count < total && currentOffset < total
            chapters = allChapters
        } catch {
            self.error = error.localizedDescription
        }
    }

    var availableLanguages: [(code: String, label: String)] {
        manga.availableLanguages
            .filter { ["it", "en", "ja", "fr", "es", "de", "pt-br"].contains($0) }
            .map { code in
                let label: String = switch code {
                case "it": "Italiano"
                case "en": "English"
                case "ja": "日本語"
                case "fr": "Français"
                case "es": "Español"
                case "de": "Deutsch"
                case "pt-br": "Português"
                default: code.uppercased()
                }
                return (code, label)
            }
    }
}
