import SwiftUI

struct MangaCardView: View {
    let manga: MangaSummary
    var width: CGFloat = 120
    var height: CGFloat = 170

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            CoverImageView(url: manga.coverURL)
                .frame(width: width, height: height)
                .overlay(alignment: .topTrailing) {
                    if let status = manga.status {
                        StatusBadge(status: status)
                            .padding(4)
                    }
                }

            Text(manga.title)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(2)
                .frame(width: width, alignment: .leading)
        }
    }
}

struct StatusBadge: View {
    let status: String

    var color: Color {
        switch status {
        case "ongoing":   .green
        case "completed": .blue
        case "hiatus":    .orange
        case "cancelled": .red
        default:          .gray
        }
    }

    var label: String {
        switch status {
        case "ongoing":   "In corso"
        case "completed": "Completo"
        case "hiatus":    "In pausa"
        case "cancelled": "Cancellato"
        default: status
        }
    }

    var body: some View {
        Text(label)
            .font(.system(size: 9, weight: .semibold))
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(color.opacity(0.85))
            .foregroundStyle(.white)
            .clipShape(Capsule())
    }
}
