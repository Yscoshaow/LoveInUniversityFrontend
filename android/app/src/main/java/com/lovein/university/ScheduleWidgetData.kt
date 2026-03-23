package com.lovein.university

import com.google.gson.annotations.SerializedName

// === API Response Models ===

data class DailyTaskOverview(
    val date: String,
    val totalTasks: Int,
    val completedTasks: Int,
    val inProgressTasks: Int,
    val pendingTasks: Int,
    val failedTasks: Int,
    val tasks: List<UserTaskDetail>
)

data class UserTaskDetail(
    val id: Long,
    val courseName: String,
    val courseIconUrl: String?,
    val taskName: String,
    val taskDescription: String?,
    val taskType: String,        // DURATION, COUNT, MANUAL, LOCK
    val targetValue: Double,
    val targetUnit: String,      // KILOMETERS, METERS, MINUTES, HOURS, TIMES, NONE
    val actualValue: Double,
    val status: String,          // PENDING, IN_PROGRESS, COMPLETED, FAILED, EXPIRED
    val scheduledDate: String,
    val dueAt: String?,
    val startedAt: String?,
    val completedAt: String?,
    val isExamAttempt: Boolean,
    val pointsEarned: Int,
    val remainingSeconds: Long?,
    val progressPercent: Double
)

data class DailyScheduleOverview(
    val date: String,
    val totalSchedules: Int,
    val upcomingCount: Int,
    val completedCount: Int,
    val schedules: List<ScheduleSummary>
)

data class ScheduleSummary(
    val id: Long,
    val title: String,
    val date: String,
    val startTime: String,
    val endTime: String?,
    val location: String?,
    val type: String,            // MEETING, REMINDER, DEADLINE, EVENT, OTHER
    val status: String           // UPCOMING, COMPLETED, CANCELLED
)

// === Unified Widget Item ===

data class ScheduleWidgetItem(
    val itemType: String,          // "TASK" or "SCHEDULE"
    val id: Long,
    // Task fields
    val taskName: String? = null,
    val courseName: String? = null,
    val taskType: String? = null,
    val status: String? = null,
    val targetValue: Double? = null,
    var actualValue: Double? = null,
    val targetUnit: String? = null,
    val progressPercent: Double? = null,
    val remainingSeconds: Long? = null,
    val startedAt: String? = null,
    val isExamAttempt: Boolean? = null,
    val pointsEarned: Int? = null,
    // Schedule fields
    val title: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    val location: String? = null,
    val scheduleType: String? = null,
    val scheduleStatus: String? = null,
    // Sorting
    val sortTime: String = "23:59:59"
) {
    companion object {
        fun fromTask(task: UserTaskDetail): ScheduleWidgetItem {
            val sortTime = task.dueAt?.let {
                if (it.contains("T")) it.split("T")[1].take(8) else "23:59:59"
            } ?: "23:59:59"

            return ScheduleWidgetItem(
                itemType = "TASK",
                id = task.id,
                taskName = task.taskName,
                courseName = task.courseName,
                taskType = task.taskType,
                status = task.status,
                targetValue = task.targetValue,
                actualValue = task.actualValue,
                targetUnit = task.targetUnit,
                progressPercent = task.progressPercent,
                remainingSeconds = task.remainingSeconds,
                startedAt = task.startedAt,
                isExamAttempt = task.isExamAttempt,
                pointsEarned = task.pointsEarned,
                sortTime = sortTime
            )
        }

        fun fromSchedule(schedule: ScheduleSummary): ScheduleWidgetItem {
            return ScheduleWidgetItem(
                itemType = "SCHEDULE",
                id = schedule.id,
                title = schedule.title,
                startTime = schedule.startTime,
                endTime = schedule.endTime,
                location = schedule.location,
                scheduleType = schedule.type,
                scheduleStatus = schedule.status,
                sortTime = schedule.startTime.take(8)
            )
        }
    }
}
