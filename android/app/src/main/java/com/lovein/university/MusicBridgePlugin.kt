package com.lovein.university

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.gson.Gson

@CapacitorPlugin(name = "MusicBridge")
class MusicBridgePlugin : Plugin() {

    companion object {
        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_MUSIC_DATA = "music_widget_data"
        private const val KEY_PENDING_COMMAND = "music_pending_command"
    }

    private var commandReceiver: BroadcastReceiver? = null

    override fun load() {
        // Listen for commands from widget buttons
        commandReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val command = intent.getStringExtra("command") ?: return
                val data = JSObject()
                data.put("command", command)
                notifyListeners("musicCommand", data)
            }
        }
        val filter = IntentFilter("com.lovein.university.MUSIC_COMMAND")
        context.registerReceiver(commandReceiver, filter, Context.RECEIVER_NOT_EXPORTED)

        // Check for pending command from when app was dead
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val pending = prefs.getString(KEY_PENDING_COMMAND, null)
        if (pending != null) {
            prefs.edit().remove(KEY_PENDING_COMMAND).apply()
            val data = JSObject()
            data.put("command", pending)
            notifyListeners("musicCommand", data)
        }
    }

    override fun handleOnDestroy() {
        commandReceiver?.let {
            try { context.unregisterReceiver(it) } catch (_: Exception) {}
        }
        commandReceiver = null
    }

    @PluginMethod
    fun updateState(call: PluginCall) {
        val trackHash = call.getString("trackHash") ?: ""
        val trackTitle = call.getString("trackTitle") ?: ""
        val workTitle = call.getString("workTitle") ?: ""
        val coverUrl = call.getString("coverUrl") ?: ""
        val playing = call.getBoolean("playing") ?: false
        val currentTime = call.getDouble("currentTime") ?: 0.0
        val duration = call.getDouble("duration") ?: 0.0
        val currentIndex = call.getInt("currentIndex") ?: 0
        val playlistSize = call.getInt("playlistSize") ?: 0
        val subtitleText = call.getString("subtitleText") ?: ""

        val data = MusicWidgetData(
            trackHash = trackHash,
            trackTitle = trackTitle,
            workTitle = workTitle,
            coverUrl = coverUrl,
            playing = playing,
            currentTime = currentTime,
            duration = duration,
            currentIndex = currentIndex,
            playlistSize = playlistSize,
            lastUpdated = System.currentTimeMillis(),
            subtitleText = subtitleText
        )

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_MUSIC_DATA, Gson().toJson(data)).apply()

        MusicWidgetProvider.triggerUpdate(context)

        // Start/update notification service
        startNotificationService()

        // Broadcast subtitle update for floating lyrics overlay
        broadcastSubtitleUpdate(subtitleText)

        call.resolve()
    }

    @PluginMethod
    fun clearState(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_MUSIC_DATA).apply()
        MusicWidgetProvider.triggerUpdate(context)

        // Stop notification service
        stopNotificationService()

        call.resolve()
    }

    @PluginMethod
    fun startFloatingLyrics(call: PluginCall) {
        if (!Settings.canDrawOverlays(context)) {
            // Open system overlay permission settings
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            val result = JSObject()
            result.put("started", false)
            result.put("reason", "overlay_permission_required")
            call.resolve(result)
            return
        }

        val intent = Intent(context, FloatingLyricsService::class.java)
        context.startService(intent)

        val result = JSObject()
        result.put("started", true)
        call.resolve(result)
    }

    @PluginMethod
    fun stopFloatingLyrics(call: PluginCall) {
        val intent = Intent(context, FloatingLyricsService::class.java)
        context.stopService(intent)
        call.resolve()
    }

    private fun broadcastSubtitleUpdate(subtitleText: String) {
        try {
            val intent = Intent(FloatingLyricsService.ACTION_LYRICS_UPDATE).apply {
                putExtra(FloatingLyricsService.EXTRA_SUBTITLE_TEXT, subtitleText)
                setPackage(context.packageName)
            }
            context.sendBroadcast(intent)
        } catch (_: Exception) {}
    }

    private fun startNotificationService() {
        try {
            val intent = Intent(context, MusicNotificationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            // Notify the service to refresh
            val updateIntent = Intent(MusicNotificationService.ACTION_UPDATE).apply {
                setPackage(context.packageName)
            }
            context.sendBroadcast(updateIntent)
        } catch (_: Exception) {}
    }

    private fun stopNotificationService() {
        try {
            val intent = Intent(MusicNotificationService.ACTION_STOP).apply {
                setPackage(context.packageName)
            }
            context.sendBroadcast(intent)
        } catch (_: Exception) {}
    }
}
