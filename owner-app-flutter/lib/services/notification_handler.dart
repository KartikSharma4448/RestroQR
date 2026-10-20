import 'dart:async';
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

  /// Callback invoked when user taps a notification — navigates to orders.
  VoidCallback? onNotificationTap;

  String? _currentToken;
  Future<void>? _initialization;
  int _generation = 0;
  final _subscriptions = <StreamSubscription<dynamic>>[];

  NotificationHandler({
    required OwnerApiService ownerApiService,
    FirebaseMessaging? messaging,
    Stream<RemoteMessage>? foregroundMessages,
    Stream<RemoteMessage>? openedMessages,
  }) : _ownerApiService = ownerApiService,
       _explicitMessaging = messaging,
       _foregroundMessages = foregroundMessages,
       _openedMessages = openedMessages;

  final FirebaseMessaging? _explicitMessaging;
  final Stream<RemoteMessage>? _foregroundMessages;
  final Stream<RemoteMessage>? _openedMessages;

  FirebaseMessaging get _messaging =>
      _explicitMessaging ?? FirebaseMessaging.instance;

  /// Initialize notification handling. Call after successful login/auth check.
  Future<void> initialize() =>
      _initialization ??= _initializeSafely(_generation);

  Future<void> _initializeSafely(int generation) async {
    try {
      await _doInitialize(generation);
    } catch (e) {
      if (generation == _generation) stop();
      log(
        'NotificationHandler initialization failed (Firebase may not be configured): $e',
      );
    }
  }

  Future<void> _doInitialize(int generation) async {
    // Request notification permissions (Android 13+ requires explicit permission)
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (generation != _generation) return;

    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      log('Notification permissions denied');
      return;
    }

    // Get FCM token and register with backend
    await _registerToken(generation);
    if (generation != _generation) return;

    // Listen for token refresh
    _subscriptions.add(
      _messaging.onTokenRefresh.listen((newToken) async {
        if (generation == _generation) {
          await _registerTokenWithBackend(newToken, generation);
        }
      }),
    );

    // Handle foreground messages
    _subscriptions.add(
      (_foregroundMessages ?? FirebaseMessaging.onMessage).listen((message) {
        if (generation == _generation) _handleForegroundMessage(message);
      }),
    );

    // Handle notification taps when app is in background/terminated
    _subscriptions.add(
      (_openedMessages ?? FirebaseMessaging.onMessageOpenedApp).listen((
        message,
      ) {
        if (generation == _generation) _handleNotificationTap(message);
      }),
    );

    // Check if app was opened from a terminated state via notification
    final initialMessage = await _messaging.getInitialMessage();
    if (generation == _generation && initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  /// Register the current FCM token with the backend.
  Future<void> _registerToken(int generation) async {
    try {
      final token = await _messaging.getToken();
      if (token != null && generation == _generation) {
        await _registerTokenWithBackend(token, generation);
      }
    } catch (e) {
      log('Failed to get FCM token: $e');
    }
  }

  /// Send FCM token to the backend API.
  Future<void> _registerTokenWithBackend(String token, int generation) async {
    try {
      await _ownerApiService.registerFcmToken(fcmToken: token);
      if (generation == _generation) _currentToken = token;
      log('FCM token registered with backend');
    } catch (e) {
      log('Failed to register FCM token with backend: $e');
    }
  }

  /// Unregister the FCM token from the backend. Call on logout.
  Future<void> unregister() async {
    stop();
    try {
      await _ownerApiService.unregisterFcmToken();
      _currentToken = null;
      log('FCM token unregistered from backend');
    } catch (e) {
      log('Failed to unregister FCM token: $e');
    }
  }

  void stop() {
    _generation++;
    _initialization = null;
    _currentToken = null;
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    _subscriptions.clear();
  }

  /// Handle a foreground message — show a local notification-style alert.
  void _handleForegroundMessage(RemoteMessage message) {
    if (message.data['type'] == 'waiter_call') {
      onWaiterCall?.call();
      return;
    }
    final tableName = message.data['tableName'] ?? 'Unknown Table';
    final orderTotal = message.data['orderTotal'] ?? '0.00';

    log('Foreground notification: New order from $tableName — ₹$orderTotal');

    // Notify listeners that a new order notification arrived.
    // The UI layer can show a snackbar or in-app alert.
    onForegroundNotification?.call(tableName, orderTotal);
  }

  /// Callback for foreground notifications to show in-app UI.
  void Function(String tableName, String orderTotal)? onForegroundNotification;
  VoidCallback? onWaiterCall;

  /// Handle notification tap — navigate to orders screen.
  void _handleNotificationTap(RemoteMessage message) {
    if (message.data['type'] == 'waiter_call') onWaiterCall?.call();
    log('Notification tapped: ${message.data}');
    onNotificationTap?.call();
  }

  /// Current registered token (for debugging/testing).
  String? get currentToken => _currentToken;
}
