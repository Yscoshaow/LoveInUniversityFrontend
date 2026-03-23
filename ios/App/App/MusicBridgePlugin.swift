import Capacitor
import WidgetKit
import ActivityKit
import UIKit

@objc(MusicBridgePlugin)
public class MusicBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MusicBridgePlugin"
    public let jsName = "MusicBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "updateState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearState", returnType: CAPPluginReturnPromise),
    ]

    private var darwinObserver: UnsafeMutableRawPointer?
    private var currentActivity: Activity<MusicActivityAttributes>?
    private var cachedArtworkUrl: String?

    override public func load() {
        // Listen for commands from widget App Intents via Darwin notification
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()

        CFNotificationCenterAddObserver(
            center,
            observer,
            { (_, observer, _, _, _) in
                guard let observer = observer else { return }
                let plugin = Unmanaged<MusicBridgePlugin>.fromOpaque(observer).takeUnretainedValue()
                plugin.handleMusicCommand()
            },
            SharedDataManager.musicCommandNotification,
            nil,
            .deliverImmediately
        )
        darwinObserver = observer

        // Check for pending command (app was dead when widget sent command)
        if let pending = SharedDataManager.consumePendingCommand() {
            notifyListeners("musicCommand", data: ["command": pending])
        }

        // Clean up stale Live Activities from previous sessions
        cleanupStaleActivities()
    }

    deinit {
        if let observer = darwinObserver {
            CFNotificationCenterRemoveObserver(
                CFNotificationCenterGetDarwinNotifyCenter(),
                observer,
                CFNotificationName(SharedDataManager.musicCommandNotification),
                nil
            )
        }
    }

    private func handleMusicCommand() {
        if let command = SharedDataManager.consumePendingCommand() {
            notifyListeners("musicCommand", data: ["command": command])
        }
    }

    // MARK: - Plugin Methods

    @objc func updateState(_ call: CAPPluginCall) {
        let data = MusicWidgetData(
            trackHash: call.getString("trackHash") ?? "",
            trackTitle: call.getString("trackTitle") ?? "",
            workTitle: call.getString("workTitle") ?? "",
            coverUrl: call.getString("coverUrl") ?? "",
            playing: call.getBool("playing") ?? false,
            currentTime: call.getDouble("currentTime") ?? 0,
            duration: call.getDouble("duration") ?? 0,
            currentIndex: call.getInt("currentIndex") ?? 0,
            playlistSize: call.getInt("playlistSize") ?? 0,
            lastUpdated: Date().timeIntervalSince1970 * 1000,
            subtitleText: call.getString("subtitleText") ?? ""
        )

        // Existing: persist + widget + now playing
        SharedDataManager.setMusicData(data)
        WidgetCenter.shared.reloadTimelines(ofKind: "MusicWidget")
        NowPlayingService.shared.updateNowPlaying(data: data)

        // Live Activity: cache artwork then start/update
        cacheArtworkAndUpdateActivity(data: data)

        call.resolve()
    }

    @objc func clearState(_ call: CAPPluginCall) {
        SharedDataManager.clearMusicData()
        WidgetCenter.shared.reloadTimelines(ofKind: "MusicWidget")
        NowPlayingService.shared.clearNowPlaying()

        // End Live Activity
        endLiveActivity()
        SharedDataManager.clearLiveActivityArtwork()
        cachedArtworkUrl = nil

        call.resolve()
    }

    // MARK: - Live Activity Lifecycle

    private func cleanupStaleActivities() {
        for activity in Activity<MusicActivityAttributes>.activities {
            if SharedDataManager.getMusicData() != nil {
                // Music data exists — adopt this activity
                currentActivity = activity
            } else {
                // No music data — end stale activity
                Task {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
        }
    }

    private func cacheArtworkAndUpdateActivity(data: MusicWidgetData) {
        let coverUrl = data.coverUrl

        // If URL hasn't changed, skip re-download
        if coverUrl == cachedArtworkUrl {
            updateOrStartActivity(data: data, artworkFileName: cachedArtworkUrl != nil ? "live_activity_artwork.jpg" : nil)
            return
        }

        // No cover URL — clear and update without artwork
        guard !coverUrl.isEmpty, let url = URL(string: coverUrl) else {
            cachedArtworkUrl = nil
            SharedDataManager.clearLiveActivityArtwork()
            updateOrStartActivity(data: data, artworkFileName: nil)
            return
        }

        // Download artwork asynchronously
        Task {
            do {
                let (imageData, _) = try await URLSession.shared.data(from: url)
                var fileName: String? = nil
                if let image = UIImage(data: imageData) {
                    fileName = SharedDataManager.saveLiveActivityArtwork(image)
                }
                await MainActor.run {
                    self.cachedArtworkUrl = coverUrl
                    self.updateOrStartActivity(data: data, artworkFileName: fileName)
                }
            } catch {
                await MainActor.run {
                    self.updateOrStartActivity(data: data, artworkFileName: nil)
                }
            }
        }
    }

    private func updateOrStartActivity(data: MusicWidgetData, artworkFileName: String?) {
        let contentState = MusicActivityAttributes.ContentState(
            trackTitle: data.trackTitle,
            workTitle: data.workTitle,
            subtitleText: data.subtitleText,
            playing: data.playing,
            currentTime: data.currentTime,
            duration: data.duration,
            currentIndex: data.currentIndex,
            playlistSize: data.playlistSize,
            artworkFileName: artworkFileName
        )

        // If we have an active activity, check if it's still alive
        if let activity = currentActivity {
            if activity.activityState == .ended {
                // Activity expired (8h limit) — restart
                currentActivity = nil
                startActivity(state: contentState)
            } else {
                // Update existing activity
                Task {
                    await activity.update(ActivityContent(state: contentState, staleDate: nil))
                }
            }
        } else {
            startActivity(state: contentState)
        }
    }

    private func startActivity(state: MusicActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = MusicActivityAttributes()
        let content = ActivityContent(state: state, staleDate: nil)
        do {
            currentActivity = try Activity.request(
                attributes: attributes,
                content: content,
                pushType: nil
            )
        } catch {
            print("[MusicBridge] Failed to start Live Activity: \(error)")
        }
    }

    private func endLiveActivity() {
        guard let activity = currentActivity else { return }
        Task {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        currentActivity = nil
    }
}
