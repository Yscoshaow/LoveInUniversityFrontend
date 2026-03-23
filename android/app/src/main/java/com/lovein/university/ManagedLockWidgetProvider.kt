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

class ManagedLockWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_MANAGED_TICK = "com.lovein.university.MANAGED_LOCK_TICK"
        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_MANAGED_PREFIX = "managed_lock_widget_"
        private const val KEY_JWT_TOKEN = "jwt_token"
        private const val API_BASE = "https://university.lovein.fun/api/v1"

        fun triggerUpdate(context: Context) {
            val intent = Intent(context, ManagedLockWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    ComponentName(context, ManagedLockWidgetProvider::class.java)
                )
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        fun updateSingleWidget(
            context: Context,
            manager: AppWidgetManager,
            widgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString("${KEY_MANAGED_PREFIX}${widgetId}_data", null)
            val lock = if (json != null) {
                try {
                    Gson().fromJson(json, ManagedLockSummary::class.java)
                } catch (e: Exception) { null }
            } else null

            val views = buildWidgetViews(context, widgetId, lock)
            manager.updateAppWidget(widgetId, views)
        }

        private fun buildWidgetViews(
            context: Context,
            widgetId: Int,
            lock: ManagedLockSummary?
        ): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.widget_managed_lock)

            if (lock == null) {
                showEmptyState(context, views)
                return views
            }

            views.setViewVisibility(R.id.managed_top_row, View.VISIBLE)
            views.setViewVisibility(R.id.managed_bottom_section, View.VISIBLE)
            views.setViewVisibility(R.id.managed_empty_state, View.GONE)

            // Background based on lock type / state
            val bgResource = when {
                lock.isFrozen -> R.drawable.widget_bg_frozen
                lock.isHygieneOpening -> R.drawable.widget_bg_hygiene
                lock.lockType == "SHARED" -> R.drawable.widget_bg_shared
                lock.lockType == "PRIVATE" -> R.drawable.widget_bg_private
                else -> R.drawable.widget_bg_self
            }
            views.setInt(R.id.managed_widget_root, "setBackgroundResource", bgResource)

            // Avatar icon
            val avatarIcon = when {
                lock.isFrozen -> R.drawable.ic_snowflake
                lock.isHygieneOpening -> R.drawable.ic_droplets
                lock.lockType == "SHARED" -> R.drawable.ic_users
                lock.lockType == "PRIVATE" -> R.drawable.ic_key
                else -> R.drawable.ic_lock
            }
            views.setImageViewResource(R.id.managed_avatar, avatarIcon)

            // Wearer name
            views.setTextViewText(
                R.id.managed_wearer_name,
                lock.wearerName ?: "User #${lock.wearerId}"
            )

            // Lock type
            val typeName = when (lock.lockType) {
                "SHARED" -> "共享锁"
                "PRIVATE" -> "私有锁"
                else -> "自锁"
            }
            views.setTextViewText(R.id.managed_lock_type, typeName)

            // Permission badge
            val permText = when (lock.permission) {
                "FULL_CONTROL" -> "完全控制"
                "BASIC_CONTROL" -> "基本控制"
                else -> "只读"
            }
            views.setTextViewText(R.id.managed_permission, permText)

            // Status
            val statusText = when {
                lock.isFrozen -> "已冻结"
                lock.isHygieneOpening -> "卫生开启中"
                lock.status == "ACTIVE" -> "锁定中"
                lock.status == "UNLOCKING" -> "解锁中..."
                lock.status == "UNLOCKED" -> "已解锁"
                lock.status == "EXPIRED" -> "已过期"
                lock.status == "CANCELLED" -> "已取消"
                else -> "未知"
            }
            views.setTextViewText(R.id.managed_status_text, statusText)

            // Status dot
            views.setViewVisibility(
                R.id.managed_status_dot,
                if (lock.status == "ACTIVE") View.VISIBLE else View.GONE
            )

            // Tags
            views.setViewVisibility(
                R.id.managed_tag_frozen,
                if (lock.isFrozen) View.VISIBLE else View.GONE
            )
            views.setViewVisibility(
                R.id.managed_tag_hygiene,
                if (lock.isHygieneOpening) View.VISIBLE else View.GONE
            )

            // Timer
            if (lock.status == "ACTIVE" && lock.remainingSeconds != null && lock.remainingSeconds > 0) {
                views.setViewVisibility(R.id.managed_timer_badge, View.VISIBLE)
                val days = lock.remainingSeconds / 86400
                val remainder = lock.remainingSeconds % 86400
                val base = SystemClock.elapsedRealtime() + remainder * 1000
                val format = if (days > 0) "${days}天 %s" else null
                views.setChronometer(R.id.managed_remaining_time, base, format, true)
                views.setBoolean(R.id.managed_remaining_time, "setCountDown", true)
            } else {
                views.setViewVisibility(R.id.managed_timer_badge, View.GONE)
            }

            // Click → deep link to managed lock detail
            val clickIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("com.lovein.university://managed-lock/${lock.lockId}/${lock.wearerId}/${lock.wearerTelegramId ?: 0}/${lock.wearerUsername ?: ""}")
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, widgetId, clickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.managed_widget_root, pendingIntent)

            return views
        }

        private fun showEmptyState(context: Context, views: RemoteViews) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val hasToken = prefs.getString(KEY_JWT_TOKEN, null) != null

            views.setViewVisibility(R.id.managed_top_row, View.GONE)
            views.setViewVisibility(R.id.managed_bottom_section, View.GONE)
            views.setViewVisibility(R.id.managed_empty_state, View.VISIBLE)
            views.setTextViewText(
                R.id.managed_empty_state,
                if (hasToken) context.getString(R.string.managed_widget_no_locks)
                else context.getString(R.string.widget_please_login)
            )
            views.setInt(R.id.managed_widget_root, "setBackgroundResource", R.drawable.widget_bg_empty)
        }
    }

    private val executor = Executors.newSingleThreadExecutor()

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Sync render with cached data
        for (widgetId in appWidgetIds) {
            try {
                updateSingleWidget(context, appWidgetManager, widgetId)
            } catch (e: Exception) { }
        }

        // Async refresh from API
        executor.execute {
            for (widgetId in appWidgetIds) {
                try {
                    refreshWidgetData(context, widgetId)
                    val manager = AppWidgetManager.getInstance(context)
                    updateSingleWidget(context, manager, widgetId)
                } catch (e: Exception) { }
            }
        }
        scheduleCountdownTick(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_MANAGED_TICK) {
            handleCountdownTick(context)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        ManagedLockWidgetWorkManager.schedulePeriodicRefresh(context)
        scheduleCountdownTick(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        ManagedLockWidgetWorkManager.cancelPeriodicRefresh(context)
        cancelCountdownTick(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        // Clean up stored data for deleted widgets
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val editor = prefs.edit()
        for (id in appWidgetIds) {
            editor.remove("${KEY_MANAGED_PREFIX}${id}_lock_id")
            editor.remove("${KEY_MANAGED_PREFIX}${id}_data")
        }
        editor.apply()
    }

    private fun refreshWidgetData(context: Context, widgetId: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null) ?: return
        val lockId = prefs.getLong("${KEY_MANAGED_PREFIX}${widgetId}_lock_id", -1)
        if (lockId == -1L) return

        try {
            val url = URL("$API_BASE/locks/keyholder/managed")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            if (conn.responseCode == 200) {
                val body = conn.inputStream.bufferedReader().readText()
                val locks = Gson().fromJson(body, Array<ManagedLockSummary>::class.java)
                val targetLock = locks.find { it.lockId == lockId }
                if (targetLock != null) {
                    prefs.edit()
                        .putString("${KEY_MANAGED_PREFIX}${widgetId}_data", Gson().toJson(targetLock))
                        .apply()
                }
            } else if (conn.responseCode == 401) {
                prefs.edit().remove(KEY_JWT_TOKEN).apply()
            }
        } catch (e: Exception) {
            // Use cached data
        }
    }

    // ==================== Countdown Tick ====================

    private fun handleCountdownTick(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(
            ComponentName(context, ManagedLockWidgetProvider::class.java)
        )
        for (id in ids) {
            updateSingleWidget(context, manager, id)
        }
        scheduleCountdownTick(context)
    }

    private fun scheduleCountdownTick(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ManagedLockWidgetProvider::class.java).apply {
            action = ACTION_MANAGED_TICK
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 2, intent,
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
        val intent = Intent(context, ManagedLockWidgetProvider::class.java).apply {
            action = ACTION_MANAGED_TICK
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 2, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }
}
