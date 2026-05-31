import SwiftUI

struct LibraryView: View {

    @State private var library = LibraryStore.shared

    let columns = [GridItem(.adaptive(minimum: 110), spacing: 14)]

    var body: some View {
        NavigationStack {
            Group {
                if library.savedManga.isEmpty {
                    ContentUnavailableView(
                        "Libreria vuota",
                        systemImage: "books.vertical",
                        description: Text("Salva i manga toccando il segnalibro nella pagina di dettaglio.")
                    )
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 18) {
                            ForEach(library.savedManga) { saved in
                                NavigationLink(value: saved) {
                                    VStack(alignment: .leading, spacing: 6) {
                                        CoverImageView(url: saved.coverURL)
                                            .frame(width: 110, height: 155)
                                        Text(saved.title)
                                            .font(.caption)
                                            .fontWeight(.medium)
                                            .lineLimit(2)
                                            .frame(width: 110, alignment: .leading)
                                    }
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        // find matching MangaSummary to toggle
                                        // use a stub since we only need id/title/coverFileName
                                        let stub = MangaSummary.stub(from: saved)
                                        library.toggle(stub)
                                    } label: {
                                        Label("Rimuovi dalla libreria", systemImage: "bookmark.slash")
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Libreria")
            .navigationDestination(for: SavedManga.self) { saved in
                // We need a full MangaSummary to navigate — build a lightweight one
                MangaDetailView(manga: MangaSummary.stub(from: saved))
            }
        }
    }
}

extension MangaSummary {
    static func stub(from saved: SavedManga) -> MangaSummary {
        // Minimal stub for navigation from library; detail view will reload
        MangaSummary(id: saved.id, title: saved.title, coverFileName: saved.coverFileName)
    }

    init(id: String, title: String, coverFileName: String?) {
        self.id = id
        self.title = title
        self.description = ""
        self.coverFileName = coverFileName
        self.scanlationGroupId = nil
        self.status = nil
        self.year = nil
        self.tags = []
        self.availableLanguages = []
    }
}
