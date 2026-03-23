import Foundation
import UIKit

struct WidgetNetworkManager {
    static let apiBase = "https://university.lovein.fun/api/v1"

    // MARK: - Lock Data

    static func fetchLockData(token: String) async -> LockWidgetData? {
        guard let url = URL(string: "\(apiBase)/locks/my?activeOnly=true") else { return nil }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { return nil }

            if httpResponse.statusCode == 200 {
                let locks = try JSONDecoder().decode([LockWidgetData].self, from: data)
                return locks.first
            } else if httpResponse.statusCode == 401 {
                SharedDataManager.clearToken()
                return nil
            }
            return nil
        } catch {
            return nil
        }
    }

    // MARK: - Tasks & Schedules

    static func fetchTasksAndSchedules(token: String) async -> (items: [ScheduleWidgetItem], stats: ScheduleStats) {
        var items: [ScheduleWidgetItem] = []
        var completedTasks = 0
        var totalTasks = 0

        // Fetch tasks
        if let taskOverview = await fetchTasks(token: token) {
            totalTasks = taskOverview.totalTasks
            completedTasks = taskOverview.completedTasks
            for task in taskOverview.tasks {
                items.append(ScheduleWidgetItem.fromTask(task))
            }
        }

        // Fetch schedules
        if let scheduleOverview = await fetchSchedules(token: token) {
            for schedule in scheduleOverview.schedules {
                items.append(ScheduleWidgetItem.fromSchedule(schedule))
            }
        }

        items.sort { $0.sortTime < $1.sortTime }
        let stats = ScheduleStats(completedTasks: completedTasks, totalTasks: totalTasks)
        return (items, stats)
    }

    private static func fetchTasks(token: String) async -> DailyTaskOverview? {
        guard let url = URL(string: "\(apiBase)/tasks/today") else { return nil }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { return nil }
            if httpResponse.statusCode == 200 {
                return try JSONDecoder().decode(DailyTaskOverview.self, from: data)
            } else if httpResponse.statusCode == 401 {
                SharedDataManager.clearToken()
            }
            return nil
        } catch {
            return nil
        }
    }

    private static func fetchSchedules(token: String) async -> DailyScheduleOverview? {
        guard let url = URL(string: "\(apiBase)/schedules/today") else { return nil }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { return nil }
            if httpResponse.statusCode == 200 {
                return try JSONDecoder().decode(DailyScheduleOverview.self, from: data)
            }
            return nil
        } catch {
            return nil
        }
    }

    // MARK: - Managed Locks

    static func fetchManagedLocks(token: String) async -> [ManagedLockSummary] {
        guard let url = URL(string: "\(apiBase)/locks/keyholder/managed") else { return [] }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { return [] }
            if httpResponse.statusCode == 200 {
                return try JSONDecoder().decode([ManagedLockSummary].self, from: data)
            } else if httpResponse.statusCode == 401 {
                SharedDataManager.clearToken()
            }
            return []
        } catch {
            return []
        }
    }

    // MARK: - Task Actions

    static func startTask(token: String, taskId: Int) async {
        await postAction(token: token, path: "/tasks/\(taskId)/start", body: "{}")
    }

    static func incrementTask(token: String, taskId: Int, newValue: Double) async {
        let body = "{\"taskId\":\(taskId),\"actualValue\":\(newValue)}"
        await postAction(token: token, path: "/tasks/\(taskId)/progress", body: body)
    }

    static func completeTask(token: String, taskId: Int) async {
        let body = "{\"taskId\":\(taskId)}"
        await postAction(token: token, path: "/tasks/\(taskId)/complete", body: body)
    }

    static func completeSchedule(token: String, scheduleId: Int) async {
        await postAction(token: token, path: "/schedules/\(scheduleId)/complete", body: "{}")
    }

    private static func postAction(token: String, path: String, body: String) async {
        guard let url = URL(string: "\(apiBase)\(path)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body.data(using: .utf8)
        request.timeoutInterval = 10

        _ = try? await URLSession.shared.data(for: request)
    }

    // MARK: - Image Download

    static func downloadImage(url: String) -> UIImage? {
        guard let imageUrl = URL(string: url) else { return nil }
        guard let data = try? Data(contentsOf: imageUrl) else { return nil }
        return UIImage(data: data)
    }
}
