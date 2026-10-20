import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/models/auth_models.dart';
import 'package:restroqr_owner/services/auth_service.dart';
import 'package:restroqr_owner/services/notification_handler.dart';
import 'package:restroqr_owner/services/owner_api_service.dart';
import 'session_recovery_test.dart' show MemoryApi, sessionToken;

class LoginApi extends MemoryApi {
  @override
  Future<Response> post(String path, {dynamic data}) async => Response(
    requestOptions: RequestOptions(path: path),
    data: {
      'success': true,
      'data': {
        'token': sessionToken(4102444800),
        'user': {'id': 'owner', 'name': 'Owner', 'role': 'owner'},
        'owner': {'id': 'owner', 'name': 'Owner'},
      },
    },
  );
}

class CountingNotifications extends NotificationHandler {
  int starts = 0;
  int stops = 0;
  CountingNotifications(LoginApi api)
    : super(ownerApiService: OwnerApiService(api));
  @override
  Future<void> initialize() async {
    starts++;
  }

  @override
  Future<void> unregister() async {
    stops++;
  }
}

void main() {
  test('A07/A08 expiry resets notification setup for the next login', () async {
    final api = LoginApi()..token = sessionToken(4102444800);
    final notifications = CountingNotifications(api);
    final auth = AuthService(api)..notificationHandler = notifications;
    await auth.checkAuthStatus();
    expect(notifications.starts, 1);
    api.token = sessionToken(1);
    await auth.checkAuthStatus();
    expect(auth.isAuthenticated, isFalse);
    await auth.login(
      LoginRequest(email: 'owner@example.test', password: 'password123'),
    );
    expect(notifications.starts, 2);
    auth.dispose();
  });
  for (final action in ['login', 'register', 'restore']) {
    test(
      'A08 $action starts notifications once per authenticated session',
      () async {
        final api = LoginApi();
        final notifications = CountingNotifications(api);
        final auth = AuthService(api)..notificationHandler = notifications;
        if (action == 'login') {
          expect(
            await auth.login(
              LoginRequest(
                email: 'owner@example.test',
                password: 'password123',
              ),
            ),
            isTrue,
          );
        } else if (action == 'register') {
          expect(
            await auth.register(
              RegisterRequest(
                name: 'Owner',
                email: 'owner@example.test',
                password: 'password123',
              ),
            ),
            isTrue,
          );
        } else {
          api.token = sessionToken(4102444800);
        }
        await auth.checkAuthStatus();
        await auth.checkAuthStatus();
        expect(notifications.starts, 1);
        await auth.logout();
        expect(notifications.stops, 1);
        await auth.login(
          LoginRequest(email: 'owner@example.test', password: 'password123'),
        );
        expect(notifications.starts, 2);
        auth.dispose();
      },
    );
  }
}
