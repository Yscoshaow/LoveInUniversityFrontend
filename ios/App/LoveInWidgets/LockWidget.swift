import WidgetKit
import SwiftUI

// MARK: - Lock Display State

enum LockDisplayState {
    case needsLogin
    case noActiveLock
    case active
}

// MARK: - Timeline Entry

struct LockEntry: TimelineEntry {
    let date: Date
    let lock: LockWidgetData?
    let state: LockDisplayState
}

// MARK: - Timeline Provider

struct LockTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> LockEntry {
        LockEntry(date: .now, lock: nil, state: .noActiveLock)
    }

    func getSnapshot(in context: Context, completion: @escaping (LockEntry) -> Void) {
        let lock = SharedDataManager.getCachedLock()
        let state: LockDisplayState = lock != nil ? .active : .noActiveLock
        completion(LockEntry(date: .now, lock: lock, state: state))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LockEntry>) -> Void) {
        guard let token = SharedDataManager.getToken() else {
            let entry = LockEntry(date: .now, lock: nil, state: .needsLogin)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800))))
            return
        }

        Task {
            let lockData = await WidgetNetworkManager.fetchLockData(token: token)

            if let lock = lockData {
                // Cache the fresh data
                SharedDataManager.setCachedLock(lock)

                if lock.status == "ACTIVE",
                   let remaining = lock.remainingSeconds,
                   remaining > 0,
                   !lock.hideRemainingTime {
                    // Generate countdown entries every 60 seconds
                    var entries: [LockEntry] = []
                    let now = Date()
                    let count = min(Int(remaining / 60) + 1, 30)

                    for i in 0..<max(count, 1) {
                        let offset = Int64(i) * 60
                        let entryDate = now.addingTimeInterval(Double(offset))
                        var tickedLock = lock
                        tickedLock.remainingSeconds = remaining - offset
                        entries.append(LockEntry(date: entryDate, lock: tickedLock, state: .active))
                    }

                    let refreshDate = now.addingTimeInterval(1800) // Refresh API every 30 min
                    completion(Timeline(entries: entries, policy: .after(refreshDate)))
                } else {
                    let entry = LockEntry(date: .now, lock: lock, state: .active)
                    completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800))))
                }
            } else {
                SharedDataManager.clearCachedLock()
                let entry = LockEntry(date: .now, lock: nil, state: .noActiveLock)
                completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800))))
            }
        }
    }
}

// MARK: - Widget View

