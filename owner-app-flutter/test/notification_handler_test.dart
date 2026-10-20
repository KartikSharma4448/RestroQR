import 'dart:async';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/services/notification_handler.dart';
import 'package:restroqr_owner/services/owner_api_service.dart';

class UnavailableMessaging implements FirebaseMessaging {
  int attempts = 0;
  @override
  dynamic noSuchMethod(Invocation invocation) {
    if (invocation.memberName == #requestPermission) {
      attempts++;
      return Future<NotificationSettings>.error(
        StateError('Firebase unavailable'),
      );
    }
    return super.noSuchMethod(invocation);
  }
}

class AllowedSettings implements NotificationSettings {
  @override
  AuthorizationStatus get authorizationStatus => AuthorizationStatus.authorized;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class AvailableMessaging implements FirebaseMessaging {
  int attempts = 0;
  @override
  dynamic noSuchMethod(Invocation invocation) {
    switch (invocation.memberName) {
      case #requestPermission:
        attempts++;
        return Future<NotificationSettings>.value(AllowedSettings());
      case #getToken:
        return Future<String?>.value(null);
      case #onTokenRefresh:
        return const Stream<String>.empty();
      case #getInitialMessage:
        return Future<RemoteMessage?>.value(null);
    }
    return super.noSuchMethod(invocation);
  }
}

void main() {
  test(
    'waiter foreground alerts do not become fake zero-price order notifications',
    () async {
      final stream = StreamController<RemoteMessage>.broadcast();
      final handler = NotificationHandler(
        ownerApiService: OwnerApiService(ApiService()),
        messaging: AvailableMessaging(),
        foregroundMessages: stream.stream,
        openedMessages: const Stream.empty(),
      );
      var waiterAlerts = 0;
      var orderAlerts = 0;
      handler.onWaiterCall = () => waiterAlerts++;
      handler.onForegroundNotification = (_, _) => orderAlerts++;
      await handler.initialize();
      stream.add(
        const RemoteMessage(
          data: {
            'type': 'waiter_call',
            'tableName': 'Table 01',
            'callId': 'call-1',
          },
        ),
      );
      await Future<void>.delayed(Duration.zero);
      expect(waiterAlerts, 1);
      expect(orderAlerts, 0);
      handler.stop();
      await stream.close();
    },
  );
  test('A16 foreground listeners initialize once and stop on logout', () async {
    final stream = StreamController<RemoteMessage>.broadcast();
    final messaging = AvailableMessaging();
    final handler = NotificationHandler(
      ownerApiService: OwnerApiService(ApiService()),
      messaging: messaging,
      foregroundMessages: stream.stream,
      openedMessages: const Stream.empty(),
    );
    final alerts = <String>[];
    handler.onForegroundNotification = (table, total) =>
        alerts.add('$table:$total');
    await Future.wait([handler.initialize(), handler.initialize()]);
    expect(messaging.attempts, 1);
    stream.add(
      const RemoteMessage(
        data: {'tableName': 'Table 4', 'orderTotal': '20.00'},
      ),
    );
    await Future<void>.delayed(Duration.zero);
    expect(alerts, ['Table 4:20.00']);
    handler.stop();
    stream.add(const RemoteMessage(data: {'tableName': 'OLD'}));
    await Future<void>.delayed(Duration.zero);
    expect(alerts.length, 1);
    await handler.initialize();
    expect(messaging.attempts, 2);
    handler.stop();
    await stream.close();
  });
  test(
    'A09 asynchronous Firebase failure is contained and can retry',
    () async {
      final messaging = UnavailableMessaging();
      final handler = NotificationHandler(
        ownerApiService: OwnerApiService(ApiService()),
        messaging: messaging,
      );
      await expectLater(handler.initialize(), completes);
      await expectLater(handler.initialize(), completes);
      expect(messaging.attempts, 2);
      expect(handler.currentToken, isNull);
    },
  );
}
