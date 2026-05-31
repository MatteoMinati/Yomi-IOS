import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            Tab("Home", systemImage: "house") {
                HomeView()
            }
            Tab("Cerca", systemImage: "magnifyingglass") {
                SearchView()
            }
            Tab("Libreria", systemImage: "books.vertical") {
                LibraryView()
            }
        }
    }
}
