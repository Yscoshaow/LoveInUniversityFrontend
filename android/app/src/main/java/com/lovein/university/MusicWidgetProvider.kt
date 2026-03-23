package com.lovein.university

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import com.google.gson.Gson
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MusicWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_MUSIC_PLAY_PAUSE = "com.lovein.university.MUSIC_PLAY_PAUSE"
        const val ACTION_MUSIC_NEXT = "com.lovein.university.MUSIC_NEXT"
        const val ACTION_MUSIC_PREV = "com.lovein.university.MUSIC_PREV"
        const val ACTION_MUSIC_PROGRESS_TICK = "com.lovein.university.MUSIC_PROGRESS_TICK"

        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_MUSIC_DATA = "music_widget_data"
        private const val KEY_CACHED_COVER_URL = "music_cached_cover_url"
        private const val ALARM_REQUEST_CODE = 3
        private const val STALE_THRESHOLD_MS = 5 * 60 * 1000L // 5 minutes

        fun triggerUpdate(context: Context) {
            val intent = Intent(context, MusicWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(
                    ComponentName(context, MusicWidgetProvider::class.java)
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
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val musicData = getCachedMusicData(prefs)

        // Synchronous render with cached data
        for (widgetId in appWidgetIds) {
            try {
                updateWidget(context, appWidgetManager, widgetId, musicData, null)
            } catch (_: Exception) {}
        }

        // Async load cover art if we have data
        if (musicData != null && musicData.coverUrl.isNotEmpty()) {
            executor.execute {
                try {
                    val bitmap = downloadBitmap(musicData.coverUrl)
                    if (bitmap != null) {
                        val manager = AppWidgetManager.getInstance(context)
                        val ids = manager.getAppWidgetIds(
                            ComponentName(context, MusicWidgetProvider::class.java)
                        )
                        for (id in ids) {
                            updateWidget(context, manager, id, musicData, bitmap)
                        }
                    }
                } catch (_: Exception) {}
            }
        }

        // Schedule progress tick if playing
        if (musicData?.playing == true && !isStale(musicData)) {
            scheduleProgressTick(context)
        } else {
            cancelProgressTick(context)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_MUSIC_PLAY_PAUSE -> sendCommand(context, "toggle")
            ACTION_MUSIC_NEXT -> sendCommand(context, "next")
            ACTION_MUSIC_PREV -> sendCommand(context, "prev")
            ACTION_MUSIC_PROGRESS_TICK -> handleProgressTick(context)
        }
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        cancelProgressTick(context)
    }

    private fun sendCommand(context: Context, command: String) {
        // Store pending command (for when app restarts)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString("music_pending_command", command).apply()

        // Broadcast for MusicBridgePlugin to relay to web
        val cmdIntent = Intent("com.lovein.university.MUSIC_COMMAND")
        cmdIntent.putExtra("command", command)
        cmdIntent.setPackage(context.packageName)
        context.sendBroadcast(cmdIntent)

        // Optimistic UI update for play/pause
        if (command == "toggle") {
            val data = getCachedMusicData(prefs)
            if (data != null) {
                val updated = data.copy(playing = !data.playing)
                prefs.edit().putString(KEY_MUSIC_DATA, Gson().toJson(updated)).apply()
                triggerUpdate(context)
            }
        }
    }

    private fun updateWidget(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        musicData: MusicWidgetData?,
        coverBitmap: Bitmap?
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_music)

        if (musicData == null || musicData.trackHash.isEmpty()) {
            showEmptyState(context, views)
        } else {
            populateMusicData(context, views, musicData, coverBitmap)
        }

        // Click on widget root → open app to music room
        val clickIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("com.lovein.university://music-room")
            setPackage(context.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context, widgetId, clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.music_widget_root, pendingIntent)

        // Button PendingIntents
        views.setOnClickPendingIntent(
            R.id.music_btn_play_pause,
            makeBroadcastIntent(context, ACTION_MUSIC_PLAY_PAUSE, 100 + widgetId)
        )
        views.setOnClickPendingIntent(
            R.id.music_btn_prev,
            makeBroadcastIntent(context, ACTION_MUSIC_PREV, 200 + widgetId)
        )
        views.setOnClickPendingIntent(
            R.id.music_btn_next,
            makeBroadcastIntent(context, ACTION_MUSIC_NEXT, 300 + widgetId)
        )

        manager.updateAppWidget(widgetId, views)
    }

    private fun showEmptyState(context: Context, views: RemoteViews) {
        views.setViewVisibility(R.id.music_cover_art, View.GONE)
        views.setViewVisibility(R.id.music_info_section, View.GONE)
        views.setViewVisibility(R.id.music_empty_state, View.VISIBLE)
        views.setInt(R.id.music_widget_root, "setBackgroundResource", R.drawable.widget_bg_music_empty)
    }

    private fun populateMusicData(
        context: Context,
        views: RemoteViews,
        data: MusicWidgetData,
        coverBitmap: Bitmap?
    ) {
        views.setViewVisibility(R.id.music_cover_art, View.VISIBLE)
        views.setViewVisibility(R.id.music_info_section, View.VISIBLE)
        views.setViewVisibility(R.id.music_empty_state, View.GONE)
        views.setInt(R.id.music_widget_root, "setBackgroundResource", R.drawable.widget_bg_music)

        // Track info
        views.setTextViewText(R.id.music_track_title, data.trackTitle)
        views.setTextViewText(R.id.music_work_title, data.workTitle)

        // Subtitle
        if (data.subtitleText.isNotEmpty()) {
            views.setViewVisibility(R.id.music_subtitle_text, View.VISIBLE)
            views.setTextViewText(R.id.music_subtitle_text, data.subtitleText)
        } else {
            views.setViewVisibility(R.id.music_subtitle_text, View.GONE)
        }

        // Cover art
        if (coverBitmap != null) {
            views.setImageViewBitmap(R.id.music_cover_art, coverBitmap)
        }

        // Progress
        val progress = if (data.duration > 0) {
            ((data.currentTime / data.duration) * 1000).toInt().coerceIn(0, 1000)
        } else 0
        views.setProgressBar(R.id.music_progress_bar, 1000, progress, false)

        // Time labels
        views.setTextViewText(R.id.music_time_current, formatTime(data.currentTime))
        views.setTextViewText(R.id.music_time_total, formatTime(data.duration))

        // Play/Pause icon
        views.setImageViewResource(
            R.id.music_btn_play_pause,
            if (data.playing) R.drawable.ic_music_pause else R.drawable.ic_music_play
        )
    }

    // ==================== Progress Tick ====================

    private fun handleProgressTick(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val data = getCachedMusicData(prefs) ?: return

        if (!data.playing || isStale(data)) {
            cancelProgressTick(context)
            return
        }

        // Increment currentTime by 1 second
        if (data.duration > 0 && data.currentTime < data.duration) {
            data.currentTime = (data.currentTime + 1.0).coerceAtMost(data.duration)
            prefs.edit().putString(KEY_MUSIC_DATA, Gson().toJson(data)).apply()
        }

        // Repaint widgets
        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(
            ComponentName(context, MusicWidgetProvider::class.java)
        )
        for (id in ids) {
            updateWidget(context, manager, id, data, null)
        }

        // Re-schedule
        scheduleProgressTick(context)
    }

    private fun scheduleProgressTick(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, MusicWidgetProvider::class.java).apply {
            action = ACTION_MUSIC_PROGRESS_TICK
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + 1000,
            pendingIntent
        )
    }

    private fun cancelProgressTick(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, MusicWidgetProvider::class.java).apply {
            action = ACTION_MUSIC_PROGRESS_TICK
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, ALARM_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
    }

    // ==================== Helpers ====================

    private fun getCachedMusicData(prefs: android.content.SharedPreferences): MusicWidgetData? {
        val json = prefs.getString(KEY_MUSIC_DATA, null) ?: return null
        return try {
            Gson().fromJson(json, MusicWidgetData::class.java)
        } catch (_: Exception) {
            null
        }
    }

    private fun isStale(data: MusicWidgetData): Boolean {
        return System.currentTimeMillis() - data.lastUpdated > STALE_THRESHOLD_MS
    }

    private fun formatTime(seconds: Double): String {
        val total = seconds.toInt().coerceAtLeast(0)
        val m = total / 60
        val s = total % 60
        return "$m:${s.toString().padStart(2, '0')}"
    }

    private fun downloadBitmap(urlString: String): Bitmap? {
        return try {
            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.doInput = true
            connection.connect()

            if (connection.responseCode == 200) {
                val inputStream = connection.inputStream
                // Decode with sample size for memory efficiency
                val options = BitmapFactory.Options().apply {
                    inSampleSize = 2 // Reduce to ~half size
                }
                val bitmap = BitmapFactory.decodeStream(inputStream, null, options)
                inputStream.close()
                // Scale to 128x128 for widget
                bitmap?.let {
                    Bitmap.createScaledBitmap(it, 128, 128, true)
                }
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun makeBroadcastIntent(context: Context, action: String, requestCode: Int): PendingIntent {
        val intent = Intent(context, MusicWidgetProvider::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
