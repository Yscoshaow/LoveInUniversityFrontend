package com.lovein.university

import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class ScheduleWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return ScheduleWidgetFactory(applicationContext)
    }
}

class ScheduleWidgetFactory(
    private val context: Context
) : RemoteViewsService.RemoteViewsFactory {

    companion object {
        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_SCHEDULE_ITEMS = "schedule_widget_items"
        private const val KEY_SCHEDULE_STATS = "schedule_widget_stats"
    }

    private var items: List<ScheduleWidgetItem> = emptyList()

    override fun onCreate() {}

    override fun onDataSetChanged() {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_SCHEDULE_ITEMS, null)
        items = if (json != null) {
            try {
                val type = object : TypeToken<List<ScheduleWidgetItem>>() {}.type
                Gson().fromJson(json, type)
            } catch (e: Exception) {
                emptyList()
            }
        } else {
            emptyList()
        }
    }

    override fun onDestroy() {
        items = emptyList()
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        if (position >= items.size) {
            return RemoteViews(context.packageName, R.layout.widget_schedule_item_task)
        }

        val item = items[position]
        return if (item.itemType == "SCHEDULE") {
            buildScheduleItemView(item)
        } else {
            buildTaskItemView(item)
        }
    }

    private fun buildScheduleItemView(item: ScheduleWidgetItem): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_schedule_item_event)

        // Indicator color based on schedule type
        val indicatorRes = when (item.scheduleType) {
            "MEETING" -> R.drawable.indicator_blue
            "DEADLINE" -> R.drawable.indicator_red
            "REMINDER" -> R.drawable.indicator_amber
            "EVENT" -> R.drawable.indicator_purple
            else -> R.drawable.indicator_gray
        }
        views.setImageViewResource(R.id.event_indicator, indicatorRes)

        // Time
        val timeStr = item.startTime?.take(5)?.replace(":", ".") ?: ""
        views.setTextViewText(R.id.text_event_time, timeStr)

        // Title
        views.setTextViewText(R.id.text_event_title, item.title ?: "")

        // Location
        if (item.location != null) {
            views.setViewVisibility(R.id.text_event_location, View.VISIBLE)
            views.setTextViewText(R.id.text_event_location, item.location)
        } else {
            views.setViewVisibility(R.id.text_event_location, View.GONE)
        }

        // Action button based on status
        val isCompleted = item.scheduleStatus == "COMPLETED"
        val isCancelled = item.scheduleStatus == "CANCELLED"

        if (isCompleted) {
            views.setViewVisibility(R.id.btn_event_action, View.GONE)
            views.setViewVisibility(R.id.text_event_done, View.VISIBLE)
            // Gray out text
            views.setTextColor(R.id.text_event_title, 0xFF94A3B8.toInt())
            views.setTextColor(R.id.text_event_time, 0xFF94A3B8.toInt())
            views.setImageViewResource(R.id.event_indicator, R.drawable.indicator_gray)
        } else if (isCancelled) {
            views.setViewVisibility(R.id.btn_event_action, View.GONE)
            views.setViewVisibility(R.id.text_event_done, View.GONE)
            views.setTextColor(R.id.text_event_title, 0xFF94A3B8.toInt())
        } else {
            views.setViewVisibility(R.id.btn_event_action, View.VISIBLE)
            views.setViewVisibility(R.id.text_event_done, View.GONE)

            // Fill-in intent for complete action
            val fillIntent = Intent().apply {
                putExtra("action", ScheduleWidgetProvider.ACTION_COMPLETE_SCHEDULE)
                putExtra("item_id", item.id)
            }
            views.setOnClickFillInIntent(R.id.btn_event_action, fillIntent)
        }

        return views
    }

    private fun buildTaskItemView(item: ScheduleWidgetItem): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_schedule_item_task)

        val isCompleted = item.status == "COMPLETED"
        val isFailed = item.status == "FAILED"
        val isExpired = item.status == "EXPIRED"
        val isDone = isCompleted || isFailed || isExpired

        // Indicator color based on status
        val indicatorRes = when {
            isCompleted -> R.drawable.indicator_green
            isFailed -> R.drawable.indicator_red
            isExpired -> R.drawable.indicator_amber
            item.status == "IN_PROGRESS" -> R.drawable.indicator_blue
            else -> R.drawable.indicator_gray
        }
        views.setImageViewResource(R.id.task_indicator, indicatorRes)

        // Task name
        views.setTextViewText(R.id.text_task_name, item.taskName ?: "")
        if (isDone) {
            views.setTextColor(R.id.text_task_name, 0xFF94A3B8.toInt())
        } else {
            views.setTextColor(R.id.text_task_name, 0xFF1E293B.toInt())
        }

        // Course name
        views.setTextViewText(R.id.text_task_course, item.courseName ?: "")

        // Progress text
        val progressText = formatProgress(item)
        views.setTextViewText(R.id.text_task_progress, progressText)

        // Progress bar - use LayoutParams trick to set width percentage
        // RemoteViews can't set width dynamically, so we hide the progress bar
        // and just show the text progress instead
        val percent = item.progressPercent ?: 0.0
        if (percent > 0 && !isDone) {
            views.setViewVisibility(R.id.progress_container, View.VISIBLE)
        } else if (isDone) {
            views.setViewVisibility(R.id.progress_container, View.GONE)
        } else {
            views.setViewVisibility(R.id.progress_container, View.VISIBLE)
        }

        // Action button
        if (isDone) {
            views.setViewVisibility(R.id.btn_task_action, View.GONE)
            views.setViewVisibility(R.id.text_task_done, View.VISIBLE)
            if (isCompleted && (item.pointsEarned ?: 0) > 0) {
                views.setTextViewText(R.id.text_task_done, "+${item.pointsEarned}pts")
            } else if (isFailed) {
                views.setTextViewText(R.id.text_task_done, "未完成")
                views.setTextColor(R.id.text_task_done, 0xFFEF4444.toInt())
            } else if (isExpired) {
                views.setTextViewText(R.id.text_task_done, "已过期")
                views.setTextColor(R.id.text_task_done, 0xFFF59E0B.toInt())
            }
        } else {
            views.setViewVisibility(R.id.text_task_done, View.GONE)
            configureTaskButton(views, item)
        }

        return views
    }

    private fun configureTaskButton(views: RemoteViews, item: ScheduleWidgetItem) {
        when (item.taskType) {
            "DURATION" -> {
                if (item.status == "PENDING") {
                    // Start button
                    views.setViewVisibility(R.id.btn_task_action, View.VISIBLE)
                    views.setImageViewResource(R.id.btn_task_action, R.drawable.ic_play)
                    views.setInt(R.id.btn_task_action, "setBackgroundResource", R.drawable.btn_action_start)
                    val fillIntent = Intent().apply {
                        putExtra("action", ScheduleWidgetProvider.ACTION_START_TASK)
                        putExtra("item_id", item.id)
                    }
                    views.setOnClickFillInIntent(R.id.btn_task_action, fillIntent)
                } else {
                    // In progress — show timing text instead of button
                    views.setViewVisibility(R.id.btn_task_action, View.GONE)
                    views.setViewVisibility(R.id.text_task_done, View.VISIBLE)
                    views.setTextViewText(R.id.text_task_done, "计时中")
                    views.setTextColor(R.id.text_task_done, 0xFF3B82F6.toInt())
                }
            }
            "COUNT" -> {
                // +1 button
                views.setViewVisibility(R.id.btn_task_action, View.VISIBLE)
                views.setImageViewResource(R.id.btn_task_action, R.drawable.ic_plus)
                views.setInt(R.id.btn_task_action, "setBackgroundResource", R.drawable.btn_action_increment)
                val fillIntent = Intent().apply {
                    putExtra("action", ScheduleWidgetProvider.ACTION_INCREMENT_TASK)
                    putExtra("item_id", item.id)
                    putExtra("current_value", item.actualValue ?: 0.0)
                }
                views.setOnClickFillInIntent(R.id.btn_task_action, fillIntent)
            }
            "MANUAL" -> {
                // Complete button
                views.setViewVisibility(R.id.btn_task_action, View.VISIBLE)
                views.setImageViewResource(R.id.btn_task_action, R.drawable.ic_check)
                views.setInt(R.id.btn_task_action, "setBackgroundResource", R.drawable.btn_action_complete)
                val fillIntent = Intent().apply {
                    putExtra("action", ScheduleWidgetProvider.ACTION_COMPLETE_TASK)
                    putExtra("item_id", item.id)
                }
                views.setOnClickFillInIntent(R.id.btn_task_action, fillIntent)
            }
            "LOCK" -> {
                // Auto badge — no button
                views.setViewVisibility(R.id.btn_task_action, View.GONE)
                views.setViewVisibility(R.id.text_task_done, View.VISIBLE)
                views.setTextViewText(R.id.text_task_done, "自动")
                views.setTextColor(R.id.text_task_done, 0xFF94A3B8.toInt())
            }
            else -> {
                views.setViewVisibility(R.id.btn_task_action, View.GONE)
            }
        }
    }

    private fun formatProgress(item: ScheduleWidgetItem): String {
        val actual = item.actualValue ?: 0.0
        val target = item.targetValue ?: 0.0

        return when (item.taskType) {
            "DURATION" -> {
                val actualMin = actual.toInt()
                val targetMin = target.toInt()
                "${formatMinutes(actualMin)}/${formatMinutes(targetMin)}"
            }
            "COUNT" -> {
                val unit = if (item.targetUnit == "TIMES") "次" else ""
                "${actual.toInt()}/${target.toInt()}$unit"
            }
            "LOCK" -> {
                val actualMin = actual.toInt()
                val targetMin = target.toInt()
                "${formatMinutes(actualMin)}/${formatMinutes(targetMin)}"
            }
            else -> {
                val pct = item.progressPercent ?: 0.0
                "${pct.toInt()}%"
            }
        }
    }

    private fun formatMinutes(totalMinutes: Int): String {
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) {
            "${hours}h${minutes.toString().padStart(2, '0')}m"
        } else {
            "${minutes}m"
        }
    }

    override fun getLoadingView(): RemoteViews? = null

    override fun getViewTypeCount(): Int = 2  // task and schedule

    override fun getItemId(position: Int): Long {
        return if (position < items.size) {
            val item = items[position]
            // Use unique hash to avoid collisions between tasks and schedules
            if (item.itemType == "TASK") item.id else item.id + 1_000_000
        } else {
            position.toLong()
        }
    }

    override fun hasStableIds(): Boolean = true
}
