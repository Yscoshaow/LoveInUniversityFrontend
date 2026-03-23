package com.lovein.university

import android.app.Activity
import android.app.AlertDialog
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.ProgressBar
import android.widget.LinearLayout
import android.widget.TextView
import android.view.Gravity
import com.tencent.smtt.export.external.TbsCoreSettings
import com.tencent.smtt.sdk.QbSdk
import com.tencent.smtt.sdk.TbsListener

/**
 * Application class for the "compat" flavor.
 * Initializes Tencent TBS X5 WebView engine so that old / Huawei devices
 * without an up-to-date system WebView get an improved browsing experience.
 *
 * On many Chinese devices (Huawei, Xiaomi), the X5 core is pre-installed
 * by WeChat/QQ, so initialization is instant. On other devices, the X5 core
 * (~30MB) is downloaded on first launch, and a progress dialog is shown.
 */
class CompatApplication : Application() {

    companion object {
        private const val TAG = "CompatApp"

        @Volatile
        var x5Ready = false
            private set

        @Volatile
        var x5Downloading = false
            private set

        @Volatile
        var downloadProgress = 0
            private set
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressDialog: AlertDialog? = null
    private var progressText: TextView? = null

    override fun onCreate() {
        super.onCreate()
        initX5WebView()
        registerActivityLifecycleCallbacks(X5DialogLifecycleCallbacks())
    }

    private fun initX5WebView() {
        // Enable multi-process dex2oat optimization for faster X5 init
        val settings = HashMap<String, Any>()
        settings[TbsCoreSettings.TBS_SETTINGS_USE_SPEEDY_CLASSLOADER] = true
        settings[TbsCoreSettings.TBS_SETTINGS_USE_DEXLOADER_SERVICE] = true
        QbSdk.initTbsSettings(settings)

        // Allow downloading X5 core over any network (not just WiFi)
        QbSdk.setDownloadWithoutWifi(true)

        // Track download progress
        QbSdk.setTbsListener(object : TbsListener {
            override fun onDownloadFinish(errorCode: Int) {
                Log.d(TAG, "X5 core download finished, errorCode=$errorCode")
                x5Downloading = false
                if (errorCode == 0) {
                    downloadProgress = 100
                }
                mainHandler.post { dismissProgressDialog() }
            }

            override fun onInstallFinish(errorCode: Int) {
                Log.d(TAG, "X5 core install finished, errorCode=$errorCode")
                if (errorCode == 0) {
                    x5Ready = true
                }
            }

            override fun onDownloadProgress(progress: Int) {
                Log.d(TAG, "X5 core downloading: $progress%")
                x5Downloading = true
                downloadProgress = progress
                mainHandler.post { updateProgressDialog(progress) }
            }
        })

        // Pre-init X5 core (async, non-blocking)
        QbSdk.initX5Environment(this, object : QbSdk.PreInitCallback {
            override fun onCoreInitFinished() {
                Log.d(TAG, "X5 core init finished")
            }

            override fun onViewInitFinished(isX5Core: Boolean) {
                Log.d(TAG, "X5 WebView init: using X5 = $isX5Core")
                x5Ready = isX5Core
                if (isX5Core) {
                    mainHandler.post { dismissProgressDialog() }
                }
            }
        })
    }

    private fun showProgressDialog(activity: Activity) {
        if (progressDialog != null) return

        val layout = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            val dp16 = (16 * activity.resources.displayMetrics.density).toInt()
            setPadding(dp16 * 2, dp16, dp16 * 2, dp16)
        }

        val progressBar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = downloadProgress
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        progressText = TextView(activity).apply {
            text = "正在准备浏览器内核 ($downloadProgress%)..."
            gravity = Gravity.CENTER
            val dp8 = (8 * activity.resources.displayMetrics.density).toInt()
            setPadding(0, dp8, 0, 0)
        }

        layout.addView(progressBar)
        layout.addView(progressText!!)

        progressDialog = AlertDialog.Builder(activity)
            .setTitle("首次启动准备")
            .setView(layout)
            .setCancelable(false)
            .create()

        progressDialog?.show()
    }

    private fun updateProgressDialog(progress: Int) {
        val dialog = progressDialog ?: return
        if (!dialog.isShowing) return

        progressText?.text = "正在准备浏览器内核 ($progress%)..."
        dialog.findViewById<ProgressBar>(android.R.id.progress)?.progress = progress
    }

    private fun dismissProgressDialog() {
        progressDialog?.let {
            if (it.isShowing) {
                try { it.dismiss() } catch (_: Exception) {}
            }
        }
        progressDialog = null
        progressText = null
    }

    /**
     * Shows a progress dialog on the first Activity if X5 core is being downloaded.
     * On most Chinese devices, X5 is pre-installed (by WeChat/QQ) so this never appears.
     */
    private inner class X5DialogLifecycleCallbacks : ActivityLifecycleCallbacks {
        private var handled = false

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
            if (handled || x5Ready) return
            if (!x5Downloading && downloadProgress == 0) {
                // X5 might already be available or init hasn't determined yet — wait a moment
                mainHandler.postDelayed({
                    if (!x5Ready && x5Downloading && progressDialog == null) {
                        showProgressDialog(activity)
                    }
                }, 1500)
            } else if (x5Downloading) {
                showProgressDialog(activity)
            }
            handled = true
        }

        override fun onActivityStarted(activity: Activity) {}
        override fun onActivityResumed(activity: Activity) {}
        override fun onActivityPaused(activity: Activity) {}
        override fun onActivityStopped(activity: Activity) {}
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
        override fun onActivityDestroyed(activity: Activity) {
            dismissProgressDialog()
        }
    }
}
