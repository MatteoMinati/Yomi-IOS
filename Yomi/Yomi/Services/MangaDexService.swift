import Foundation

actor MangaDexService {

    static let shared = MangaDexService()
    private let base = URL(string: "https://api.mangadex.org")!

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.urlCache = URLCache(memoryCapacity: 20 * 1024 * 1024,
                                diskCapacity: 200 * 1024 * 1024)
        cfg.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: cfg)
    }()

    // MARK: - Manga list

    func fetchPopular(offset: Int = 0, limit: Int = 20) async throws -> (items: [MangaSummary], total: Int) {
        var comps = URLComponents(url: base.appending(path: "/manga"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
            .init(name: "order[followedCount]", value: "desc"),
            .init(name: "contentRating[]", value: "safe"),
            .init(name: "contentRating[]", value: "suggestive"),
            .init(name: "includes[]", value: "cover_art"),
            .init(name: "availableTranslatedLanguage[]", value: "it"),
        ]
        let resp: MangaDexResponse<[MangaEntity]> = try await get(comps.url!)
        return (resp.data.map(MangaSummary.init), resp.total ?? 0)
    }

    func fetchLatestUpdated(offset: Int = 0, limit: Int = 20) async throws -> (items: [MangaSummary], total: Int) {
        var comps = URLComponents(url: base.appending(path: "/manga"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
            .init(name: "order[updatedAt]", value: "desc"),
            .init(name: "contentRating[]", value: "safe"),
            .init(name: "contentRating[]", value: "suggestive"),
            .init(name: "includes[]", value: "cover_art"),
        ]
        let resp: MangaDexResponse<[MangaEntity]> = try await get(comps.url!)
        return (resp.data.map(MangaSummary.init), resp.total ?? 0)
    }

    func search(query: String, languages: [String], offset: Int = 0, limit: Int = 20) async throws -> (items: [MangaSummary], total: Int) {
        var comps = URLComponents(url: base.appending(path: "/manga"), resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
            .init(name: "title", value: query),
            .init(name: "contentRating[]", value: "safe"),
            .init(name: "contentRating[]", value: "suggestive"),
            .init(name: "includes[]", value: "cover_art"),
        ]
        for lang in languages {
            items.append(.init(name: "availableTranslatedLanguage[]", value: lang))
        }
        comps.queryItems = items
        let resp: MangaDexResponse<[MangaEntity]> = try await get(comps.url!)
        return (resp.data.map(MangaSummary.init), resp.total ?? 0)
    }

    // MARK: - Chapters

    func fetchChapters(mangaId: String, languages: [String], offset: Int = 0, limit: Int = 100) async throws -> (items: [ChapterSummary], total: Int) {
        var comps = URLComponents(url: base.appending(path: "/manga/\(mangaId)/feed"), resolvingAgainstBaseURL: false)!
        var items: [URLQueryItem] = [
            .init(name: "limit", value: "\(limit)"),
            .init(name: "offset", value: "\(offset)"),
            .init(name: "order[volume]", value: "asc"),
            .init(name: "order[chapter]", value: "asc"),
            .init(name: "includes[]", value: "scanlation_group"),
        ]
        for lang in languages {
            items.append(.init(name: "translatedLanguage[]", value: lang))
        }
        comps.queryItems = items
        let resp: MangaDexResponse<[ChapterEntity]> = try await get(comps.url!)
        let chapters = resp.data
            .map(ChapterSummary.init)
            .filter { !$0.isExternal }
        return (chapters, resp.total ?? 0)
    }

    // MARK: - Pages

    func fetchPages(chapterId: String, dataSaver: Bool = false) async throws -> [URL] {
        let url = base.appending(path: "/at-home/server/\(chapterId)")
        let resp: AtHomeResponse = try await get(url)
        let filenames = dataSaver ? resp.chapter.dataSaver : resp.chapter.data
        let quality = dataSaver ? "data-saver" : "data"
        return filenames.compactMap { name in
            URL(string: "\(resp.baseUrl)/\(quality)/\(resp.chapter.hash)/\(name)")
        }
    }

    // MARK: - Generic GET

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        var req = URLRequest(url: url)
        req.setValue("Yomi/1.0 (MangaDex iOS Reader)", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

enum APIError: LocalizedError {
    case badStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badStatus(let code): "Errore API: \(code)"
        }
    }
}
