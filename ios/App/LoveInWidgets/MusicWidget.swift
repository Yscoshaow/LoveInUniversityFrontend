import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct MusicEntry: TimelineEntry {
    let date: Date
    let data: MusicWidgetData?
    let coverImage: UIImage?
    let computedCurrentTime: Double
}

// MARK: - Timeline Provider

struct MusicTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> MusicEntry {
        MusicEntry(date: .now, data: nil, coverImage: nil, computedCurrentTime: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (MusicEntry) -> Void) {
        let data = SharedDataManager.getMusicData()
        let entry = MusicEntry(date: .now, data: data, coverImage: nil, computedCurrentTime: data?.currentTime ?? 0)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MusicEntry>) -> Void) {
        let data = SharedDataManager.getMusicData()

        guard let data = data, !data.trackHash.isEmpty else {
            let entry = MusicEntry(date: .now, data: nil, coverImage: nil, computedCurrentTime: 0)
            completion(Timeline(entries: [entry], policy: .never))
            return
        }

        // Download cover image synchronously (widget extension allows this)
        let coverImage = data.coverUrl.isEmpty ? nil : WidgetNetworkManager.downloadImage(url: data.coverUrl)

        if data.playing {
            // Pre-compute timeline entries for progress animation
            var entries: [MusicEntry] = []
            let now = Date()
            let elapsedSinceUpdate = now.timeIntervalSince1970 - (data.lastUpdated / 1000)
            let currentTime = data.currentTime + max(elapsedSinceUpdate, 0)
            let remaining = max(data.duration - currentTime, 0)

            let interval: TimeInterval = 10
            let count = min(Int(remaining / interval) + 1, 30) // max 30 entries (~5 min)

            for i in 0..<max(count, 1) {
                let offset = Double(i) * interval
                let entryDate = now.addingTimeInterval(offset)
                let computed = min(currentTime + offset, data.duration)
                entries.append(MusicEntry(
                    date: entryDate, data: data,
                    coverImage: coverImage, computedCurrentTime: computed
                ))
            }

            let refreshDate = now.addingTimeInterval(min(remaining, 300))
            completion(Timeline(entries: entries, policy: .after(refreshDate)))
        } else {
            // Paused: single entry
            let entry = MusicEntry(date: .now, data: data, coverImage: coverImage,
                                   computedCurrentTime: data.currentTime)
            completion(Timeline(entries: [entry], policy: .never))
        }
    }
}

// MARK: - Widget View

struct MusicWidgetView: View {
    let entry: MusicEntry

    var body: some View {
        if let data = entry.data, !data.trackHash.isEmpty {
            musicContent(data: data)
        } else {
            emptyState
        }
    }

    private func musicContent(data: MusicWidgetData) -> some View {
        HStack(spacing: 10) {
            // Cover art
            if let image = entry.coverImage {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 75, height: 75)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.purple.opacity(0.3))
                    .frame(width: 75, height: 75)
                    .overlay(
                        Image(systemName: "music.note")
                            .font(.title2)
                            .foregroundStyle(.white.opacity(0.6))
                    )
            }

            // Track info + progress
            VStack(alignment: .leading, spacing: 3) {
                Text(data.trackTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Text(data.workTitle)
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)

                if !data.subtitleText.isEmpty {
                    Text(data.subtitleText)
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.5))
                        .lineLimit(1)
                }

                Spacer(minLength: 2)

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.2))
                            .frame(height: 3)
                        Capsule()
                            .fill(Color.white.opacity(0.8))
                            .frame(width: progressWidth(total: geo.size.width, data: data), height: 3)
                    }
                }
                .frame(height: 3)

                // Time labels
                HStack {
                    Text(formatTime(entry.computedCurrentTime))
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5))
                    Spacer()
                    Text(formatTime(data.duration))
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.5))
                }
            }

            // Control buttons
            VStack(spacing: 6) {
                Button(intent: MusicPrevIntent()) {
                    Image(systemName: "backward.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.8))
                }
                .buttonStyle(.plain)

                Button(intent: MusicToggleIntent()) {
                    Image(systemName: data.playing ? "pause.fill" : "play.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)

                Button(intent: MusicNextIntent()) {
                    Image(systemName: "forward.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(.white.opacity(0.8))
                }
                .buttonStyle(.plain)
            }
            .frame(width: 36)
        }
        .padding(12)
        .containerBackground(for: .widget) {
            LinearGradient(
                colors: [Color(red: 0.15, green: 0.1, blue: 0.25), Color(red: 0.1, green: 0.05, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var emptyState: some View {
        VStack(spacing: 6) {
            Image(systemName: "music.note")
                .font(.system(size: 28))
                .foregroundStyle(.white.opacity(0.4))
            Text("暂无播放")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            Color(red: 0.1, green: 0.08, blue: 0.15)
        }
    }

    private func progressWidth(total: CGFloat, data: MusicWidgetData) -> CGFloat {
        guard data.duration > 0 else { return 0 }
        let progress = min(entry.computedCurrentTime / data.duration, 1.0)
        return total * CGFloat(progress)
    }

    private func formatTime(_ seconds: Double) -> String {
        let total = max(Int(seconds), 0)
        let m = total / 60
        let s = total % 60
        return "\(m):\(String(format: "%02d", s))"
    }
}

// MARK: - Widget Definition

struct MusicWidget: Widget {
    let kind = "MusicWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MusicTimelineProvider()) { entry in
            MusicWidgetView(entry: entry)
        }
        .configurationDisplayName("音乐播放器")
        .description("控制音乐播放")
        .supportedFamilies([.systemMedium])
    }
}
