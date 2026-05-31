import SwiftUI
import Observation

@Observable
final class LibraryStore {

    static let shared = LibraryStore()

    private let key = "yomi.library"

    private(set) var savedManga: [SavedManga] = [] {
        didSet { persist() }
    }

    init() {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([SavedManga].self, from: data) {
            savedManga = decoded
        }
    }

    func isSaved(_ id: String) -> Bool {
        savedManga.contains { $0.id == id }
    }

    func toggle(_ manga: MangaSummary) {
        if let idx = savedManga.firstIndex(where: { $0.id == manga.id }) {
            savedManga.remove(at: idx)
        } else {
            savedManga.insert(SavedManga(from: manga), at: 0)
        }
    }

    // MARK: - Read progress

    private let progressKey = "yomi.progress"
    private var progress: [String: String] = [:] {
        didSet {
            if let data = try? JSONEncoder().encode(progress) {
                UserDefaults.standard.set(data, forKey: progressKey)
            }
        }
    }

    init(withProgress: Bool) {
        if let data = UserDefaults.standard.data(forKey: key),
           let decoded = try? JSONDecoder().decode([SavedManga].self, from: data) {
            savedManga = decoded
        }
        if let data = UserDefaults.standard.data(forKey: progressKey),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            progress = decoded
        }
    }

    func markRead(mangaId: String, chapterId: String) {
        progress[mangaId] = chapterId
    }

    func lastReadChapter(mangaId: String) -> String? {
        progress[mangaId]
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(savedManga) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

struct SavedManga: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let coverFileName: String?
    let savedAt: Date

    var coverURL: URL? {
        guard let fn = coverFileName else { return nil }
        return URL(string: "https://uploads.mangadex.org/covers/\(id)/\(fn).256.jpg")
    }

    init(from manga: MangaSummary) {
        id = manga.id
        title = manga.title
        coverFileName = manga.coverFileName
        savedAt = .now
    }
}
