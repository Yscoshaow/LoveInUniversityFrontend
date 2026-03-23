import Foundation
import ActivityKit

// MARK: - Music Widget Data (mirrors Android MusicWidgetData.kt)

struct MusicWidgetData: Codable {
    let trackHash: String
    let trackTitle: String
    let workTitle: String
    let coverUrl: String
    let playing: Bool
    var currentTime: Double
    let duration: Double
    let currentIndex: Int
    let playlistSize: Int
    let lastUpdated: Double // epoch millis
    let subtitleText: String

    init(
        trackHash: String = "",
        trackTitle: String = "",
        workTitle: String = "",
        coverUrl: String = "",
        playing: Bool = false,
        currentTime: Double = 0,
        duration: Double = 0,
        currentIndex: Int = 0,
        playlistSize: Int = 0,
        lastUpdated: Double = 0,
        subtitleText: String = ""
    ) {
        self.trackHash = trackHash
        self.trackTitle = trackTitle
        self.workTitle = workTitle
        self.coverUrl = coverUrl
        self.playing = playing
        self.currentTime = currentTime
        self.duration = duration
        self.currentIndex = currentIndex
        self.playlistSize = playlistSize
        self.lastUpdated = lastUpdated
        self.subtitleText = subtitleText
    }
}

// MARK: - Lock Widget Data (mirrors Android LockWidgetData.kt)

struct LockWidgetData: Codable {
    let id: Int64
    let userId: Int64
    let status: String            // ACTIVE, UNLOCKING, UNLOCKED, EXPIRED, CANCELLED
    let lockType: String          // SELF, SHARED, PRIVATE
    var remainingSeconds: Int64?
    let remainingMinutes: Int64?
    let hideRemainingTime: Bool
    let isFrozen: Bool
    let isHygieneOpening: Bool
    let primaryKeyholderId: Int64?
    let likesReceived: Int
    let lockBoxType: String
    let lockBoxUnlocked: Bool
}

// MARK: - Managed Lock Summary (mirrors Android ManagedLockWidgetData.kt)

struct ManagedLockSummary: Codable {
    let lockId: Int64
    let wearerId: Int64
    let wearerName: String?
    let wearerAvatar: String?
    let wearerTelegramId: Int64?
    let wearerUsername: String?
    let lockType: String          // SELF, SHARED, PRIVATE
    let status: String            // ACTIVE, UNLOCKING, UNLOCKED, EXPIRED, CANCELLED
    let remainingSeconds: Int64?
    let isFrozen: Bool
    let isHygieneOpening: Bool
    let permission: String        // READ_ONLY, BASIC_CONTROL, FULL_CONTROL
    let createdAt: String
}

// MARK: - Schedule Data (mirrors Android ScheduleWidgetData.kt)

struct DailyTaskOverview: Codable {
    let date: String
    let totalTasks: Int
    let completedTasks: Int
    let inProgressTasks: Int
    let pendingTasks: Int
    let failedTasks: Int
    let tasks: [UserTaskDetail]
}

struct UserTaskDetail: Codable {
    let id: Int64
    let courseName: String
    let courseIconUrl: String?
    let taskName: String
    let taskDescription: String?
    let taskType: String          // DURATION, COUNT, MANUAL, LOCK
    let targetValue: Double
    let targetUnit: String        // KILOMETERS, METERS, MINUTES, HOURS, TIMES, NONE
    let actualValue: Double
    let status: String            // PENDING, IN_PROGRESS, COMPLETED, FAILED, EXPIRED
    let scheduledDate: String
    let dueAt: String?
    let startedAt: String?
    let completedAt: String?
    let isExamAttempt: Bool
    let pointsEarned: Int
    let remainingSeconds: Int64?
    let progressPercent: Double
}

struct DailyScheduleOverview: Codable {
    let date: String
    let totalSchedules: Int
    let upcomingCount: Int
    let completedCount: Int
    let schedules: [ScheduleSummary]
}

struct ScheduleSummary: Codable {
    let id: Int64
    let title: String
    let date: String
    let startTime: String
    let endTime: String?
    let location: String?
    let type: String              // MEETING, REMINDER, DEADLINE, EVENT, OTHER
    let status: String            // UPCOMING, COMPLETED, CANCELLED
}

// MARK: - Unified Widget Item (mirrors Android ScheduleWidgetItem)

struct ScheduleWidgetItem: Codable {
    let itemType: String          // "TASK" or "SCHEDULE"
    let id: Int64
    // Task fields
    let taskName: String?
    let courseName: String?
    let taskType: String?
    let status: String?
    let targetValue: Double?
    var actualValue: Double?
    let targetUnit: String?
    let progressPercent: Double?
    let remainingSeconds: Int64?
    let startedAt: String?
    let isExamAttempt: Bool?
    let pointsEarned: Int?
    // Schedule fields
    let title: String?
    let startTime: String?
    let endTime: String?
    let location: String?
    let scheduleType: String?
    let scheduleStatus: String?
    // Sorting
    let sortTime: String

    static func fromTask(_ task: UserTaskDetail) -> ScheduleWidgetItem {
        let sortTime: String
        if let dueAt = task.dueAt, dueAt.contains("T") {
            sortTime = String(dueAt.split(separator: "T").last?.prefix(8) ?? "23:59:59")
        } else {
            sortTime = "23:59:59"
        }

        return ScheduleWidgetItem(
            itemType: "TASK",
            id: task.id,
            taskName: task.taskName,
            courseName: task.courseName,
            taskType: task.taskType,
            status: task.status,
            targetValue: task.targetValue,
            actualValue: task.actualValue,
            targetUnit: task.targetUnit,
            progressPercent: task.progressPercent,
            remainingSeconds: task.remainingSeconds,
            startedAt: task.startedAt,
            isExamAttempt: task.isExamAttempt,
            pointsEarned: task.pointsEarned,
            title: nil,
            startTime: nil,
            endTime: nil,
            location: nil,
            scheduleType: nil,
            scheduleStatus: nil,
            sortTime: sortTime
        )
    }

    static func fromSchedule(_ schedule: ScheduleSummary) -> ScheduleWidgetItem {
        return ScheduleWidgetItem(
            itemType: "SCHEDULE",
            id: schedule.id,
            taskName: nil,
            courseName: nil,
            taskType: nil,
            status: nil,
            targetValue: nil,
            actualValue: nil,
            targetUnit: nil,
            progressPercent: nil,
            remainingSeconds: nil,
            startedAt: nil,
            isExamAttempt: nil,
            pointsEarned: nil,
            title: schedule.title,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            location: schedule.location,
            scheduleType: schedule.type,
            scheduleStatus: schedule.status,
            sortTime: String(schedule.startTime.prefix(8))
        )
    }
}

struct ScheduleStats: Codable {
    let completedTasks: Int
    let totalTasks: Int
}

// MARK: - Music Live Activity (Dynamic Island + Lock Screen)

struct MusicActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        let trackTitle: String
        let workTitle: String
        let subtitleText: String
        let playing: Bool
        let currentTime: Double
        let duration: Double
        let currentIndex: Int
        let playlistSize: Int
        let artworkFileName: String?
    }
}
