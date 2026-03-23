package com.lovein.university

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.google.gson.Gson
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class LockWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_COUNTDOWN_TICK = "com.lovein.university.COUNTDOWN_TICK"
        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_CACHED_LOCK = "cached_lock_json"
        private const val KEY_JWT_TOKEN = "jwt_token"
        private const val API_BASE = "https://university.lovein.fun/api/v1"

        fun triggerUpdate(context: Context) {
            val intent = Intent(context, LockWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    ComponentName(context, LockWidgetProvider::class.java)
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
        // 1. Synchronous initial render with cached data (or empty state)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cachedLock = getCachedLock(prefs)
        for (appWidgetId in appWidgetIds) {
            try {
                updateWidget(context, appWidgetManager, appWidgetId, cachedLock)
            } catch (e: Exception) {
                // Ignore render errors on initial sync render
            }
        }

        // 2. Async API fetch → update widget with fresh data
        executor.execute {
            try {
                val lockData = fetchLockData(context)
                for (appWidgetId in appWidgetIds) {
                    updateWidget(context, appWidgetManager, appWidgetId, lockData)
                }
            } catch (e: Exception) {
                // Silently fail, cached data is already displayed
            }
        }
        scheduleCountdownTick(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_COUNTDOWN_TICK) {
            handleCountdownTick(context)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        LockWidgetWorkManager.schedulePeriodicRefresh(context)
        scheduleCountdownTick(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        LockWidgetWorkManager.cancelPeriodicRefresh(context)
        cancelCountdownTick(context)
    }

    private fun updateWidget(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        lockData: LockWidgetData?
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_lock)

        if (lockData == null) {
            showEmptyState(context, views)
        } else {
            populateLockData(context, views, lockData)
        }

        // Click intent → deep link to lock detail or open app
        val clickIntent = if (lockData != null) {
            Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("com.lovein.university://lock/${lockData.id}")
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        } else {
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            context, widgetId, clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

        manager.updateAppWidget(widgetId, views)
    }

    private fun showEmptyState(context: Context, views: RemoteViews) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val hasToken = prefs.getString(KEY_JWT_TOKEN, null) != null

        views.setViewVisibility(R.id.top_row, View.GONE)
        views.setViewVisibility(R.id.bottom_section, View.GONE)
        views.setViewVisibility(R.id.text_empty_state, View.VISIBLE)
        views.setTextViewText(
            R.id.text_empty_state,
            if (hasToken) context.getString(R.string.widget_no_active_lock)
            else context.getString(R.string.widget_please_login)
        )
        views.setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_bg_empty)
    }

    private fun populateLockData(context: Context, views: RemoteViews, lock: LockWidgetData) {
        views.setViewVisibility(R.id.top_row, View.VISIBLE)
        views.setViewVisibility(R.id.bottom_section, View.VISIBLE)
        views.setViewVisibility(R.id.text_empty_state, View.GONE)

        // Background based on state/type
        val bgResource = when {
            lock.isFrozen -> R.drawable.widget_bg_frozen
            lock.isHygieneOpening -> R.drawable.widget_bg_hygiene
            lock.lockType == "SHARED" -> R.drawable.widget_bg_shared
            lock.lockType == "PRIVATE" -> R.drawable.widget_bg_private
            else -> R.drawable.widget_bg_self
        }
        views.setInt(R.id.widget_root, "setBackgroundResource", bgResource)

        // Lock type icon
        val iconResource = when {
            lock.isFrozen -> R.drawable.ic_snowflake
            lock.isHygieneOpening -> R.drawable.ic_droplets
            lock.lockType == "SHARED" -> R.drawable.ic_users
            lock.lockType == "PRIVATE" -> R.drawable.ic_key
            else -> R.drawable.ic_lock
        }
        views.setImageViewResource(R.id.icon_lock_type, iconResource)

        // Lock type text
        val typeName = when (lock.lockType) {
            "SELF" -> "自锁"
            "SHARED" -> "共享锁"
            "PRIVATE" -> "私有锁"
            else -> "自锁"
        }
        views.setTextViewText(R.id.text_lock_type, typeName)

        // Remaining time (Chronometer for live countdown)
        if (lock.status == "ACTIVE") {
            views.setViewVisibility(R.id.timer_badge, View.VISIBLE)
            if (lock.hideRemainingTime) {
                views.setImageViewResource(R.id.icon_timer, R.drawable.ic_eye_off)
                // Static "???" — no ticking
                views.setChronometer(R.id.text_remaining_time, SystemClock.elapsedRealtime(), "???", false)
            } else {
                views.setImageViewResource(R.id.icon_timer, R.drawable.ic_timer)
                val seconds = lock.remainingSeconds
                if (seconds != null && seconds > 0) {
                    val days = seconds / 86400
                    val remainder = seconds % 86400
                    val base = SystemClock.elapsedRealtime() + remainder * 1000
                    val format = if (days > 0) "${days}天 %s" else null
                    views.setChronometer(R.id.text_remaining_time, base, format, true)
                    views.setBoolean(R.id.text_remaining_time, "setCountDown", true)
                } else {
                    views.setChronometer(R.id.text_remaining_time, SystemClock.elapsedRealtime(), "00:00", false)
                }
            }
        } else {
            views.setViewVisibility(R.id.timer_badge, View.GONE)
        }

        // Status text
        val statusText = getStatusText(lock)
        views.setTextViewText(R.id.text_status, statusText)

        // Status dot visibility
        views.setViewVisibility(
            R.id.status_dot,
            if (lock.status == "ACTIVE") View.VISIBLE else View.GONE
        )

        // Tags
        views.setViewVisibility(
            R.id.tag_frozen,
            if (lock.isFrozen) View.VISIBLE else View.GONE
        )
        views.setViewVisibility(
            R.id.tag_hygiene,
            if (lock.isHygieneOpening) View.VISIBLE else View.GONE
        )
        views.setViewVisibility(
            R.id.tag_keyholder,
            if (lock.primaryKeyholderId != null) View.VISIBLE else View.GONE
        )

        // Likes
        if (lock.likesReceived > 0) {
            views.setViewVisibility(R.id.likes_badge, View.VISIBLE)
            views.setTextViewText(R.id.text_likes, lock.likesReceived.toString())
        } else {
            views.setViewVisibility(R.id.likes_badge, View.GONE)
        }
    }

    private fun getStatusText(lock: LockWidgetData): String {
        if (lock.isFrozen) return "已冻结"
        if (lock.isHygieneOpening) return "卫生开启中"
        return when (lock.status) {
            "ACTIVE" -> "锁定中"
            "UNLOCKING" -> "解锁中..."
            "UNLOCKED" -> "已解锁"
            "EXPIRED" -> "已过期"
            "CANCELLED" -> "已取消"
            else -> "未知"
        }
    }

    private fun formatRemainingTime(seconds: Long?): String {
        if (seconds == null || seconds <= 0) return "00:00"
        val days = seconds / 86400
        val hours = (seconds % 86400) / 3600
        val minutes = (seconds % 3600) / 60
        val secs = seconds % 60
        return when {
            days > 0 -> "${days}天 ${hours.toString().padStart(2, '0')}:${
                minutes.toString().padStart(2, '0')
            }"
            hours > 0 -> "${hours.toString().padStart(2, '0')}:${
                minutes.toString().padStart(2, '0')
            }:${secs.toString().padStart(2, '0')}"
            else -> "${minutes.toString().padStart(2, '0')}:${
                secs.toString().padStart(2, '0')
            }"
        }
    }

    // ==================== API Fetch ====================

    private fun fetchLockData(context: Context): LockWidgetData? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return null

        return try {
            val url = URL("$API_BASE/locks/my?activeOnly=true")
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode == 200) {
                val responseBody = connection.inputStream.bufferedReader().readText()
                val locks = Gson().fromJson(responseBody, Array<LockWidgetData>::class.java)
                val activeLock = locks.firstOrNull()

                // Cache the result
                if (activeLock != null) {
                    prefs.edit()
                        .putString(KEY_CACHED_LOCK, Gson().toJson(activeLock))
                        .apply()
                } else {
                    prefs.edit().remove(KEY_CACHED_LOCK).apply()
                }
                activeLock
            } else if (connection.responseCode == 401) {
                // Token expired
                prefs.edit().remove(KEY_JWT_TOKEN).remove(KEY_CACHED_LOCK).apply()
                null
            } else {
                getCachedLock(prefs)
            }
        } catch (e: Exception) {
            getCachedLock(prefs)
        }
    }

    private fun getCachedLock(prefs: android.content.SharedPreferences): LockWidgetData? {
        val json = prefs.getString(KEY_CACHED_LOCK, null) ?: return null
        return try {
            Gson().fromJson(json, LockWidgetData::class.java)
        } catch (e: Exception) {
            null
        }
    }

    // ==================== Countdown Tick ====================

    private fun handleCountdownTick(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_CACHED_LOCK, null) ?: return
        val lock = try {
            Gson().fromJson(json, LockWidgetData::class.java)
        } catch (e: Exception) {
            return
        }

        // Decrement remaining seconds (1 minute tick)
        if (lock.status == "ACTIVE" && !lock.isFrozen && !lock.isHygieneOpening
            && !lock.hideRemainingTime && lock.remainingSeconds != null && lock.remainingSeconds!! > 0
        ) {
            lock.remainingSeconds = lock.remainingSeconds!! - 60
            prefs.edit().putString(KEY_CACHED_LOCK, Gson().toJson(lock)).apply()
        }

        // Update all widget instances
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(
            ComponentName(context, LockWidgetProvider::class.java)
        )
        for (id in ids) {
            updateWidget(context, manager, id, lock)
        }

        // Re-schedule next tick
        scheduleCountdownTick(context)
    }

    private fun scheduleCountdownTick(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, LockWidgetProvider::class.java).apply {
            action = ACTION_COUNTDOWN_TICK
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + 60_000,
            pendingIntent
        )
    }

    private fun cancelCountdownTick(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, LockWidgetProvider::class.java).apply {
            action = ACTION_COUNTDOWN_TICK
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }
}
