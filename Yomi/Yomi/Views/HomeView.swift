import SwiftUI

struct HomeView: View {

    @State private var vm = HomeViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoading && vm.popularManga.isEmpty {
                    ProgressView("Caricamento…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let err = vm.error {
                    ContentUnavailableView(err, systemImage: "wifi.exclamationmark")
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 28) {
                            // Popular section
                            SectionHeader(title: "Più seguiti") {}
                            ScrollView(.horizontal, showsIndicators: false) {
                                LazyHStack(spacing: 14) {
                                    ForEach(vm.popularManga) { manga in
                                        NavigationLink(value: manga) {
                                            MangaCardView(manga: manga)
                                        }
                                        .buttonStyle(.plain)
                                        .onAppear {
                                            if manga.id == vm.popularManga.last?.id {
                                                Task { await vm.loadMorePopular() }
                                            }
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }

                            // Recent section
                            SectionHeader(title: "Aggiornati di recente") {}
                            ScrollView(.horizontal, showsIndicators: false) {
                                LazyHStack(spacing: 14) {
                                    ForEach(vm.recentManga) { manga in
                                        NavigationLink(value: manga) {
                                            MangaCardView(manga: manga)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                        .padding(.vertical)
                    }
                    .refreshable { await vm.load() }
                }
            }
            .navigationTitle("Yomi")
            .navigationDestination(for: MangaSummary.self) { manga in
                MangaDetailView(manga: manga)
            }
        }
        .task { await vm.load() }
    }
}

struct SectionHeader: View {
    let title: String
    let action: () -> Void

    var body: some View {
        HStack {
            Text(title)
                .font(.title3)
                .fontWeight(.bold)
            Spacer()
        }
        .padding(.horizontal)
    }
}
