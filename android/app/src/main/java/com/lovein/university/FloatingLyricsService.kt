package com.lovein.university

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView

class FloatingLyricsService : Service() {

    companion object {
        const val ACTION_LYRICS_UPDATE = "com.lovein.university.FLOATING_LYRICS_UPDATE"
        const val EXTRA_SUBTITLE_TEXT = "subtitleText"
    }

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private lateinit var lyricsText: TextView
    private lateinit var params: WindowManager.LayoutParams
    private var lyricsReceiver: BroadcastReceiver? = null
    private var isViewAdded = false

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        createOverlayView()
        registerLyricsReceiver()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Handle initial subtitle if passed via intent
        intent?.getStringExtra(EXTRA_SUBTITLE_TEXT)?.let { text ->
            updateLyrics(text)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        lyricsReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
        lyricsReceiver = null
        removeOverlay()
        super.onDestroy()
    }

    private fun createOverlayView() {
        val displayMetrics = resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels
        val screenHeight = displayMetrics.heightPixels
        val maxWidth = (screenWidth * 0.8).toInt()

        // Container layout
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL

            // Rounded pill background
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#CC000000"))
                cornerRadius = dpToPx(20f)
            }

            setPadding(dpToPx(16f).toInt(), dpToPx(10f).toInt(), dpToPx(8f).toInt(), dpToPx(10f).toInt())
        }

        // Lyrics text view
        lyricsText = TextView(this).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER
            maxLines = 3
            val textParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            layoutParams = textParams
        }
        container.addView(lyricsText)

        // Close button
        val closeButton = ImageButton(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            // Use a simple "X" text instead of requiring a drawable
            visibility = View.GONE // We'll use a TextView instead
        }

        val closeText = TextView(this).apply {
            text = "\u2715"
            setTextColor(Color.parseColor("#AAFFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER
            val closeParams = LinearLayout.LayoutParams(dpToPx(28f).toInt(), dpToPx(28f).toInt())
            closeParams.marginStart = dpToPx(4f).toInt()
            layoutParams = closeParams
            setOnClickListener { stopSelf() }
        }
        container.addView(closeText)

        overlayView = container

        // Window layout params
        params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = (screenHeight * 0.2).toInt()
            width = maxWidth
        }

        // Make it draggable
        setupDragBehavior()

        // Start hidden
        overlayView.visibility = View.GONE
        windowManager.addView(overlayView, params)
        isViewAdded = true
    }

    private fun setupDragBehavior() {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDragging = false

        overlayView.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        isDragging = true
                    }
                    if (isDragging) {
                        params.x = initialX + dx.toInt()
                        // Y is inverted because gravity is BOTTOM
                        params.y = initialY - (event.rawY - initialTouchY).toInt()
                        if (isViewAdded) {
                            windowManager.updateViewLayout(overlayView, params)
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    // If not dragging, let child views handle click
                    !isDragging
                }
                else -> false
            }
        }
    }

    private fun registerLyricsReceiver() {
        lyricsReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val text = intent.getStringExtra(EXTRA_SUBTITLE_TEXT) ?: ""
                updateLyrics(text)
            }
        }
        val filter = IntentFilter(ACTION_LYRICS_UPDATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(lyricsReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(lyricsReceiver, filter)
        }
    }

    private fun updateLyrics(text: String) {
        if (text.isEmpty()) {
            // Fade out and hide
            if (overlayView.visibility == View.VISIBLE) {
                overlayView.animate()
                    .alpha(0f)
                    .setDuration(200)
                    .setListener(object : AnimatorListenerAdapter() {
                        override fun onAnimationEnd(animation: Animator) {
                            overlayView.visibility = View.GONE
                        }
                    })
                    .start()
            }
        } else {
            if (overlayView.visibility != View.VISIBLE) {
                // Fade in
                overlayView.alpha = 0f
                overlayView.visibility = View.VISIBLE
                overlayView.animate()
                    .alpha(1f)
                    .setDuration(200)
                    .setListener(null)
                    .start()
                lyricsText.text = text
            } else {
                // Crossfade text change
                lyricsText.animate()
                    .alpha(0f)
                    .setDuration(100)
                    .setListener(object : AnimatorListenerAdapter() {
                        override fun onAnimationEnd(animation: Animator) {
                            lyricsText.text = text
                            lyricsText.animate()
                                .alpha(1f)
                                .setDuration(100)
                                .setListener(null)
                                .start()
                        }
                    })
                    .start()
            }
        }
    }

    private fun removeOverlay() {
        if (isViewAdded) {
            try {
                windowManager.removeView(overlayView)
            } catch (_: Exception) {}
            isViewAdded = false
        }
    }

    private fun dpToPx(dp: Float): Float {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, resources.displayMetrics)
    }
}
