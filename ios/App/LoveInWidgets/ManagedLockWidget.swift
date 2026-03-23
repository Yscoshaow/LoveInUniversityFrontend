import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct ManagedLockEntry: TimelineEntry {
    let date: Date
    let lock: ManagedLockSummary?
    let hasToken: Bool
    let hasConfig: Bool
}

// MARK: - Timeline Provider

struct ManagedLockTimelineProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ManagedLockEntry {
        ManagedLockEntry(date: .now, lock: nil, hasToken: true, hasConfig: false)
    }

    func snapshot(for configuration: SelectManagedLockIntent, in context: Context) async -> ManagedLockEntry {
        ManagedLockEntry(date: .now, lock: nil, hasToken: true, hasConfig: configuration.lock != nil)
    }

    func timeline(for configuration: SelectManagedLockIntent, in context: Context) async -> Timeline<ManagedLockEntry> {
        guard let token = SharedDataManager.getToken() else {
            let entry = ManagedLockEntry(date: .now, lock: nil, hasToken: false, hasConfig: false)
            return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800)))
        }

        guard let selectedLock = configuration.lock else {
            let entry = ManagedLockEntry(date: .now, lock: nil, hasToken: true, hasConfig: false)
            return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800)))
        }

        // Fetch managed locks from API
        let locks = await WidgetNetworkManager.fetchManagedLocks(token: token)
        let targetLock = locks.first { $0.lockId == selectedLock.lockId }

        guard let lock = targetLock else {
            let entry = ManagedLockEntry(date: .now, lock: nil, hasToken: true, hasConfig: true)
            return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800)))
        }

        // Generate countdown entries if active with timer
        if lock.status == "ACTIVE", let remaining = lock.remainingSeconds, remaining > 0 {
            var entries: [ManagedLockEntry] = []
            let now = Date()
            let count = min(Int(remaining / 60) + 1, 30)

            for i in 0..<max(count, 1) {
                let offset = Int64(i) * 60
                let entryDate = now.addingTimeInterval(Double(offset))
                // Create a modified lock with decremented time
                let tickedLock = ManagedLockSummary(
                    lockId: lock.lockId,
                    wearerId: lock.wearerId,
                    wearerName: lock.wearerName,
                    wearerAvatar: lock.wearerAvatar,
                    wearerTelegramId: lock.wearerTelegramId,
                    wearerUsername: lock.wearerUsername,
                    lockType: lock.lockType,
                    status: lock.status,
                    remainingSeconds: remaining - offset,
                    isFrozen: lock.isFrozen,
                    isHygieneOpening: lock.isHygieneOpening,
                    permission: lock.permission,
                    createdAt: lock.createdAt
                )
                entries.append(ManagedLockEntry(date: entryDate, lock: tickedLock, hasToken: true, hasConfig: true))
            }

            return Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800)))
        } else {
            let entry = ManagedLockEntry(date: .now, lock: lock, hasToken: true, hasConfig: true)
            return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800)))
        }
    }
}

// MARK: - Widget View

struct ManagedLockWidgetView: View {
    let entry: ManagedLockEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if !entry.hasToken {
            emptyText("请先登录")
        } else if !entry.hasConfig {
            emptyText("请选择管理锁")
        } else if let lock = entry.lock {
            lockContent(lock: lock)
        } else {
            emptyText("锁不存在")
        }
    }

    private func emptyText(_ text: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: "lock.shield")
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

    private func lockContent(lock: ManagedLockSummary) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            // Top row: avatar icon + wearer name
            HStack(spacing: 6) {
                Image(systemName: managedLockIcon(lock))
                    .font(.system(size: 14))
                    .foregroundStyle(managedLockAccentColor(lock))

                Text(lock.wearerName ?? "User #\(lock.wearerId)")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Spacer()

                // Permission badge
                Text(permissionText(lock))
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.7))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.white.opacity(0.1))
                    .clipShape(Capsule())
            }

            // Lock type + status
            HStack(spacing: 6) {
                Text(managedLockTypeName(lock))
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.6))

                HStack(spacing: 3) {
                    if lock.status == "ACTIVE" {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 5, height: 5)
                    }
                    Text(managedStatusText(lock))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.8))
                }

                Spacer()
            }

            // Tags
            HStack(spacing: 4) {
                if lock.isFrozen {
                    tagView(text: "冻结", color: .blue)
                }
                if lock.isHygieneOpening {
                    tagView(text: "卫生开启", color: .green)
                }
                Spacer()
            }

            Spacer(minLength: 0)

            // Timer
            if lock.status == "ACTIVE", let remaining = lock.remainingSeconds, remaining > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "timer")
                        .font(.system(size: 11))
                        .foregroundStyle(managedLockAccentColor(lock))
                    Text(formatCountdown(remaining))
                        .font(.system(size: family == .systemSmall ? 14 : 18, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(12)
        .containerBackground(for: .widget) {
            managedLockBackground(lock)
        }
    }

    // MARK: - Helpers

    private func managedLockIcon(_ lock: ManagedLockSummary) -> String {
        if lock.isFrozen { return "snowflake" }
        if lock.isHygieneOpening { return "drop" }
        switch lock.lockType {
        case "SHARED": return "person.2"
        case "PRIVATE": return "key"
        default: return "lock"
        }
    }

    private func managedLockTypeName(_ lock: ManagedLockSummary) -> String {
        switch lock.lockType {
        case "SELF": return "自锁"
        case "SHARED": return "共享锁"
        case "PRIVATE": return "私有锁"
        default: return "自锁"
        }
    }

    private func managedStatusText(_ lock: ManagedLockSummary) -> String {
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

    private func permissionText(_ lock: ManagedLockSummary) -> String {
        switch lock.permission {
        case "FULL_CONTROL": return "完全控制"
        case "BASIC_CONTROL": return "基本控制"
        default: return "只读"
        }
    }

    private func managedLockAccentColor(_ lock: ManagedLockSummary) -> Color {
        if lock.isFrozen { return .cyan }
        if lock.isHygieneOpening { return .green }
        switch lock.lockType {
        case "SHARED": return .purple
        case "PRIVATE": return .orange
        default: return .blue
        }
    }

    private func managedLockBackground(_ lock: ManagedLockSummary) -> some View {
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

struct ManagedLockWidget: Widget {
    let kind = "ManagedLockWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectManagedLockIntent.self,
                               provider: ManagedLockTimelineProvider()) { entry in
            ManagedLockWidgetView(entry: entry)
                .widgetURL(URL(string: entry.lock != nil
                    ? "com.lovein.university://managed-lock/\(entry.lock!.lockId)/\(entry.lock!.wearerId)/\(entry.lock!.wearerTelegramId ?? 0)/\(entry.lock!.wearerUsername ?? "")"
                    : "com.lovein.university://"))
        }
        .configurationDisplayName("管理锁")
        .description("监控指定的管理锁")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
