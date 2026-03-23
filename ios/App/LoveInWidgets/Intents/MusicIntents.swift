import AppIntents
import WidgetKit

struct MusicToggleIntent: AppIntent {
    static var title: LocalizedStringResource = "切换播放/暂停"

    func perform() async throws -> some IntentResult {
        // Optimistic UI update: toggle playing state
        if var data = SharedDataManager.getMusicData() {
            let toggled = MusicWidgetData(
                trackHash: data.trackHash,
                trackTitle: data.trackTitle,
                workTitle: data.workTitle,
                coverUrl: data.coverUrl,
                playing: !data.playing,
                currentTime: data.currentTime,
                duration: data.duration,
                currentIndex: data.currentIndex,
                playlistSize: data.playlistSize,
                lastUpdated: data.lastUpdated,
                subtitleText: data.subtitleText
            )
            SharedDataManager.setMusicData(toggled)
        }

        // Send command to main app
        SharedDataManager.setPendingCommand("toggle")
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(SharedDataManager.musicCommandNotification),
            nil, nil, true
        )

        WidgetCenter.shared.reloadTimelines(ofKind: "MusicWidget")
        return .result()
    }
}

struct MusicNextIntent: AppIntent {
    static var title: LocalizedStringResource = "下一首"

    func perform() async throws -> some IntentResult {
        SharedDataManager.setPendingCommand("next")
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(SharedDataManager.musicCommandNotification),
            nil, nil, true
        )
        return .result()
    }
}

struct MusicPrevIntent: AppIntent {
    static var title: LocalizedStringResource = "上一首"

    func perform() async throws -> some IntentResult {
        SharedDataManager.setPendingCommand("prev")
        CFNotificationCenterPostNotification(
            CFNotificationCenterGetDarwinNotifyCenter(),
            CFNotificationName(SharedDataManager.musicCommandNotification),
            nil, nil, true
        )
        return .result()
    }
}
