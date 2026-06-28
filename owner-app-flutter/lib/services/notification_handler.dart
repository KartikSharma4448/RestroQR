import 'dart:developer';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'owner_api_service.dart';

/// Top-level handler for background messages (must be a top-level function).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  log('Background message received: ${message.messageId}');
}

/// Handles FCM push notification registration, unregistration,
/// and incoming notification display/navigation.
class NotificationHandler {
  final OwnerApiService _ownerApiService;
  final FirebaseMessaging _messaging;

  /// Callback invoked when user taps a notification — navigates to orders.
  VoidCallback? onNotificationTap;

  String? _currentToken;

  NotificationHandler({
    required OwnerApiService ownerApiService,
    FirebaseMessaging? messaging,
  })  : _ownerApiService = ownerApiService,
        _messaging = messaging ?? FirebaseMessaging.instance;

  /// Initialize notification handling. Call after successful login/auth check.
  Future<void> initialize() async {
    // Request notification permissions (Android 13+ requires explicit permission)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      log('Notification permissions denied');
      return;
    }

    // Register background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Get FCM token and register with backend
    await _registerToken();

    // Listen for token refresh
    _messaging.onTokenRefresh.listen((newToken) async {
      await _registerTokenWithBackend(newToken);
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle notification taps when app is in background/terminated
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if app was opened from a terminated state via notification
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  /// Register the current FCM token with the backend.
  Future<void> _registerToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) {
        await _registerTokenWithBackend(token);
      }
    } catch (e) {
      log('Failed to get FCM token: $e');
    }
  }

  /// Send FCM token to the backend API.
  Future<void> _registerTokenWithBackend(String token) async {
    try {
      _currentToken = token;
      await _ownerApiService.registerFcmToken(fcmToken: token);
      log('FCM token registered with backend');
    } catch (e) {
      log('Failed to register FCM token with backend: $e');
    }
  }

  /// Unregister the FCM token from the backend. Call on logout.
  Future<void> unregister() async {
    try {
      await _ownerApiService.unregisterFcmToken();
      _currentToken = null;
      log('FCM token unregistered from backend');
    } catch (e) {
      log('Failed to unregister FCM token: $e');
    }
  }

  /// Handle a foreground message — show a local notification-style alert.
  void _handleForegroundMessage(RemoteMessage message) {
    final tableName = message.data['tableName'] ?? 'Unknown Table';
    final orderTotal = message.data['orderTotal'] ?? '0.00';

    log('Foreground notification: New order from $tableName — ₹$orderTotal');

    // Notify listeners that a new order notification arrived.
    // The UI layer can show a snackbar or in-app alert.
    onForegroundNotification?.call(tableName, orderTotal);
  }

  /// Callback for foreground notifications to show in-app UI.
  void Function(String tableName, String orderTotal)? onForegroundNotification;

  /// Handle notification tap — navigate to orders screen.
  void _handleNotificationTap(RemoteMessage message) {
    log('Notification tapped: ${message.data}');
    onNotificationTap?.call();
  }

  /// Current registered token (for debugging/testing).
  String? get currentToken => _currentToken;
}
