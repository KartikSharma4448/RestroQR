package com.restroqr.restroqr_owner

import com.google.firebase.messaging.RemoteMessage
import io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingService

/**
 * Replaces the firebase_messaging plugin's service so a waiter request can start the
 * native alarm even when the Flutter engine is not running. Everything else (token
 * refresh, the Dart handlers) keeps working through the plugin's own receiver and
 * [FlutterFirebaseMessagingService].
 */
class WaiterMessagingService : FlutterFirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        if (message.data["type"] == "waiter_call") {
            WaiterAlarm.start(applicationContext, message.data["tableName"].orEmpty())
        }
    }
}
