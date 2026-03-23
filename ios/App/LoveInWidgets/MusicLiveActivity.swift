import ActivityKit
import SwiftUI
import WidgetKit

struct MusicLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: MusicActivityAttributes.self) { context in
            // Lock Screen banner
            LockScreenView(state: context.state)
                .activityBackgroundTint(.black.opacity(0.8))
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    ArtworkView(fileName: context.state.artworkFileName, size: 52)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    PlaybackControls(playing: context.state.playing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.state.trackTitle)
                            .font(.system(size: 14, weight: .semibold))
                            .lineLimit(1)
                            .foregroundColor(.white)
                        Text(context.state.workTitle)
                            .font(.system(size: 11))
                            .lineLimit(1)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ProgressBar(
                        currentTime: context.state.currentTime,
                        duration: context.state.duration
                    )
                    .padding(.horizontal, 8)
                    .padding(.bottom, 4)
                }
            } compactLeading: {
                ArtworkView(fileName: context.state.artworkFileName, size: 24)
                    .padding(.leading, 2)
            } compactTrailing: {
                Image(systemName: context.state.playing ? "pause.fill" : "play.fill")
                    .font(.system(size: 13))
                    .foregroundColor(.white)
                    .padding(.trailing, 2)
            } minimal: {
                Image(systemName: "music.note")
                    .font(.system(size: 13))
                    .foregroundColor(.cyan)
            }
        }
    }
}

// MARK: - Lock Screen View

private struct LockScreenView: View {
    let state: MusicActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            ArtworkView(fileName: state.artworkFileName, size: 56)

            VStack(alignment: .leading, spacing: 4) {
                Text(state.trackTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                    .foregroundColor(.white)
                Text(state.subtitleText.isEmpty ? state.workTitle : state.subtitleText)
                    .font(.system(size: 12))
                    .lineLimit(1)
                    .foregroundColor(.white.opacity(0.7))

                ProgressBar(currentTime: state.currentTime, duration: state.duration)
            }

            PlaybackControls(playing: state.playing)
        }
        .padding(12)
    }
}

// MARK: - Artwork View

private struct ArtworkView: View {
    let fileName: String?
    let size: CGFloat

    var body: some View {
        Group {
            if let image = loadImage() {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                Image(systemName: "music.note")
                    .font(.system(size: size * 0.4))
                    .foregroundColor(.cyan)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.white.opacity(0.1))
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size > 40 ? 8 : 6))
    }

    private func loadImage() -> UIImage? {
        guard fileName != nil else { return nil }
        return SharedDataManager.loadLiveActivityArtwork()
    }
}

// MARK: - Playback Controls

private struct PlaybackControls: View {
    let playing: Bool

    var body: some View {
        HStack(spacing: 16) {
            Button(intent: MusicPrevIntent()) {
                Image(systemName: "backward.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.white)
            }
            .buttonStyle(.plain)

            Button(intent: MusicToggleIntent()) {
                Image(systemName: playing ? "pause.fill" : "play.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
            }
            .buttonStyle(.plain)

            Button(intent: MusicNextIntent()) {
                Image(systemName: "forward.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.white)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Progress Bar

private struct ProgressBar: View {
    let currentTime: Double
    let duration: Double

    private var progress: Double {
        guard duration > 0 else { return 0 }
        return min(currentTime / duration, 1.0)
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.white.opacity(0.2))
                    .frame(height: 3)
                Capsule()
                    .fill(Color.cyan)
                    .frame(width: geo.size.width * progress, height: 3)
            }
        }
        .frame(height: 3)
    }
}
