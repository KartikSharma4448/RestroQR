import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/services/auth_service.dart';
import 'session_recovery_test.dart' show MemoryApi, sessionToken;

class GoogleApi extends MemoryApi {
  String? path;
  Object? body;
  bool reject = false;
  @override
  Future<Response<dynamic>> post(String endpoint, {dynamic data}) async {
    path = endpoint;
    body = data;
    if (reject) {
      throw DioException(requestOptions: RequestOptions(path: endpoint),
        response: Response(requestOptions: RequestOptions(path: endpoint),
          statusCode: 409, data: {'error': {'message': 'Email must match'}}));
    }
    return Response(requestOptions: RequestOptions(path: endpoint), data: {
      'success': true,
      'data': endpoint.endsWith('/link') ? {'googleLinked': true} : {
        'token': sessionToken(4102444800),
        'user': {'id': 'owner-id', 'name': 'Owner', 'role': 'owner'},
      },
    });
  }
}

void main() {
  test('Google login exchanges Firebase proof for backend session', () async {
    final api = GoogleApi();
    final auth = AuthService(api, googleTokenProvider: () async => 'firebase-proof');
    expect(await auth.signInWithGoogle(), isTrue);
    expect(api.path, '/auth/google/login');
    expect(api.body, {'idToken': 'firebase-proof'});
    expect(auth.isAuthenticated, isTrue);
    expect(api.token, isNot('firebase-proof'));
    auth.dispose();
  });
  test('Google cancellation does not send a backend request or show an error', () async {
    final api = GoogleApi();
    final auth = AuthService(api, googleTokenProvider: () async => null);
    expect(await auth.signInWithGoogle(), isFalse);
    expect(api.path, isNull);
    expect(auth.error, isNull);
    expect(auth.isLoading, isFalse);
    auth.dispose();
  });
  test('linking requires a signed-in owner and preserves session', () async {
    final api = GoogleApi();
    final auth = AuthService(api, googleTokenProvider: () async => 'proof');
    expect(await auth.signInWithGoogle(link: true), isFalse);
    api.token = sessionToken(4102444800);
    await auth.checkAuthStatus();
    final session = api.token;
    expect(await auth.signInWithGoogle(link: true), isTrue);
    expect(api.path, '/auth/google/link');
    expect(api.token, session);
    auth.dispose();
  });
  test('backend mismatch is displayed without losing owner login', () async {
    final api = GoogleApi()..token = sessionToken(4102444800);
    final auth = AuthService(api, googleTokenProvider: () async => 'proof');
    await auth.checkAuthStatus();
    api.reject = true;
    expect(await auth.signInWithGoogle(link: true), isFalse);
    expect(auth.error, 'Email must match');
    expect(auth.isAuthenticated, isTrue);
    auth.dispose();
  });
  test('a changed session cancels a pending Google linking request', () async {
    final proof = Completer<String?>();
    final api = GoogleApi()..token = sessionToken(4102444800);
    final auth = AuthService(api, googleTokenProvider: () => proof.future);
    await auth.checkAuthStatus();
    final pending = auth.signInWithGoogle(link: true);
    await Future<void>.delayed(Duration.zero);
    await auth.logout();
    proof.complete('proof');
    expect(await pending, isFalse);
    expect(api.path, isNull);
    expect(auth.isAuthenticated, isFalse);
    auth.dispose();
  });
}
