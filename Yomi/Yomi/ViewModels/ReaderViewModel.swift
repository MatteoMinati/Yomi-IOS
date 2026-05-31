import SwiftUI
import Observation

@Observable
final class ReaderViewModel {

    let chapter: ChapterSummary
    let mangaId: String

    var pages: [URL] = []
    var currentPage = 0
    var isLoading = false
    var error: String?
    var dataSaver = false
    var readingMode: ReadingMode = .horizontal
    var showUI = true

    init(chapter: ChapterSummary, mangaId: String) {
        self.chapter = chapter
        self.mangaId = mangaId
    }

    @MainActor
    func load() async {
        guard pages.isEmpty else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            pages = try await MangaDexService.shared.fetchPages(
                chapterId: chapter.id,
                dataSaver: dataSaver
            )
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markProgress() {
        LibraryStore.shared.markRead(mangaId: mangaId, chapterId: chapter.id)
    }
}

enum ReadingMode: String, CaseIterable {
    case horizontal = "Orizzontale"
    case vertical   = "Verticale"

    var icon: String {
        switch self {
        case .horizontal: "rectangle.split.3x1"
        case .vertical:   "rectangle.split.1x2"
        }
    }
}
