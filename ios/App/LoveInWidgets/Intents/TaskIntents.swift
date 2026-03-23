import AppIntents
import WidgetKit

struct TaskStartIntent: AppIntent {
    static var title: LocalizedStringResource = "开始任务"

    @Parameter(title: "Task ID")
    var taskId: Int

    init() {
        self.taskId = 0
    }

    init(taskId: Int) {
        self.taskId = taskId
    }

    func perform() async throws -> some IntentResult {
        guard let token = SharedDataManager.getToken() else { return .result() }
        await WidgetNetworkManager.startTask(token: token, taskId: taskId)
        WidgetCenter.shared.reloadTimelines(ofKind: "ScheduleWidget")
        return .result()
    }
}

struct TaskIncrementIntent: AppIntent {
    static var title: LocalizedStringResource = "增加进度"

    @Parameter(title: "Task ID")
    var taskId: Int

    @Parameter(title: "Current Value")
    var currentValue: Double

    init() {
        self.taskId = 0
        self.currentValue = 0
    }

    init(taskId: Int, currentValue: Double) {
        self.taskId = taskId
        self.currentValue = currentValue
    }

    func perform() async throws -> some IntentResult {
        guard let token = SharedDataManager.getToken() else { return .result() }
        await WidgetNetworkManager.incrementTask(token: token, taskId: taskId, newValue: currentValue + 1)
        WidgetCenter.shared.reloadTimelines(ofKind: "ScheduleWidget")
        return .result()
    }
}

struct TaskCompleteIntent: AppIntent {
    static var title: LocalizedStringResource = "完成任务"

    @Parameter(title: "Task ID")
    var taskId: Int

    init() {
        self.taskId = 0
    }

    init(taskId: Int) {
        self.taskId = taskId
    }

    func perform() async throws -> some IntentResult {
        guard let token = SharedDataManager.getToken() else { return .result() }
        await WidgetNetworkManager.completeTask(token: token, taskId: taskId)
        WidgetCenter.shared.reloadTimelines(ofKind: "ScheduleWidget")
        return .result()
    }
}

struct ScheduleCompleteIntent: AppIntent {
    static var title: LocalizedStringResource = "完成日程"

    @Parameter(title: "Schedule ID")
    var scheduleId: Int

    init() {
        self.scheduleId = 0
    }

    init(scheduleId: Int) {
        self.scheduleId = scheduleId
    }

    func perform() async throws -> some IntentResult {
        guard let token = SharedDataManager.getToken() else { return .result() }
        await WidgetNetworkManager.completeSchedule(token: token, scheduleId: scheduleId)
        WidgetCenter.shared.reloadTimelines(ofKind: "ScheduleWidget")
        return .result()
    }
}
