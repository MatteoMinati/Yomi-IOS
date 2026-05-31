import SwiftUI

struct ReaderView: View {

    @State private var vm: ReaderViewModel
    @Environment(\.dismiss) private var dismiss

    init(chapter: ChapterSummary, mangaId: String) {
        _vm = State(initialValue: ReaderViewModel(chapter: chapter, mangaId: mangaId))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if vm.isLoading {
                ProgressView()
                    .tint(.white)
            } else if let err = vm.error {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.largeTitle)
                        .foregroundStyle(.white)
                    Text(err)
                        .foregroundStyle(.white)
                    Button("Riprova") { Task { await vm.load() } }
                        .buttonStyle(.bordered)
                }
            } else if !vm.pages.isEmpty {
                Group {
                    if vm.readingMode == .horizontal {
                        HorizontalReader(vm: vm)
                    } else {
                        VerticalReader(vm: vm)
                    }
                }
                .onTapGesture { withAnimation(.easeInOut(duration: 0.2)) { vm.showUI.toggle() } }
            }

            // Overlay UI
            if vm.showUI {
                readerUI
            }
        }
        .navigationBarHidden(true)
        .statusBarHidden(!vm.showUI)
        .task { await vm.load() }
        .onDisappear { vm.markProgress() }
    }

    // MARK: - UI Overlay

    private var readerUI: some View {
        VStack {
            // Top bar
            HStack {
                Button {
                    vm.markProgress()
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.title3)
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                }

                Spacer()

                Text(vm.chapter.displayTitle)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Spacer()

                Menu {
                    Section("Modalità lettura") {
                        ForEach(ReadingMode.allCases, id: \.self) { mode in
                            Button {
                                vm.readingMode = mode
                            } label: {
                                Label(mode.rawValue, systemImage: mode.icon)
                            }
                        }
                    }
                    Section("Qualità immagini") {
                        Toggle("Risparmio dati", isOn: $vm.dataSaver)
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                        .foregroundStyle(.white)
                        .padding(10)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)

            Spacer()

            // Page counter
            if !vm.pages.isEmpty {
                Text("\(vm.currentPage + 1) / \(vm.pages.count)")
                    .font(.caption)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(.ultraThinMaterial)
                    .clipShape(Capsule())
                    .padding(.bottom, 20)
            }
        }
        .transition(.opacity)
    }
}

// MARK: - Horizontal (pagina per pagina)

struct HorizontalReader: View {
    @Bindable var vm: ReaderViewModel

    var body: some View {
        TabView(selection: $vm.currentPage) {
            ForEach(Array(vm.pages.enumerated()), id: \.offset) { idx, url in
                PageImageView(url: url)
                    .tag(idx)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
    }
}

// MARK: - Vertical (scroll continuo)

struct VerticalReader: View {
    @Bindable var vm: ReaderViewModel

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 2) {
                    ForEach(Array(vm.pages.enumerated()), id: \.offset) { idx, url in
                        PageImageView(url: url)
                            .id(idx)
                            .onAppear { vm.currentPage = idx }
                    }
                }
            }
        }
    }
}

// MARK: - Single page image

struct PageImageView: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity)
            case .failure:
                ZStack {
                    Color(.systemGray6)
                    Image(systemName: "photo.badge.exclamationmark")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                }
                .frame(height: 300)
            case .empty:
                ZStack {
                    Color.black
                    ProgressView().tint(.white)
                }
                .frame(height: UIScreen.main.bounds.height * 0.7)
            @unknown default:
                EmptyView()
            }
        }
    }
}
