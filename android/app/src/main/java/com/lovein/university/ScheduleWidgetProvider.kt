package com.lovein.university

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class ScheduleWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_SCHEDULE_CLICK = "com.lovein.university.SCHEDULE_ACTION"
        const val ACTION_START_TASK = "START_TASK"
        const val ACTION_INCREMENT_TASK = "INCREMENT_TASK"
        const val ACTION_COMPLETE_TASK = "COMPLETE_TASK"
        const val ACTION_COMPLETE_SCHEDULE = "COMPLETE_SCHEDULE"
        const val ACTION_REFRESH = "REFRESH"

        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_SCHEDULE_ITEMS = "schedule_widget_items"
        private const val KEY_SCHEDULE_STATS = "schedule_widget_stats"
        private const val KEY_JWT_TOKEN = "jwt_token"
        private const val API_BASE = "https://university.lovein.fun/api/v1"

        fun triggerUpdate(context: Context) {
            val intent = Intent(context, ScheduleWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    ComponentName(context, ScheduleWidgetProvider::class.java)
                )
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }

    private val executor = Executors.newSingleThreadExecutor()

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // 1. Synchronous render with cached data
        for (appWidgetId in appWidgetIds) {
            try {
                updateWidgetChrome(context, appWidgetManager, appWidgetId)
            } catch (e: Exception) {
                // Ignore
            }
        }

        // 2. Async fetch fresh data
        executor.execute {
            try {
                fetchAndCacheData(context)
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    ComponentName(context, ScheduleWidgetProvider::class.java)
                )
                for (id in ids) {
                    updateWidgetChrome(context, manager, id)
                }
                manager.notifyAppWidgetViewDataChanged(ids, R.id.schedule_list)
            } catch (e: Exception) {
                // Silently fail, cached data displayed
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_SCHEDULE_CLICK) {
            val action = intent.getStringExtra("action") ?: return
            val itemId = intent.getLongExtra("item_id", -1)
            if (itemId == -1L && action != ACTION_REFRESH) return

            executor.execute {
                try {
                    when (action) {
                        ACTION_START_TASK -> startTask(context, itemId)
                        ACTION_INCREMENT_TASK -> {
                            val currentValue = intent.getDoubleExtra("current_value", 0.0)
                            incrementTask(context, itemId, currentValue)
                        }
                        ACTION_COMPLETE_TASK -> completeTask(context, itemId)
                        ACTION_COMPLETE_SCHEDULE -> completeSchedule(context, itemId)
                        ACTION_REFRESH -> { /* Just refresh data */ }
                    }
                    // Refresh widget after action
                    fetchAndCacheData(context)
                    val manager = AppWidgetManager.getInstance(context)
                    val ids = manager.getAppWidgetIds(
                        ComponentName(context, ScheduleWidgetProvider::class.java)
                    )
                    for (id in ids) {
                        updateWidgetChrome(context, manager, id)
                    }
                    manager.notifyAppWidgetViewDataChanged(ids, R.id.schedule_list)
                } catch (e: Exception) {
                    // Silent fail
                }
            }
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        ScheduleWidgetWorkManager.schedulePeriodicRefresh(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        ScheduleWidgetWorkManager.cancelPeriodicRefresh(context)
    }

    private fun updateWidgetChrome(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_schedule)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val hasToken = prefs.getString(KEY_JWT_TOKEN, null) != null

        // Stats text
        val statsJson = prefs.getString(KEY_SCHEDULE_STATS, null)
        val itemsJson = prefs.getString(KEY_SCHEDULE_ITEMS, null)
        val hasItems = itemsJson != null && itemsJson != "[]"

        if (statsJson != null) {
            try {
                val stats = Gson().fromJson(statsJson, ScheduleStats::class.java)
                views.setTextViewText(R.id.text_task_count, "${stats.completedTasks}/${stats.totalTasks}")
            } catch (e: Exception) {
                views.setTextViewText(R.id.text_task_count, "")
            }
        } else {
            views.setTextViewText(R.id.text_task_count, "")
        }

        // Show/hide list vs empty state
        if (!hasToken) {
            views.setViewVisibility(R.id.schedule_list, View.GONE)
            views.setViewVisibility(R.id.text_schedule_empty, View.VISIBLE)
            views.setTextViewText(R.id.text_schedule_empty, context.getString(R.string.schedule_please_login))
        } else if (!hasItems) {
            views.setViewVisibility(R.id.schedule_list, View.GONE)
            views.setViewVisibility(R.id.text_schedule_empty, View.VISIBLE)
            views.setTextViewText(R.id.text_schedule_empty, context.getString(R.string.schedule_no_items))
        } else {
            views.setViewVisibility(R.id.schedule_list, View.VISIBLE)
            views.setViewVisibility(R.id.text_schedule_empty, View.GONE)
        }

        // Set up RemoteViewsService for the ListView
        val serviceIntent = Intent(context, ScheduleWidgetService::class.java).apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
            data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
        }
        views.setRemoteAdapter(R.id.schedule_list, serviceIntent)
        views.setEmptyView(R.id.schedule_list, R.id.text_schedule_empty)

        // Template for list item clicks (buttons)
        val clickTemplate = Intent(context, ScheduleWidgetProvider::class.java).apply {
            action = ACTION_SCHEDULE_CLICK
        }
        val clickPendingIntent = PendingIntent.getBroadcast(
            context, 0, clickTemplate,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        views.setPendingIntentTemplate(R.id.schedule_list, clickPendingIntent)

        // Refresh button
        val refreshIntent = Intent(context, ScheduleWidgetProvider::class.java).apply {
            action = ACTION_SCHEDULE_CLICK
            putExtra("action", ACTION_REFRESH)
        }
        val refreshPending = PendingIntent.getBroadcast(
            context, 1, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.btn_refresh, refreshPending)

        // Click header → open app
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openAppPending = PendingIntent.getActivity(
            context, widgetId + 100, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.schedule_header, openAppPending)

        manager.updateAppWidget(widgetId, views)
    }

    // ==================== API Calls ====================

    private fun fetchAndCacheData(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return

        val items = mutableListOf<ScheduleWidgetItem>()
        var completedTasks = 0
        var totalTasks = 0

        // Fetch tasks
        try {
            val tasksUrl = URL("$API_BASE/tasks/today")
            val conn = tasksUrl.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().readText()
                val overview = Gson().fromJson(body, DailyTaskOverview::class.java)
                totalTasks = overview.totalTasks
                completedTasks = overview.completedTasks
                for (task in overview.tasks) {
                    items.add(ScheduleWidgetItem.fromTask(task))
                }
            } else if (conn.responseCode == 401) {
                prefs.edit().remove(KEY_JWT_TOKEN).apply()
                return
            }
        } catch (e: Exception) {
            // Use cached data
        }

        // Fetch schedules
        try {
            val schedUrl = URL("$API_BASE/schedules/today")
            val conn = schedUrl.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().readText()
                val overview = Gson().fromJson(body, DailyScheduleOverview::class.java)
                for (schedule in overview.schedules) {
                    items.add(ScheduleWidgetItem.fromSchedule(schedule))
                }
            }
        } catch (e: Exception) {
            // Use cached data
        }

        // Sort by time
        items.sortBy { it.sortTime }

        // Cache
        val gson = Gson()
        prefs.edit()
            .putString(KEY_SCHEDULE_ITEMS, gson.toJson(items))
            .putString(KEY_SCHEDULE_STATS, gson.toJson(ScheduleStats(completedTasks, totalTasks)))
            .apply()
    }

    // ==================== Task Actions ====================

    private fun startTask(context: Context, taskId: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return

        val url = URL("$API_BASE/tasks/$taskId/start")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 10000
        conn.readTimeout = 10000
        conn.doOutput = true
        conn.outputStream.write("{}".toByteArray())

        conn.responseCode // trigger the request
    }

    private fun incrementTask(context: Context, taskId: Long, currentValue: Double) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return

        val newValue = currentValue + 1
        val url = URL("$API_BASE/tasks/$taskId/progress")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 10000
        conn.readTimeout = 10000
        conn.doOutput = true

        val body = """{"taskId":$taskId,"actualValue":$newValue}"""
        val writer = OutputStreamWriter(conn.outputStream)
        writer.write(body)
        writer.flush()
        writer.close()

        conn.responseCode // trigger the request
    }

    private fun completeTask(context: Context, taskId: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return

        val url = URL("$API_BASE/tasks/$taskId/complete")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 10000
        conn.readTimeout = 10000
        conn.doOutput = true

        val body = """{"taskId":$taskId}"""
        val writer = OutputStreamWriter(conn.outputStream)
        writer.write(body)
        writer.flush()
        writer.close()

        conn.responseCode // trigger the request
    }

    private fun completeSchedule(context: Context, scheduleId: Long) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return

        val url = URL("$API_BASE/schedules/$scheduleId/complete")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Authorization", "Bearer $token")
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 10000
        conn.readTimeout = 10000
        conn.doOutput = true
        conn.outputStream.write("{}".toByteArray())

        conn.responseCode // trigger the request
    }
}

data class ScheduleStats(
    val completedTasks: Int,
    val totalTasks: Int
)
