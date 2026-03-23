package com.lovein.university

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import kotlin.concurrent.thread

@CapacitorPlugin(name = "UpdateBridge")
class UpdateBridgePlugin : Plugin() {

    companion object {
        private const val GITHUB_API_URL =
            "https://api.github.com/repos/Yscoshaow/UniversityApp/releases/latest"
        private const val APK_FILE_NAME = "update.apk"
    }

    @PluginMethod
    fun checkForUpdate(call: PluginCall) {
        thread {
            try {
                val url = URL(GITHUB_API_URL)
                val conn = url.openConnection() as HttpURLConnection
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json")
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val response = conn.inputStream.bufferedReader().readText()
                conn.disconnect()

                val json = JSONObject(response)
                val tagName = json.getString("tag_name") // e.g. "v0.4.1"
                val latestVersion = tagName.removePrefix("v")
                val changelog = json.optString("body", "")
                val publishedAt = json.optString("published_at", "")
                val htmlUrl = json.optString("html_url", "")

                // Find APK asset URL
                var apkUrl = ""
                var apkSize: Long = 0
                val assets = json.getJSONArray("assets")
                for (i in 0 until assets.length()) {
                    val asset = assets.getJSONObject(i)
                    val name = asset.getString("name")
                    if (name.endsWith(".apk")) {
                        apkUrl = asset.getString("browser_download_url")
                        apkSize = asset.getLong("size")
                        break
                    }
                }

                val currentVersion = getCurrentVersion()

                val ret = JSObject()
                ret.put("currentVersion", currentVersion)
                ret.put("latestVersion", latestVersion)
                ret.put("updateAvailable", isNewerVersion(currentVersion, latestVersion))
                ret.put("changelog", changelog)
                ret.put("apkUrl", apkUrl)
                ret.put("apkSize", apkSize)
                ret.put("publishedAt", publishedAt)
                ret.put("releaseUrl", htmlUrl)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Failed to check for update: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun downloadUpdate(call: PluginCall) {
        val apkUrl = call.getString("url")
        if (apkUrl == null) {
            call.reject("URL is required")
            return
        }

        thread {
            try {
                val url = URL(apkUrl)
                val conn = url.openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 30000

                val totalSize = conn.contentLength.toLong()
                val inputStream = BufferedInputStream(conn.inputStream)
                val apkFile = File(context.cacheDir, APK_FILE_NAME)
                val outputStream = FileOutputStream(apkFile)

                val buffer = ByteArray(8192)
                var downloaded: Long = 0
                var bytesRead: Int
                var lastProgress = -1

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    downloaded += bytesRead

                    if (totalSize > 0) {
                        val progress = (downloaded * 100 / totalSize).toInt()
                        // Throttle: notify only when progress changes
                        if (progress != lastProgress) {
                            lastProgress = progress
                            val progressData = JSObject()
                            progressData.put("progress", progress)
                            progressData.put("downloaded", downloaded)
                            progressData.put("total", totalSize)
                            notifyListeners("downloadProgress", progressData)
                        }
                    }
                }

                outputStream.close()
                inputStream.close()
                conn.disconnect()

                val ret = JSObject()
                ret.put("filePath", apkFile.absolutePath)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Download failed: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun installUpdate(call: PluginCall) {
        try {
            val apkFile = File(context.cacheDir, APK_FILE_NAME)
            if (!apkFile.exists()) {
                call.reject("APK file not found. Download it first.")
                return
            }

            // Check install permission on Android 8+ (API 26)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    // Open settings to let user enable "Install unknown apps"
                    val settingsIntent = Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:${context.packageName}")
                    ).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(settingsIntent)
                    call.reject("INSTALL_PERMISSION_REQUIRED")
                    return
                }
            }

            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }

            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Install failed: ${e.message}")
        }
    }

    private fun getCurrentVersion(): String {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "0.0.0"
        } catch (e: Exception) {
            "0.0.0"
        }
    }

    private fun isNewerVersion(current: String, latest: String): Boolean {
        try {
            val currentParts = current.split(".").map { it.toInt() }
            val latestParts = latest.split(".").map { it.toInt() }
            for (i in 0 until maxOf(currentParts.size, latestParts.size)) {
                val c = currentParts.getOrElse(i) { 0 }
                val l = latestParts.getOrElse(i) { 0 }
                if (l > c) return true
                if (l < c) return false
            }
        } catch (_: Exception) {}
        return false
    }
}
