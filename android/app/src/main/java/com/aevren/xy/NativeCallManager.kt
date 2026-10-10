package com.aevren.xy

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Person
import android.util.Base64
import java.io.File
import java.security.MessageDigest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import org.json.JSONObject

object NativeCallManager {
    const val CHANNEL_ID = "aevren_incoming_calls"
    const val NOTIFICATION_ID = 8801
    const val ACTION_SHOW = "com.aevren.xy.action.SHOW_INCOMING_CALL"
    const val ACTION_ANSWER = "com.aevren.xy.action.ANSWER_INCOMING_CALL"
    const val ACTION_DECLINE = "com.aevren.xy.action.DECLINE_INCOMING_CALL"

    const val EXTRA_CHARACTER_ID = "character_id"
    const val EXTRA_CHARACTER_NAME = "character_name"
    private fun avatarFile(context: Context, id: String): File {
        val hex = MessageDigest.getInstance("SHA-256").digest(id.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        return File(context.filesDir, "incoming_avatar_$hex.webp")
    }
    fun saveAvatar(context: Context, id: String, dataUrl: String): Boolean {
        if (id.isBlank() || id.length > 128) return false
        val file = avatarFile(context, id)
        if (dataUrl.isBlank()) { file.delete(); return true }
        if (!dataUrl.startsWith("data:image/") || !dataUrl.contains(";base64,")) return false
        val content = dataUrl.substringAfter(";base64,")
        if (content.length > 600000) return false
        return try {
            val bytes = Base64.decode(content, Base64.DEFAULT)
            if (bytes.size > 450000) false else { file.writeBytes(bytes); true }
        } catch (_: Exception) { false }
    }
    fun loadAvatar(context: Context, id: String): android.graphics.Bitmap? = try {
        val file = avatarFile(context, id)
        if (file.isFile) android.graphics.BitmapFactory.decodeFile(file.absolutePath) else null
    } catch (_: Exception) { null }

    private fun notificationManager(context: Context): NotificationManager =
        context.getSystemService(NotificationManager::class.java)

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = notificationManager(context)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AI 来电",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "显示 AI 角色的来电"
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 480, 320, 480, 320, 700)
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
        }
        manager.createNotificationChannel(channel)
    }

    fun canUseFullScreenIntent(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= 34) {
            notificationManager(context).canUseFullScreenIntent()
        } else true
    }

    fun openFullScreenIntentSettings(activity: Activity) {
        if (Build.VERSION.SDK_INT < 34) return
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
            data = Uri.parse("package:" + activity.packageName)
        }
        runCatching { activity.startActivity(intent) }
    }

    fun dismiss(context: Context) {
        notificationManager(context).cancel(NOTIFICATION_ID)
    }

    fun showIncomingCall(context: Context, characterId: String, characterName: String): JSONObject {
        ensureChannel(context)
        val name = characterName.trim().ifBlank { "AI 来电" }
        val id = characterId.trim()

        val baseIntent = Intent(context, IncomingCallActivity::class.java).apply {
            putExtra(EXTRA_CHARACTER_ID, id)
            putExtra(EXTRA_CHARACTER_NAME, name)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val fullScreenIntent = PendingIntent.getActivity(
            context,
            8801,
            Intent(baseIntent).setAction(ACTION_SHOW),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val answerIntent = PendingIntent.getActivity(
            context,
            8802,
            Intent(baseIntent).setAction(ACTION_ANSWER),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val declineIntent = PendingIntent.getActivity(
            context,
            8803,
            Intent(baseIntent).setAction(ACTION_DECLINE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(fullScreenIntent)
            .setCategory(Notification.CATEGORY_CALL)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val person = Person.Builder()
                .setName(name)
                .setImportant(true)
                .build()
            builder.setStyle(Notification.CallStyle.forIncomingCall(person, declineIntent, answerIntent))
                .addPerson(person)
        } else {
            builder
                .setContentTitle(name)
                .setContentText("语音来电")
                .addAction(
                    Notification.Action.Builder(
                        android.R.drawable.ic_menu_close_clear_cancel,
                        "拒绝",
                        declineIntent
                    ).build()
                )
                .addAction(
                    Notification.Action.Builder(
                        android.R.drawable.sym_action_call,
                        "接听",
                        answerIntent
                    ).build()
                )
        }

        notificationManager(context).notify(NOTIFICATION_ID, builder.build())
        return JSONObject()
            .put("ok", true)
            .put("fullScreenAllowed", canUseFullScreenIntent(context))
    }
}

class NativeCallBridge(
    private val activity: Activity
) {
    @JavascriptInterface
    fun setCharacterAvatar(characterId: String, avatarDataUrl: String): Boolean =
        NativeCallManager.saveAvatar(activity, characterId, avatarDataUrl)

    @JavascriptInterface
    fun showIncomingCall(characterId: String, characterName: String): String {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            activity.runOnUiThread {
                activity.requestPermissions(
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    MainActivity.CALL_NOTIFICATION_PERMISSION
                )
            }
            return JSONObject()
                .put("ok", false)
                .put("error", "notification_permission_requested")
                .toString()
        }
        return NativeCallManager.showIncomingCall(activity, characterId, characterName).toString()
    }

    @JavascriptInterface
    fun dismissIncomingCall() {
        NativeCallManager.dismiss(activity)
    }

    @JavascriptInterface
    fun canUseFullScreenIntent(): Boolean =
        NativeCallManager.canUseFullScreenIntent(activity)

    @JavascriptInterface
    fun openFullScreenIntentSettings() {
        NativeCallManager.openFullScreenIntentSettings(activity)
    }
}
