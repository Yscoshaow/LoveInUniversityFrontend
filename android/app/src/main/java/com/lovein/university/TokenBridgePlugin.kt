package com.lovein.university

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "TokenBridge")
class TokenBridgePlugin : Plugin() {

    companion object {
        const val PREFS_NAME = "lock_widget_prefs"
        const val KEY_JWT_TOKEN = "jwt_token"
    }

    @PluginMethod
    fun setToken(call: PluginCall) {
        val token = call.getString("token")
        if (token == null) {
            call.reject("Token is required")
            return
        }
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_JWT_TOKEN, token).apply()

        // Trigger immediate widget updates
        LockWidgetProvider.triggerUpdate(context)
        ScheduleWidgetProvider.triggerUpdate(context)
        ManagedLockWidgetProvider.triggerUpdate(context)

        call.resolve()
    }

    @PluginMethod
    fun clearToken(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_JWT_TOKEN).apply()

        // Trigger widget updates to show logged-out state
        LockWidgetProvider.triggerUpdate(context)
        ScheduleWidgetProvider.triggerUpdate(context)
        ManagedLockWidgetProvider.triggerUpdate(context)

        call.resolve()
    }

    @PluginMethod
    fun getToken(call: PluginCall) {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_JWT_TOKEN, null)
        val ret = JSObject()
        ret.put("token", token ?: JSObject.NULL)
        call.resolve(ret)
    }
}
