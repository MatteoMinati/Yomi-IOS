import SwiftUI
import Observation

@Observable
final class SearchViewModel {

    var query = ""
    var results: [MangaSummary] = []
    var isLoading = false
    var error: String?
    var selectedLanguages: Set<String> = ["it", "en"]

    private var total = 0
    private var offset = 0
    private var lastQuery = ""
    private var searchTask: Task<Void, Never>?

    @MainActor
    func onQueryChange() {
        searchTask?.cancel()
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else {
            results = []
            return
        }
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await performSearch(reset: true)
        }
    }

    @MainActor
    func performSearch(reset: Bool) async {
        if reset {
            results = []
            offset = 0
        }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let langs = Array(selectedLanguages)
            let result = try await MangaDexService.shared.search(
                query: query,
                languages: langs,
                offset: offset,
                limit: 20
            )
            results.append(contentsOf: result.items)
            total = result.total
            offset += result.items.count
            lastQuery = query
        } catch {
            if !(error is CancellationError) {
                self.error = error.localizedDescription
            }
        }
    }

    @MainActor
    func loadMore() async {
        guard !isLoading, offset < total, query == lastQuery else { return }
        await performSearch(reset: false)
    }
}
