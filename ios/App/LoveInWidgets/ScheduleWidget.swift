import WidgetKit
import SwiftUI

// MARK: - Schedule Display State

enum ScheduleDisplayState {
    case needsLogin
    case empty
    case loaded
}

// MARK: - Timeline Entry

struct ScheduleEntry: TimelineEntry {
    let date: Date
    let items: [ScheduleWidgetItem]
    let stats: ScheduleStats?
    let state: ScheduleDisplayState
}

// MARK: - Timeline Provider

struct ScheduleTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleEntry {
        ScheduleEntry(date: .now, items: [], stats: nil, state: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (ScheduleEntry) -> Void) {
        let items = SharedDataManager.getScheduleItems() ?? []
        let stats = SharedDataManager.getScheduleStats()
        let state: ScheduleDisplayState = items.isEmpty ? .empty : .loaded
        completion(ScheduleEntry(date: .now, items: items, stats: stats, state: state))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScheduleEntry>) -> Void) {
        guard let token = SharedDataManager.getToken() else {
            let entry = ScheduleEntry(date: .now, items: [], stats: nil, state: .needsLogin)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800))))
            return
        }

        Task {
            let result = await WidgetNetworkManager.fetchTasksAndSchedules(token: token)

            // Cache the data
            SharedDataManager.setScheduleItems(result.items)
            SharedDataManager.setScheduleStats(result.stats)

            let maxItems = context.family == .systemLarge ? 7 : 3
            let truncated = Array(result.items.prefix(maxItems))
            let state: ScheduleDisplayState = truncated.isEmpty ? .empty : .loaded
            let entry = ScheduleEntry(date: .now, items: truncated, stats: result.stats, state: state)

            // Refresh every 15 minutes
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(900))))
        }
    }
}

// MARK: - Widget View

struct ScheduleWidgetView: View {
    let entry: ScheduleEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch entry.state {
        case .needsLogin:
            emptyView("请先登录")
        case .empty:
            emptyView("今天没有任务")
        case .loaded:
            scheduleContent
        }
    }

    private func emptyView(_ text: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: "calendar")
                .font(.system(size: 24))
                .foregroundStyle(.white.opacity(0.4))
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.4))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) {
            Color(red: 0.1, green: 0.1, blue: 0.12)
        }
    }

    private var scheduleContent: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header
            HStack {
                Text("今天")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)

                if let stats = entry.stats {
                    Text("\(stats.completedTasks)/\(stats.totalTasks)")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.1))
                        .clipShape(Capsule())
                }

                Spacer()
            }
            .padding(.bottom, 2)

            // Items
            ForEach(Array(entry.items.enumerated()), id: \.offset) { _, item in
                scheduleItemRow(item)
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .containerBackground(for: .widget) {
            Color(red: 0.1, green: 0.1, blue: 0.12)
        }
    }

    private func scheduleItemRow(_ item: ScheduleWidgetItem) -> some View {
        HStack(spacing: 8) {
            // Color indicator
            Circle()
                .fill(itemColor(item))
                .frame(width: 6, height: 6)

            // Name
            VStack(alignment: .leading, spacing: 1) {
                Text(item.itemType == "TASK" ? (item.taskName ?? "") : (item.title ?? ""))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Text(itemSubtitle(item))
                    .font(.system(size: 10))
                    .foregroundStyle(.white.opacity(0.5))
                    .lineLimit(1)
            }

            Spacer()

            // Action button
            if item.itemType == "TASK" {
                taskActionButton(item)
            } else if item.scheduleStatus == "UPCOMING" {
                Button(intent: ScheduleCompleteIntent(scheduleId: Int(item.id))) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private func taskActionButton(_ item: ScheduleWidgetItem) -> some View {
        let status = item.status ?? ""
        switch status {
        case "PENDING":
            let taskType = item.taskType ?? ""
            if taskType == "DURATION" || taskType == "COUNT" {
                Button(intent: TaskStartIntent(taskId: Int(item.id))) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.blue)
                }
                .buttonStyle(.plain)
            } else if taskType == "MANUAL" {
                Button(intent: TaskCompleteIntent(taskId: Int(item.id))) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10))
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)
            }
        case "IN_PROGRESS":
            let taskType = item.taskType ?? ""
            if taskType == "COUNT" {
                Button(intent: TaskIncrementIntent(taskId: Int(item.id), currentValue: item.actualValue ?? 0)) {
                    Image(systemName: "plus")
                        .font(.system(size: 10))
                        .foregroundStyle(.orange)
                }
                .buttonStyle(.plain)
            } else {
                Image(systemName: "ellipsis")
                    .font(.system(size: 10))
                    .foregroundStyle(.yellow.opacity(0.6))
            }
        case "COMPLETED":
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 12))
                .foregroundStyle(.green.opacity(0.6))
        case "FAILED":
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 12))
                .foregroundStyle(.red.opacity(0.6))
        default:
            EmptyView()
        }
    }

    private func itemColor(_ item: ScheduleWidgetItem) -> Color {
        if item.itemType == "TASK" {
            switch item.status ?? "" {
            case "COMPLETED": return .green
            case "FAILED": return .red
            case "IN_PROGRESS": return .blue
            case "EXPIRED": return .orange
            default: return .gray
            }
        } else {
            switch item.scheduleStatus ?? "" {
            case "COMPLETED": return .green
            case "CANCELLED": return .red
            default: return .cyan
            }
        }
    }

    private func itemSubtitle(_ item: ScheduleWidgetItem) -> String {
        if item.itemType == "TASK" {
            var parts: [String] = []
            if let course = item.courseName, !course.isEmpty {
                parts.append(course)
            }
            if let progress = item.progressPercent {
                parts.append("\(Int(progress))%")
            }
            return parts.joined(separator: " · ")
        } else {
            var parts: [String] = []
            if let time = item.startTime {
                parts.append(String(time.prefix(5)))
            }
            if let location = item.location, !location.isEmpty {
                parts.append(location)
            }
            return parts.joined(separator: " · ")
        }
    }
}

// MARK: - Widget Definition

struct ScheduleWidget: Widget {
    let kind = "ScheduleWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScheduleTimelineProvider()) { entry in
            ScheduleWidgetView(entry: entry)
                .widgetURL(URL(string: "com.lovein.university://"))
        }
        .configurationDisplayName("今日日程")
        .description("查看今天的任务和日程")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
