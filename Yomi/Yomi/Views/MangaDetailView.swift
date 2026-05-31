import SwiftUI

struct MangaDetailView: View {

    let manga: MangaSummary
    @State private var vm: MangaDetailViewModel
    @State private var library = LibraryStore.shared
    @State private var descriptionExpanded = false

    init(manga: MangaSummary) {
        self.manga = manga
        _vm = State(initialValue: MangaDetailViewModel(manga: manga))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                header

                // Descrizione
                if !manga.description.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(manga.description)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(descriptionExpanded ? nil : 4)
                        Button(descriptionExpanded ? "Meno" : "Di più") {
                            withAnimation { descriptionExpanded.toggle() }
                        }
                        .font(.subheadline)
                    }
                    .padding()
                }

                // Tags
                if !manga.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(manga.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Color(.systemGray5))
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal)
                    }
                    .padding(.bottom, 8)
                }

                Divider()

                // Language picker
                if vm.availableLanguages.count > 1 {
                    Picker("Lingua", selection: $vm.selectedLanguage) {
                        ForEach(vm.availableLanguages, id: \.code) { lang in
                            Text(lang.label).tag(lang.code)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding()
                    .onChange(of: vm.selectedLanguage) {
                        Task { await vm.loadChapters() }
                    }
                }

                // Chapters
                chapterList
            }
        }
        .navigationTitle(manga.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    library.toggle(manga)
                } label: {
                    Image(systemName: library.isSaved(manga.id) ? "bookmark.fill" : "bookmark")
                }
            }
        }
        .task { await vm.loadChapters() }
    }

    // MARK: - Subviews

    private var header: some View {
        HStack(alignment: .top, spacing: 16) {
            CoverImageView(url: manga.coverURLLarge, cornerRadius: 12)
                .frame(width: 120, height: 170)

            VStack(alignment: .leading, spacing: 8) {
                Text(manga.title)
                    .font(.title3)
                    .fontWeight(.bold)

                if let year = manga.year {
                    Label("\(year)", systemImage: "calendar")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let status = manga.status {
                    StatusBadge(status: status)
                }
                if !manga.availableLanguages.isEmpty {
                    Text(manga.availableLanguages.joined(separator: " · ").uppercased())
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Spacer()
        }
        .padding()
    }

    @ViewBuilder
    private var chapterList: some View {
        if vm.isLoading {
            ProgressView("Caricamento capitoli…")
                .frame(maxWidth: .infinity)
                .padding()
        } else if let err = vm.error {
            ContentUnavailableView(err, systemImage: "wifi.exclamationmark")
                .padding()
        } else if vm.chapters.isEmpty {
            ContentUnavailableView("Nessun capitolo disponibile", systemImage: "book.closed")
                .padding()
        } else {
            LazyVStack(spacing: 0) {
                ForEach(vm.chapters) { chapter in
                    NavigationLink {
                        ReaderView(chapter: chapter, mangaId: manga.id)
                    } label: {
                        ChapterRow(chapter: chapter,
                                   isRead: LibraryStore.shared.lastReadChapter(mangaId: manga.id) == chapter.id)
                    }
                    .buttonStyle(.plain)
                    Divider().padding(.leading)
                }
            }
        }
    }
}

struct ChapterRow: View {
    let chapter: ChapterSummary
    let isRead: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(chapter.displayTitle)
                    .font(.subheadline)
                    .fontWeight(isRead ? .regular : .medium)
                    .foregroundStyle(isRead ? .secondary : .primary)

                HStack(spacing: 8) {
                    if let group = chapter.scanlationGroup {
                        Text(group)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let date = chapter.publishAt {
                        Text(date.formatted(.relative(presentation: .named)))
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            Spacer()
            HStack(spacing: 4) {
                Image(systemName: "doc.text")
                    .font(.caption2)
                Text("\(chapter.pages)")
                    .font(.caption)
            }
            .foregroundStyle(.tertiary)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal)
        .padding(.vertical, 12)
    }
}
