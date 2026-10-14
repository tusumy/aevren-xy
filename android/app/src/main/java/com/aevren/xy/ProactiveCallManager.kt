package com.aevren.xy

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import org.json.JSONObject
import java.util.Calendar

/**
 * Delivers a previously approved, AI-planned call even when the WebView is closed.
 * No API credentials or chat messages are held by Android. Scheduling is opt-in,
 * limited to 09:00–22:00 device time. The character may choose multiple calls per day.
 */
object ProactiveCallManager {
    private const val PREFS = "xy.proactive.calls.v1"
    private const val ENABLED = "enabled"
    private const val DUE = "due"
    private const val LAST_CALL = "last_call"
    private const val CALLER_ID = "character_id"
    private const val CALLER_NAME = "character_name"
    private const val ACTION = "com.aevren.xy.action.PROACTIVE_CALL_ALARM"
    private const val REQUEST_CODE = 8912
    private const val MIN_NOTICE_MS = 20 * 60 * 1000L
    private const val MAX_WINDOW_MS = 24 * 60 * 60 * 1000L

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun notificationsAllowed(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun alarmManager(context: Context) =
        context.getSystemService(AlarmManager::class.java)

    private fun pending(context: Context): PendingIntent {
        val intent = Intent(context, ProactiveCallReceiver::class.java).apply { action = ACTION }
        return PendingIntent.getBroadcast(
            context, REQUEST_CODE, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    private fun clearAlarm(context: Context) {
        alarmManager(context).cancel(pending(context))
        pending(context).cancel()
    }

    private fun approvedTime(requested: Long): Long {
        val candidate = Calendar.getInstance().apply { timeInMillis = requested }
        val hour = candidate.get(Calendar.HOUR_OF_DAY)
        if (hour >= 22 || hour < 9) {
            if (hour >= 22) candidate.add(Calendar.DAY_OF_MONTH, 1)
            candidate.set(Calendar.HOUR_OF_DAY, 9)
            candidate.set(Calendar.MINUTE, 0)
            candidate.set(Calendar.SECOND, 0)
            candidate.set(Calendar.MILLISECOND, 0)
        }
        return candidate.timeInMillis
    }

    fun getState(context: Context): JSONObject {
        val p = prefs(context)
        return JSONObject()
            .put("native", true)
            .put("enabled", p.getBoolean(ENABLED, false))
            .put("scheduledAt", p.getLong(DUE, 0))
            .put("characterId", p.getString(CALLER_ID, "") ?: "")
            .put("characterName", p.getString(CALLER_NAME, "") ?: "")
            .put("lastCallAt", p.getLong(LAST_CALL, 0))
            .put("notificationsAllowed", notificationsAllowed(context))
            .put("fullScreenAllowed", NativeCallManager.canUseFullScreenIntent(context))
    }

    fun setEnabled(context: Context, enabled: Boolean): JSONObject {
        if (enabled && !notificationsAllowed(context)) {
            return JSONObject().put("ok", false).put("error", "notification_permission_required")
        }
        if (!enabled) {
            clearAlarm(context)
            prefs(context).edit().putBoolean(ENABLED, false).putLong(DUE, 0L)
                .remove(CALLER_ID).remove(CALLER_NAME).apply()
        } else {
            prefs(context).edit().putBoolean(ENABLED, true).apply()
        }
        return getState(context).put("ok", true)
    }

    fun schedule(context: Context, characterId: String, characterName: String, whenMillis: Long): JSONObject {
        if (!prefs(context).getBoolean(ENABLED, false))
            return JSONObject().put("ok", false).put("error", "disabled")
        if (!notificationsAllowed(context))
            return JSONObject().put("ok", false).put("error", "notification_permission_required")
        if (characterId.isBlank() || characterId.length > 128 || characterName.isBlank())
            return JSONObject().put("ok", false).put("error", "invalid_character")
        val now = System.currentTimeMillis()
        if (whenMillis < now + MIN_NOTICE_MS || whenMillis > now + MAX_WINDOW_MS)
            return JSONObject().put("ok", false).put("error", "invalid_schedule_window")
        val candidate = approvedTime(whenMillis)
        if (candidate > now + 36 * 60 * 60 * 1000L)
            return JSONObject().put("ok", false).put("error", "outside_allowed_window")
        clearAlarm(context)
        prefs(context).edit().putLong(DUE, candidate)
            .putString(CALLER_ID, characterId).putString(CALLER_NAME, characterName.take(80)).apply()
        arm(context, candidate)
        return getState(context).put("ok", true)
    }

    private fun arm(context: Context, at: Long) {
        // setAndAllowWhileIdle works without exact-alarm permission, but Android
        // may defer it during Doze: this is not an exact minute guarantee.
        alarmManager(context).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context))
    }

    fun restoreAfterBoot(context: Context) {
        val p = prefs(context)
        if (!p.getBoolean(ENABLED, false)) return
        val at = p.getLong(DUE, 0)
        // A missed call doesn't ring hours late after reboot.
        if (at <= System.currentTimeMillis()) {
            p.edit().putLong(DUE, 0).apply()
            return
        }
        arm(context, at)
    }

    fun deliver(context: Context) {
        val p = prefs(context)
        val at = p.getLong(DUE, 0)
        val now = System.currentTimeMillis()
        if (!p.getBoolean(ENABLED, false) || at <= 0 || now < at - 60_000L) return
        if (!notificationsAllowed(context)) {
            p.edit().putLong(DUE, 0).apply()
            return
        }
        val id = p.getString(CALLER_ID, "").orEmpty()
        val name = p.getString(CALLER_NAME, "").orEmpty()
        p.edit().putLong(DUE, 0).putLong(LAST_CALL, now).apply()
        if (id.isBlank()) return
        // Reuse the existing locked-screen UI, ringtone and answer/decline flow.
        runCatching { NativeCallManager.showIncomingCall(context, id, name) }
    }
}

class ProactiveCallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED ->
                ProactiveCallManager.restoreAfterBoot(context)
            "com.aevren.xy.action.PROACTIVE_CALL_ALARM" ->
                ProactiveCallManager.deliver(context)
        }
    }
}
