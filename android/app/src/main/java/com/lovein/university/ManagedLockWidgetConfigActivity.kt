package com.lovein.university

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.ListView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.ImageView
import com.google.gson.Gson
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class ManagedLockWidgetConfigActivity : Activity() {

    companion object {
        private const val PREFS_NAME = "lock_widget_prefs"
        private const val KEY_JWT_TOKEN = "jwt_token"
        private const val KEY_MANAGED_PREFIX = "managed_lock_widget_"
        private const val API_BASE = "https://university.lovein.fun/api/v1"
    }

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val executor = Executors.newSingleThreadExecutor()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)

        appWidgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        setContentView(R.layout.activity_managed_lock_config)
        fetchManagedLocks()
    }

    private fun fetchManagedLocks() {
        val loading = findViewById<ProgressBar>(R.id.config_loading)
        val empty = findViewById<TextView>(R.id.config_empty)
        val listView = findViewById<ListView>(R.id.config_lock_list)

        loading.visibility = View.VISIBLE
        empty.visibility = View.GONE
        listView.visibility = View.GONE

        executor.execute {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val token = prefs.getString(KEY_JWT_TOKEN, null)

            if (token == null) {
                runOnUiThread {
                    loading.visibility = View.GONE
                    empty.visibility = View.VISIBLE
                    empty.text = getString(R.string.schedule_please_login)
                }
                return@execute
            }

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
                    val locks = Gson().fromJson(body, Array<ManagedLockSummary>::class.java).toList()

                    runOnUiThread {
                        loading.visibility = View.GONE
                        if (locks.isEmpty()) {
                            empty.visibility = View.VISIBLE
                            empty.text = getString(R.string.managed_widget_no_locks)
                        } else {
                            listView.visibility = View.VISIBLE
                            listView.adapter = ManagedLockAdapter(this@ManagedLockWidgetConfigActivity, locks)
                            listView.setOnItemClickListener { _, _, position, _ ->
                                val selected = locks[position]
                                onLockSelected(selected)
                            }
                        }
                    }
                } else {
                    runOnUiThread {
                        loading.visibility = View.GONE
                        empty.visibility = View.VISIBLE
                        empty.text = if (conn.responseCode == 401)
                            getString(R.string.schedule_please_login)
                        else
                            "加载失败 (${conn.responseCode})"
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    loading.visibility = View.GONE
                    empty.visibility = View.VISIBLE
                    empty.text = "网络错误"
                }
            }
        }
    }

    private fun onLockSelected(lock: ManagedLockSummary) {
        // Save selected lock for this widget instance
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putLong("${KEY_MANAGED_PREFIX}${appWidgetId}_lock_id", lock.lockId)
            .putString("${KEY_MANAGED_PREFIX}${appWidgetId}_data", Gson().toJson(lock))
            .apply()

        // Trigger widget update
        val appWidgetManager = AppWidgetManager.getInstance(this)
        ManagedLockWidgetProvider.updateSingleWidget(
            this, appWidgetManager, appWidgetId
        )

        // Return success
        val resultValue = Intent().apply {
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        setResult(RESULT_OK, resultValue)
        finish()
    }
}

// Simple adapter for the config list
class ManagedLockAdapter(
    private val context: Context,
    private val locks: List<ManagedLockSummary>
) : BaseAdapter() {

    override fun getCount(): Int = locks.size
    override fun getItem(position: Int): ManagedLockSummary = locks[position]
    override fun getItemId(position: Int): Long = locks[position].lockId

    override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
        val view = convertView ?: LayoutInflater.from(context)
            .inflate(R.layout.item_managed_lock_config, parent, false)

        val lock = locks[position]

        // Indicator color
        val indicator = view.findViewById<ImageView>(R.id.config_indicator)
        indicator.setImageResource(when (lock.lockType) {
            "SHARED" -> R.drawable.indicator_purple
            "PRIVATE" -> R.drawable.indicator_amber
            else -> R.drawable.indicator_blue
        })

        // Wearer name
        val name = view.findViewById<TextView>(R.id.config_wearer_name)
        name.text = lock.wearerName ?: "User #${lock.wearerId}"

        // Lock type
        val typeText = view.findViewById<TextView>(R.id.config_lock_type)
        typeText.text = when (lock.lockType) {
            "SHARED" -> "共享锁"
            "PRIVATE" -> "私有锁"
            else -> "自锁"
        }

        // Status
        val status = view.findViewById<TextView>(R.id.config_status)
        when {
            lock.isFrozen -> {
                status.text = "冻结"
                status.setTextColor(0xFF3B82F6.toInt())
            }
            lock.isHygieneOpening -> {
                status.text = "卫生开启"
                status.setTextColor(0xFF10B981.toInt())
            }
            lock.status == "ACTIVE" -> {
                status.text = "锁定中"
                status.setTextColor(0xFF10B981.toInt())
            }
            else -> {
                status.text = lock.status
                status.setTextColor(0xFF94A3B8.toInt())
            }
        }

        // Permission
        val perm = view.findViewById<TextView>(R.id.config_permission)
        perm.text = when (lock.permission) {
            "FULL_CONTROL" -> "完全控制"
            "BASIC_CONTROL" -> "基本控制"
            else -> "只读"
        }

        // Remaining time
        val remaining = view.findViewById<TextView>(R.id.config_remaining)
        val seconds = lock.remainingSeconds
        if (seconds != null && seconds > 0) {
            val hours = seconds / 3600
            val minutes = (seconds % 3600) / 60
            remaining.text = if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m"
            remaining.visibility = View.VISIBLE
        } else {
            remaining.visibility = View.GONE
        }

        return view
    }
}
