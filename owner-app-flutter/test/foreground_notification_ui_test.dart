import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/main.dart';
import 'package:restroqr_owner/services/notification_handler.dart';
import 'package:restroqr_owner/services/owner_api_service.dart';
import 'session_recovery_test.dart' show MemoryApi, sessionToken;

class NotificationUiApi extends MemoryApi {
  @override
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async => Response(
    requestOptions: RequestOptions(path: path),
    data: {
      'success': true,
      'data': {
        'restaurant': {
          'id': 'r1',
          'name': 'Cafe',
          'address': 'Street',
          'phone': '9999999999',
        },
        'orders': [],
        'total': 0,
        'page': 1,
        'pageSize': 20,
      },
    },
  );
}

class UiNotifications extends NotificationHandler {
  UiNotifications(NotificationUiApi api)
    : super(ownerApiService: OwnerApiService(api));
  @override
  Future<void> initialize() async {}
}

void main() {
  testWidgets('A16 foreground order alert is displayed and View opens Orders', (
    tester,
  ) async {
    final api = NotificationUiApi()..token = sessionToken(4102444800);
    final handler = UiNotifications(api);
    await tester.pumpWidget(
      RestroQRApp(apiService: api, notificationHandler: handler),
    );
    await tester.pumpAndSettle();
    expect(handler.onForegroundNotification, isNotNull);
    handler.onForegroundNotification!('Table 4', '20.00');
    await tester.pumpAndSettle();
    expect(find.text('New order from Table 4 - 20.00'), findsOneWidget);
    await tester.tap(find.text('View'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(AppBar, 'Orders'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    expect(handler.onForegroundNotification, isNull);
  });
}
