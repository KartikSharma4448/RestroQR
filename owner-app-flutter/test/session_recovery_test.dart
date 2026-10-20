import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/services/auth_service.dart';

String sessionToken(int expiry) =>
    'header.${base64Url.encode(utf8.encode(jsonEncode({'sub': 'owner-id', 'role': 'owner', 'exp': expiry})))}.signature';

class MemoryApi extends ApiService {
  String? token;
  int clears = 0;
  MemoryApi({super.dio});
  @override
  Future<String?> getToken() async => token;
  @override
  Future<void> setToken(String value) async {
    token = value;
  }

  @override
  Future<void> clearToken() async {
    token = null;
    clears++;
  }
}

class UnauthorizedAdapter implements HttpClientAdapter {
  final int status;
  final void Function()? beforeResponse;
  UnauthorizedAdapter(this.status, {this.beforeResponse});
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    beforeResponse?.call();
    return ResponseBody.fromString(
      '{}',
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  for (final token in ['invalid', sessionToken(1)]) {
    test('A07 malformed or expired token is cleared', () async {
      final api = MemoryApi()..token = token;
      final auth = AuthService(api);
      await auth.checkAuthStatus();
      expect(auth.isAuthenticated, isFalse);
      expect(api.token, isNull);
      auth.dispose();
    });
  }
  for (final status in [401, 403, 500]) {
    test(
      'A07 only protected API 401 resets the current session ($status)',
      () async {
        final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
        dio.httpClientAdapter = UnauthorizedAdapter(status);
        final api = MemoryApi(dio: dio)..token = sessionToken(4102444800);
        final auth = AuthService(api);
        await auth.checkAuthStatus();
        await expectLater(
          api.get('/owner/restaurant'),
          throwsA(isA<DioException>()),
        );
        expect(auth.isAuthenticated, status != 401);
        expect(api.clears, status == 401 ? 1 : 0);
        auth.dispose();
      },
    );
  }
  test('A07 stale 401 does not clear a newer login', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    final api = MemoryApi(dio: dio)..token = sessionToken(4102444800);
    dio.httpClientAdapter = UnauthorizedAdapter(
      401,
      beforeResponse: () => api.token = sessionToken(4102444801),
    );
    await expectLater(
      api.get('/owner/restaurant'),
      throwsA(isA<DioException>()),
    );
    expect(api.clears, 0);
  });
}
