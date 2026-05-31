import SwiftUI

struct SearchView: View {

    @State private var vm = SearchViewModel()

    let columns = [GridItem(.adaptive(minimum: 110), spacing: 14)]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Language filter
                HStack {
                    ForEach(["it", "en"], id: \.self) { lang in
                        let selected = vm.selectedLanguages.contains(lang)
                        Button {
                            if selected {
                                if vm.selectedLanguages.count > 1 {
                                    vm.selectedLanguages.remove(lang)
                                }
                            } else {
                                vm.selectedLanguages.insert(lang)
                            }
                            Task { await vm.performSearch(reset: true) }
                        } label: {
                            Text(lang == "it" ? "🇮🇹 Italiano" : "🇬🇧 English")
                                .font(.subheadline)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(selected ? Color.accentColor : Color(.systemGray5))
                                .foregroundStyle(selected ? .white : .primary)
                                .clipShape(Capsule())
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)

                Divider()

                Group {
                    if vm.query.isEmpty {
                        ContentUnavailableView("Cerca un manga", systemImage: "magnifyingglass")
                    } else if vm.isLoading && vm.results.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if vm.results.isEmpty && !vm.isLoading {
                        ContentUnavailableView.search(text: vm.query)
                    } else {
                        ScrollView {
                            LazyVGrid(columns: columns, spacing: 18) {
                                ForEach(vm.results) { manga in
                                    NavigationLink(value: manga) {
                                        MangaCardView(manga: manga, width: 110, height: 155)
                                    }
                                    .buttonStyle(.plain)
                                    .onAppear {
                                        if manga.id == vm.results.last?.id {
                                            Task { await vm.loadMore() }
                                        }
                                    }
                                }
                            }
                            .padding()

                            if vm.isLoading {
                                ProgressView().padding()
                            }
                        }
                    }
                }
            }
            .navigationTitle("Cerca")
            .searchable(text: $vm.query, prompt: "Titolo manga…")
            .onChange(of: vm.query) { vm.onQueryChange() }
            .navigationDestination(for: MangaSummary.self) { manga in
                MangaDetailView(manga: manga)
            }
        }
    }
}
