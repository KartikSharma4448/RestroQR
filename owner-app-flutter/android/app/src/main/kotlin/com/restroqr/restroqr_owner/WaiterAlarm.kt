package com.restroqr.restroqr_owner

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager

/**
 * Shared helpers for the waiter-call alarm.
 *
 * While the app is open the Flutter overlay plays the alarm through MainActivity.
 * When the app is in the background or closed, [start] launches [WaiterAlarmService],
 * which rings until the owner opens the app (or after a safety timeout).
 */
object WaiterAlarm {
    const val EXTRA_TABLE = "tableName"
    const val EXTRA_FROM_ALARM = "waiter_alarm"

    /** True only while MainActivity is resumed. Set from the UI thread, read from FCM threads. */
    @Volatile
    var appForeground = false

    fun start(context: Context, tableName: String) {
        // The open app already rings and shows the overlay.
        if (appForeground) return
        val intent = Intent(context, WaiterAlarmService::class.java)
            .putExtra(EXTRA_TABLE, tableName)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Exception) {
            // If the system refuses a background start the push notification path is lost,
            // but the in-app poll still shows the request when the app is opened.
        }
    }

    fun stop(context: Context) {
        context.stopService(Intent(context, WaiterAlarmService::class.java))
    }

    /** Looping alarm-volume player, or null when the device has no usable tone. */
    fun createPlayer(context: Context): MediaPlayer? {
        val tone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            ?: return null
        val player = MediaPlayer()
        return try {
            player.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            player.setDataSource(context, tone)
            player.isLooping = true
            player.setWakeMode(context, PowerManager.PARTIAL_WAKE_LOCK)
            player.prepare()
            player
        } catch (_: Exception) {
            player.release()
            null
        }
    }
}
