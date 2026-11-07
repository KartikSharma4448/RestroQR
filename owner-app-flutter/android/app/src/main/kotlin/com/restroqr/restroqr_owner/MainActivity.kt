package com.restroqr.restroqr_owner

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.media.MediaPlayer
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executors

class MainActivity : FlutterActivity() {
    private val writer = Executors.newSingleThreadExecutor()
    private var pendingResult: MethodChannel.Result? = null
    private var pendingBytes: ByteArray? = null
    private val saveRequest = 4701
    private var waiterPlayer: MediaPlayer? = null
    private var activityResumed = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "restroqr/waiter_alarm")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> {
                        if (!activityResumed || waiterPlayer != null) {
                            result.success(null)
                        } else {
                            val player = WaiterAlarm.createPlayer(this)
                            if (player == null) {
                                result.error("SOUND_UNAVAILABLE", "Alarm sound unavailable", null)
                            } else {
                                player.start()
                                waiterPlayer = player
                                result.success(null)
                            }
                        }
                    }
                    "stop" -> { stopWaiterSound(); result.success(null) }
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "restroqr/qr_storage")
            .setMethodCallHandler { call, result ->
                if (call.method != "saveQr") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                if (pendingResult != null) {
                    result.error("SAVE_BUSY", "Another QR save is in progress.", null)
                    return@setMethodCallHandler
                }
                val bytes = call.argument<ByteArray>("bytes")
                val fileName = call.argument<String>("fileName")
                if (bytes == null || bytes.isEmpty() || fileName == null ||
                    !Regex("[A-Za-z0-9_-]+\\.png").matches(fileName)) {
                    result.error("INVALID_IMAGE", "Invalid QR image or filename.", null)
                    return@setMethodCallHandler
                }
                pendingResult = result
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    saveToGallery(bytes, fileName)
                } else {
                    // Older Android uses the system picker, without broad storage access.
                    pendingBytes = bytes
                    try {
                        startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "image/png"
                            putExtra(Intent.EXTRA_TITLE, fileName)
                        }, saveRequest)
                    } catch (error: Exception) {
                        finishSave(null, error)
                    }
                }
            }
    }

    private fun saveToGallery(bytes: ByteArray, fileName: String) {
        writer.execute {
            var uri: Uri? = null
            try {
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/RestroQR")
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
                uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Could not create gallery image.")
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: throw IllegalStateException("Could not write gallery image.")
                val published = contentResolver.update(uri, ContentValues().apply {
                    put(MediaStore.Images.Media.IS_PENDING, 0)
                }, null, null)
                if (published != 1) throw IllegalStateException("Could not publish gallery image.")
                finishSave(mapOf("uri" to uri.toString(), "gallery" to true))
            } catch (error: Exception) {
                uri?.let { runCatching { contentResolver.delete(it, null, null) } }
                finishSave(null, error)
            }
        }
    }

    @Deprecated("Legacy document picker callback")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != saveRequest) return
        val uri = data?.data
        val bytes = pendingBytes
        if (resultCode != Activity.RESULT_OK || uri == null || bytes == null) {
            finishSave(null)
            return
        }
        writer.execute {
            try {
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    ?: throw IllegalStateException("Could not write selected file.")
                finishSave(mapOf("uri" to uri.toString(), "gallery" to false))
            } catch (error: Exception) {
                finishSave(null, error)
            }
        }
    }

    private fun finishSave(value: Map<String, Any>?, error: Exception? = null) {
        runOnUiThread {
            val result = pendingResult
            pendingResult = null
            pendingBytes = null
            if (error == null) result?.success(value)
            else result?.error("SAVE_FAILED", "Could not save QR. Check device storage and retry.", null)
        }
    }

    private fun stopWaiterSound() {
        waiterPlayer?.let { player -> runCatching { player.stop() }; player.release() }
        waiterPlayer = null
    }

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreenIfFromAlarm(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        showOverLockScreenIfFromAlarm(intent)
    }

    // Only an alarm launch may appear over the lock screen, so the app is not
    // exposed there during normal use.
    private fun showOverLockScreenIfFromAlarm(launch: Intent?) {
        if (launch?.getBooleanExtra(WaiterAlarm.EXTRA_FROM_ALARM, false) != true) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true
        WaiterAlarm.appForeground = true
        // The in-app overlay takes over the ringing from here.
        WaiterAlarm.stop(this)
    }

    override fun onPause() {
        val wasRinging = waiterPlayer != null
        activityResumed = false
        WaiterAlarm.appForeground = false
        stopWaiterSound()
        // An unanswered request keeps ringing if the owner leaves the app.
        if (wasRinging) WaiterAlarm.start(this, "")
        super.onPause()
    }

    override fun onDestroy() {
        stopWaiterSound()
        if (pendingResult != null) finishSave(null)
        writer.shutdown()
        super.onDestroy()
    }
}