struct LockWidgetView: View {
    let entry: LockEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch entry.state {
        case .needsLogin:
            emptyText("请先登录")
        case .noActiveLock:
            emptyText("暂无活跃锁")
        case .active:
            if let lock = entry.lock {
                lockContent(lock: lock)
            } else {
                emptyText("暂无活跃锁")
            }
        }
    }

    private func emptyText(_ text: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: "lock.open")
                .font(.system(size: 24))
                .foregroundStyle(.white.opacity(0.4))
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            Color(red: 0.12, green: 0.12, blue: 0.15)
        }
    }

    private func lockContent(lock: LockWidgetData) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            // Top row: icon + lock type + status
            HStack(spacing: 6) {
                Image(systemName: lockIcon(lock))
                    .font(.system(size: 14))
                    .foregroundStyle(lockAccentColor(lock))

                Text(lockTypeName(lock))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))

                Spacer()

                // Status badge
                HStack(spacing: 3) {
                    if lock.status == "ACTIVE" {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                    }
                    Text(statusText(lock))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white)
                }
            }

            // Tags row
            HStack(spacing: 4) {
                if lock.isFrozen {
                    tagView(text: "冻结", color: .blue)
                }
                if lock.isHygieneOpening {
                    tagView(text: "卫生开启", color: .green)
                }
                if lock.primaryKeyholderId != nil {
                    tagView(text: "持钥人", color: .purple)
                }
                if lock.likesReceived > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "heart.fill")
                            .font(.system(size: 8))
                        Text("\(lock.likesReceived)")
                            .font(.system(size: 9))
                    }
                    .foregroundStyle(.pink)
                }
                Spacer()
            }

            Spacer()

            // Countdown timer
            if lock.status == "ACTIVE" {
                if lock.hideRemainingTime {
                    HStack(spacing: 4) {
                        Image(systemName: "eye.slash")
                            .font(.system(size: 12))
                        Text("???")
                            .font(.system(size: 20, weight: .bold, design: .monospaced))
                    }
                    .foregroundStyle(.white.opacity(0.6))
                } else if let remaining = lock.remainingSeconds, remaining > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.system(size: 12))
                            .foregroundStyle(lockAccentColor(lock))
                        Text(formatCountdown(remaining))
                            .font(.system(size: family == .systemSmall ? 16 : 20, weight: .bold, design: .monospaced))
                            .foregroundStyle(.white)
                    }
                } else {
                    Text("00:00")
                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.4))
                }
            }
        }
        .padding(12)
        .containerBackground(for: .widget) {
            lockBackground(lock)
        }
    }

    // MARK: - Helpers

    private func lockIcon(_ lock: LockWidgetData) -> String {
        if lock.isFrozen { return "snowflake" }
        if lock.isHygieneOpening { return "drop" }
        switch lock.lockType {
        case "SHARED": return "person.2"
        case "PRIVATE": return "key"
        default: return "lock"
        }
    }

    private func lockTypeName(_ lock: LockWidgetData) -> String {
        switch lock.lockType {
        case "SELF": return "自锁"
        case "SHARED": return "共享锁"
        case "PRIVATE": return "私有锁"
        default: return "自锁"
        }
    }

    private func statusText(_ lock: LockWidgetData) -> String {
        if lock.isFrozen { return "已冻结" }
        if lock.isHygieneOpening { return "卫生开启中" }
        switch lock.status {
        case "ACTIVE": return "锁定中"
        case "UNLOCKING": return "解锁中..."
        case "UNLOCKED": return "已解锁"
        case "EXPIRED": return "已过期"
        case "CANCELLED": return "已取消"
        default: return "未知"
        }
    }

    private func lockAccentColor(_ lock: LockWidgetData) -> Color {
        if lock.isFrozen { return .cyan }
        if lock.isHygieneOpening { return .green }
        switch lock.lockType {
        case "SHARED": return .purple
        case "PRIVATE": return .orange
        default: return .blue
        }
    }

    private func lockBackground(_ lock: LockWidgetData) -> some View {
        Group {
            if lock.isFrozen {
                LinearGradient(colors: [Color(red: 0.1, green: 0.15, blue: 0.3), Color(red: 0.05, green: 0.1, blue: 0.2)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            } else if lock.isHygieneOpening {
                LinearGradient(colors: [Color(red: 0.1, green: 0.25, blue: 0.15), Color(red: 0.05, green: 0.15, blue: 0.1)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            } else if lock.lockType == "SHARED" {
                LinearGradient(colors: [Color(red: 0.2, green: 0.1, blue: 0.3), Color(red: 0.1, green: 0.05, blue: 0.2)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            } else if lock.lockType == "PRIVATE" {
                LinearGradient(colors: [Color(red: 0.3, green: 0.2, blue: 0.1), Color(red: 0.2, green: 0.1, blue: 0.05)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            } else {
                LinearGradient(colors: [Color(red: 0.12, green: 0.12, blue: 0.18), Color(red: 0.08, green: 0.08, blue: 0.12)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
            }
        }
    }

    private func tagView(text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .medium))
            .foregroundStyle(.white)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(color.opacity(0.4))
            .clipShape(Capsule())
    }

    private func formatCountdown(_ seconds: Int64) -> String {
        let s = max(seconds, 0)
        let days = s / 86400
        let hours = (s % 86400) / 3600
        let minutes = (s % 3600) / 60
        let secs = s % 60

        if days > 0 {
            return "\(days)天 \(String(format: "%02d", hours)):\(String(format: "%02d", minutes))"
        } else if hours > 0 {
            return "\(String(format: "%02d", hours)):\(String(format: "%02d", minutes)):\(String(format: "%02d", secs))"
        } else {
            return "\(String(format: "%02d", minutes)):\(String(format: "%02d", secs))"
        }
    }
}

// MARK: - Widget Definition

struct LockWidget: Widget {
    let kind = "LockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LockTimelineProvider()) { entry in
            LockWidgetView(entry: entry)
                .widgetURL(URL(string: entry.lock != nil
                    ? "com.lovein.university://lock/\(entry.lock!.id)"
                    : "com.lovein.university://"))
        }
        .configurationDisplayName("锁状态")
        .description("查看当前锁的状态")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
