# Yomi 読み

Manga reader powered by the MangaDex API. No ads, no tracking.

## Features

- Browse popular and recently updated manga
- Search by title with Italian / English language filter
- Chapter list with language picker per manga
- Reader with horizontal (page-by-page) and vertical (continuous scroll) modes
- Data saver mode for slower connections
- Library to bookmark manga and track reading progress

## Requirements

- Xcode 16+
- iOS 26+

## Getting Started

1. Open `Yomi/Yomi.xcodeproj` in Xcode
2. Select your device or simulator (iOS 26)
3. Set your Team in Signing & Capabilities
4. Build & Run (`⌘R`)

No API key or account needed — MangaDex API is public.

## Architecture

```
Yomi/
├── YomiApp.swift
├── Models/MangaDexModels.swift        Codable API models
├── Services/MangaDexService.swift     Actor-based API layer + URLSession cache
├── Persistence/LibraryStore.swift     @Observable store, UserDefaults
├── ViewModels/                        One per screen
└── Views/                             SwiftUI views + Components
```
