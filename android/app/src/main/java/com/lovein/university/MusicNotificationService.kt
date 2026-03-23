package com.lovein.university

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat
import com.google.gson.Gson
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MusicNotificationService : Service() {

    companion object {
        const val CHANNEL_ID = "music_playback"
        const val NOTIFICATION_ID = 1001
        const val ACTION_UPDATE = "com.lovein.university.MUSIC_NOTIFICATION_UPDATE"
        const val ACTION_STOP = "com.lovein.university.MUSIC_NOTIFICATION_STOP"

        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_MUSIC_DATA = "music_widget_data"
    }

    private lateinit var mediaSession: MediaSessionCompat
    private val executor = Executors.newSingleThreadExecutor()
    private var cachedCoverUrl: String? = null
    private var cachedCoverBitmap: Bitmap? = null
    private var commandReceiver: BroadcastReceiver? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        mediaSession = MediaSessionCompat(this, "MusicPlayer").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { sendMusicCommand("toggle") }
                override fun onPause() { sendMusicCommand("toggle") }
                override fun onSkipToNext() { sendMusicCommand("next") }
                override fun onSkipToPrevious() { sendMusicCommand("prev") }
            })
            isActive = true
        }

        // Listen for music data updates from the bridge
        commandReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    ACTION_UPDATE -> updateFromPrefs()
                    ACTION_STOP -> stopSelf()
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(ACTION_UPDATE)
            addAction(ACTION_STOP)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(commandReceiver, filter)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Show initial notification immediately to satisfy foreground service requirement
        val initialNotification = buildNotification(null, null)
        startForeground(NOTIFICATION_ID, initialNotification)

        // Then update with actual data
        updateFromPrefs()

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        commandReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        mediaSession.isActive = false
        mediaSession.release()
        super.onDestroy()
    }

    private fun updateFromPrefs() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_MUSIC_DATA, null)
        val data = if (json != null) {
            try { Gson().fromJson(json, MusicWidgetData::class.java) } catch (_: Exception) { null }
        } else null

        if (data == null || data.trackHash.isEmpty()) {
            stopSelf()
            return
        }

        // Update media session metadata + playback state
        updateMediaSession(data)

        // Build notification with cached cover (if available)
        val notification = buildNotification(data, cachedCoverBitmap)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)

        // Async load cover art if changed
        if (data.coverUrl.isNotEmpty() && data.coverUrl != cachedCoverUrl) {
            val coverUrl = data.coverUrl
            executor.execute {
                val bitmap = downloadBitmap(coverUrl)
                if (bitmap != null) {
                    cachedCoverUrl = coverUrl
                    cachedCoverBitmap = bitmap
                    // Rebuild notification with cover
                    updateMediaSession(data, bitmap)
                    val updated = buildNotification(data, bitmap)
                    manager.notify(NOTIFICATION_ID, updated)
                }
            }
        }
    }

    private fun updateMediaSession(data: MusicWidgetData, cover: Bitmap? = cachedCoverBitmap) {
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, data.trackTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, data.workTitle)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (data.duration * 1000).toLong())
        if (cover != null) {
            metadata.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, cover)
        }
        mediaSession.setMetadata(metadata.build())

        val state = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_PLAY_PAUSE
            )
            .setState(
                if (data.playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                (data.currentTime * 1000).toLong(),
                if (data.playing) 1.0f else 0f
            )
            .build()
        mediaSession.setPlaybackState(state)
    }

    private fun buildNotification(data: MusicWidgetData?, cover: Bitmap?): Notification {
        val contentIntent = PendingIntent.getActivity(
            this, 0,
            Intent(Intent.ACTION_VIEW).apply {
                this.data = Uri.parse("com.lovein.university://music-room")
                setPackage(packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_music_play)
            .setContentTitle(data?.trackTitle ?: "Music Player")
            .setContentText(data?.let {
                if (it.subtitleText.isNotEmpty()) it.subtitleText else it.workTitle
            } ?: "")
            .setSubText(data?.let {
                if (it.subtitleText.isNotEmpty()) it.workTitle else null
            })
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(data?.playing == true)
            .setShowWhen(false)
            .setStyle(
                MediaNotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )

        if (cover != null) {
            builder.setLargeIcon(cover)
        }

        // Action buttons: prev, play/pause, next
        builder.addAction(
            NotificationCompat.Action.Builder(
                R.drawable.ic_music_prev, "Previous",
                makeActionIntent(MusicWidgetProvider.ACTION_MUSIC_PREV, 10)
            ).build()
        )

        val playPauseIcon = if (data?.playing == true) R.drawable.ic_music_pause else R.drawable.ic_music_play
        val playPauseLabel = if (data?.playing == true) "Pause" else "Play"
        builder.addAction(
            NotificationCompat.Action.Builder(
                playPauseIcon, playPauseLabel,
                makeActionIntent(MusicWidgetProvider.ACTION_MUSIC_PLAY_PAUSE, 11)
            ).build()
        )

        builder.addAction(
            NotificationCompat.Action.Builder(
                R.drawable.ic_music_next, "Next",
                makeActionIntent(MusicWidgetProvider.ACTION_MUSIC_NEXT, 12)
            ).build()
        )

        return builder.build()
    }

    private fun makeActionIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, MusicWidgetProvider::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun sendMusicCommand(command: String) {
        val intent = Intent("com.lovein.university.MUSIC_COMMAND").apply {
            putExtra("command", command)
            setPackage(packageName)
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Music Playback",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Controls for music playback"
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
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
                val options = BitmapFactory.Options().apply { inSampleSize = 2 }
                val bitmap = BitmapFactory.decodeStream(inputStream, null, options)
                inputStream.close()
                bitmap?.let { Bitmap.createScaledBitmap(it, 256, 256, true) }
            } else null
        } catch (_: Exception) { null }
    }
}
