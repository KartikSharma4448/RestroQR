package com.restroqr.restroqr_owner

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

/**
 * Rings the waiter alarm while the app is not in the foreground.
 *
 * Runs as a foreground service so the sound keeps looping after the push message has
 * been handled. It stops when the owner opens the app (MainActivity.onResume), when the
 * system stops it, or after [MAX_RING_MS].
 */
class WaiterAlarmService : Service() {
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val handler = Handler(Looper.getMainLooper())
    private val autoStop = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val table = intent?.getStringExtra(WaiterAlarm.EXTRA_TABLE)
            ?.takeIf { it.isNotBlank() } ?: "A table"
        ensureChannel()
        val notification = buildNotification(table)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        if (player == null) {
            player = WaiterAlarm.createPlayer(this)?.also { it.start() }
            startVibration()
        }
        handler.removeCallbacks(autoStop)
        handler.postDelayed(autoStop, MAX_RING_MS)
        return START_NOT_STICKY
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        // The sound and vibration come from this service, so the channel stays silent.
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Waiter calls",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Rings an alarm when a table asks for a waiter"
            setSound(null, null)
            enableVibration(false)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(table: String): android.app.Notification {
        val open = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(WaiterAlarm.EXTRA_FROM_ALARM, true)
        val pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Waiter requested")
            .setContentText("$table needs assistance")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(pending)
            .setFullScreenIntent(pending, true)
            .build()
    }

    @Suppress("DEPRECATION")
    private fun startVibration() {
        val service = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (!service.hasVibrator()) return
        vibrator = service
        val pattern = longArrayOf(0, 800, 600)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            service.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            service.vibrate(pattern, 0)
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(autoStop)
        player?.let { current ->
            runCatching { current.stop() }
            current.release()
        }
        player = null
        vibrator?.cancel()
        vibrator = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "waiter_alarm"
        private const val NOTIFICATION_ID = 7301
        private const val MAX_RING_MS = 2 * 60 * 1000L
    }
}
