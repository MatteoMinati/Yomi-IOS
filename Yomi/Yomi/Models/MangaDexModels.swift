import Foundation

// MARK: - Shared

struct MangaDexResponse<T: Decodable>: Decodable {
    let result: String
    let response: String?
    let data: T
    let limit: Int?
    let offset: Int?
    let total: Int?
}

struct MangaDexEntity<A: Decodable>: Decodable {
    let id: String
    let type: String
    let attributes: A
    let relationships: [Relationship]?
}

struct Relationship: Decodable {
    let id: String
    let type: String
    let attributes: RelationshipAttributes?
}

struct RelationshipAttributes: Decodable {
    let fileName: String?        // cover_art
    let name: String?            // author / artist
}

// MARK: - Manga

typealias MangaEntity = MangaDexEntity<MangaAttributes>

struct MangaAttributes: Decodable {
    let title: LocalizedString
    let altTitles: [LocalizedString]?
    let description: LocalizedString?
    let status: String?
    let year: Int?
    let contentRating: String?
    let tags: [TagEntity]?
    let availableTranslatedLanguages: [String]?
    let lastVolume: String?
    let lastChapter: String?
}

struct LocalizedString: Decodable {
    let values: [String: String]

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        values = (try? container.decode([String: String].self)) ?? [:]
    }

    func preferred(languages: [String] = ["it", "en"]) -> String {
        for lang in languages {
            if let v = values[lang], !v.isEmpty { return v }
        }
        return values.values.first ?? "—"
    }
}

struct TagEntity: Decodable {
    let id: String
    let attributes: TagAttributes
}

struct TagAttributes: Decodable {
    let name: LocalizedString
    let group: String
}

// MARK: - Chapter

typealias ChapterEntity = MangaDexEntity<ChapterAttributes>

struct ChapterAttributes: Decodable {
    let title: String?
    let volume: String?
    let chapter: String?
    let translatedLanguage: String?
    let pages: Int?
    let publishAt: String?
    let readableAt: String?
    let externalUrl: String?
}

// MARK: - At-Home (page URLs)

struct AtHomeResponse: Decodable {
    let baseUrl: String
    let chapter: AtHomeChapter
}

struct AtHomeChapter: Decodable {
    let hash: String
    let data: [String]
    let dataSaver: [String]
}

// MARK: - Convenience view models

struct MangaSummary: Identifiable, Hashable {
    let id: String
    let title: String
    let description: String
    let coverFileName: String?
    let scanlationGroupId: String?
    let status: String?
    let year: Int?
    let tags: [String]
    let availableLanguages: [String]

    var coverURL: URL? {
        guard let fn = coverFileName else { return nil }
        return URL(string: "https://uploads.mangadex.org/covers/\(id)/\(fn).256.jpg")
    }

    var coverURLLarge: URL? {
        guard let fn = coverFileName else { return nil }
        return URL(string: "https://uploads.mangadex.org/covers/\(id)/\(fn).512.jpg")
    }

    init(entity: MangaEntity) {
        id = entity.id
        title = entity.attributes.title.preferred()
        description = entity.attributes.description?.preferred() ?? ""
        status = entity.attributes.status
        year = entity.attributes.year
        tags = entity.attributes.tags?
            .filter { $0.attributes.group == "genre" }
            .map { $0.attributes.name.preferred() } ?? []
        availableLanguages = entity.attributes.availableTranslatedLanguages ?? []

        let coverRel = entity.relationships?.first { $0.type == "cover_art" }
        coverFileName = coverRel?.attributes?.fileName
        scanlationGroupId = entity.relationships?.first { $0.type == "scanlation_group" }?.id
    }
}

struct ChapterSummary: Identifiable, Hashable {
    let id: String
    let title: String
    let volume: String?
    let chapter: String?
    let language: String
    let pages: Int
    let publishAt: Date?
    let scanlationGroup: String?
    let isExternal: Bool

    var displayTitle: String {
        var parts: [String] = []
        if let vol = volume { parts.append("Vol.\(vol)") }
        if let ch = chapter { parts.append("Cap.\(ch)") }
        if let t = title.isEmpty ? nil : Optional(title) { parts.append(t) }
        return parts.isEmpty ? "Capitolo" : parts.joined(separator: " ")
    }

    init(entity: ChapterEntity) {
        id = entity.id
        title = entity.attributes.title ?? ""
        volume = entity.attributes.volume
        chapter = entity.attributes.chapter
        language = entity.attributes.translatedLanguage ?? "?"
        pages = entity.attributes.pages ?? 0
        isExternal = entity.attributes.externalUrl != nil

        scanlationGroup = entity.relationships?
            .first { $0.type == "scanlation_group" }?.attributes?.name

        if let raw = entity.attributes.publishAt {
            let fmt = ISO8601DateFormatter()
            fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            publishAt = fmt.date(from: raw)
        } else {
            publishAt = nil
        }
    }
}
