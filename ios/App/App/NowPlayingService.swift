import MediaPlayer
import UIKit

class NowPlayingService {
    static let shared = NowPlayingService()

    private var cachedCoverUrl: String?
    private var cachedArtwork: MPMediaItemArtwork?
    private var isSetup = false

    func setup() {
        guard !isSetup else { return }
        isSetup = true

        let commandCenter = MPRemoteCommandCenter.shared()

        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.sendCommand("toggle")
            return .success
        }
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.sendCommand("toggle")
            return .success
        }
        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            self?.sendCommand("toggle")
            return .success
        }
        commandCenter.nextTrackCommand.addTarget { [weak self] _ in
            self?.sendCommand("next")
            return .success
        }
        commandCenter.previousTrackCommand.addTarget { [weak self] _ in
            self?.sendCommand("prev")
            return .success
        }
    }

    func updateNowPlaying(data: MusicWidgetData) {
        var info: [String: Any] = [
            MPMediaItemPropertyTitle: data.trackTitle,
            MPMediaItemPropertyArtist: data.workTitle,
            MPMediaItemPropertyPlaybackDuration: data.duration,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: data.currentTime,
            MPNowPlayingInfoPropertyPlaybackRate: data.playing ? 1.0 : 0.0,
        ]

        // Use cached artwork if URL matches
        if let artwork = cachedArtwork, cachedCoverUrl == data.coverUrl {
            info[MPMediaItemPropertyArtwork] = artwork
        } else if !data.coverUrl.isEmpty {
            // Async download new artwork
            let coverUrl = data.coverUrl
            downloadArtwork(url: coverUrl) { [weak self] artwork in
                guard let self = self, let artwork = artwork else { return }
                self.cachedCoverUrl = coverUrl
                self.cachedArtwork = artwork
                // Update now playing info with new artwork
                if var current = MPNowPlayingInfoCenter.default().nowPlayingInfo {
                    current[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = current
                }
            }
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
    }

    func clearNowPlaying() {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        cachedCoverUrl = nil
        cachedArtwork = nil
    }

    private func sendCommand(_ command: String) {
        SharedDataManager.setPendingCommand(command)
        // Post Darwin notification for MusicBridgePlugin to pick up
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(SharedDataManager.musicCommandNotification),
            nil, nil, true
        )
    }

    private func downloadArtwork(url: String, completion: @escaping (MPMediaItemArtwork?) -> Void) {
        guard let imageUrl = URL(string: url) else {
            completion(nil)
            return
        }
        URLSession.shared.dataTask(with: imageUrl) { data, _, _ in
            guard let data = data, let image = UIImage(data: data) else {
                DispatchQueue.main.async { completion(nil) }
                return
            }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            DispatchQueue.main.async { completion(artwork) }
        }.resume()
    }
}
