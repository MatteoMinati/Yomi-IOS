import SwiftUI
import Observation

@Observable
final class HomeViewModel {

    var popularManga: [MangaSummary] = []
    var recentManga: [MangaSummary] = []
    var isLoading = false
    var error: String?

    private var popularTotal = 0
    private var popularOffset = 0
    private var isLoadingMore = false

    @MainActor
    func load() async {
        guard popularManga.isEmpty else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            async let popular = MangaDexService.shared.fetchPopular(offset: 0, limit: 20)
            async let recent = MangaDexService.shared.fetchLatestUpdated(offset: 0, limit: 20)
            let (p, r) = try await (popular, recent)
            popularManga = p.items
            popularTotal = p.total
            popularOffset = p.items.count
            recentManga = r.items
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func loadMorePopular() async {
        guard !isLoadingMore, popularOffset < popularTotal else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let result = try await MangaDexService.shared.fetchPopular(offset: popularOffset, limit: 20)
            popularManga.append(contentsOf: result.items)
            popularOffset += result.items.count
            popularTotal = result.total
        } catch {}
    }
}
