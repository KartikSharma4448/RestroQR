import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/models/auth_models.dart';
import 'package:restroqr_owner/screens/verify_email_screen.dart';
import 'package:restroqr_owner/screens/connect_google_screen.dart';
import 'package:restroqr_owner/services/auth_service.dart';
import 'package:restroqr_owner/ui/app_theme.dart';
import 'session_recovery_test.dart' show MemoryApi, sessionToken;

class SignupApi extends MemoryApi {
  final calls = <String>[];
  dynamic lastBody;
  bool rejectCode = false;
  @override
  Future<Response<dynamic>> post(String path, {dynamic data}) async {
    calls.add(path);
    lastBody = data;
    if (rejectCode && path.endsWith('/verify')) {
      throw DioException(
        requestOptions: RequestOptions(path: path),
        response: Response(
          requestOptions: RequestOptions(path: path),
          statusCode: 401,
          data: {
            'error': {'message': 'Invalid or expired verification code'},
          },
        ),
      );
    }
    return Response(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': path.endsWith('/verify')
            ? {
                'token': sessionToken(4102444800),
                'owner': {
                  'id': 'owner-id',
                  'name': 'Kartik',
                  'email': 'owner@example.test',
                },
                'googleConnectionRequired': true,
              }
            : path.endsWith('/link')
            ? {'googleLinked': true}
            : {
                'verificationRequired': true,
                'challengeId': 'challenge-id',
                'resendAfterSeconds': 60,
              },
      },
    );
  }
}

RegisterRequest signup() => RegisterRequest(
  name: 'Kartik',
  email: 'owner@example.test',
  password: 'password123',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final fonts = FontLoader('Roboto');
    for (final name in ['regular', 'medium', 'bold']) {
      fonts.addFont(rootBundle.load('assets/fonts/roboto-$name.ttf'));
    }
    await fonts.load();
    final icons = FontLoader('MaterialIcons');
    icons.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  test('signup stays unauthenticated until email verification', () async {
    final api = SignupApi();
    final auth = AuthService(api);
    expect(await auth.register(signup()), isTrue);
    expect(auth.hasPendingSignup, isTrue);
    expect(auth.isAuthenticated, isFalse);
    expect(api.token, isNull);
    auth.dispose();
  });
  test('verified email session requires matching Google connection', () async {
    final api = SignupApi();
    final auth = AuthService(
      api,
      googleTokenProvider: () async => 'google-proof',
    );
    await auth.register(signup());
    expect(await auth.verifySignupCode('123456'), isTrue);
    expect(auth.googleConnectionRequired, isTrue);
    expect(auth.hasPendingSignup, isFalse);
    expect(auth.isAuthenticated, isTrue);
    expect(await auth.signInWithGoogle(link: true), isTrue);
    expect(auth.googleConnectionRequired, isFalse);
    auth.dispose();
  });
  test(
    'resend uses pending challenge, not a password stored on the screen',
    () async {
      final api = SignupApi();
      final auth = AuthService(api);
      await auth.register(signup());
      expect(await auth.resendSignupCode(), isTrue);
      expect(api.calls.last, '/auth/register/resend');
      expect(api.lastBody, {'challengeId': 'challenge-id'});
      auth.dispose();
    },
  );
  test('a rejected code does not create a session', () async {
    final api = SignupApi()..rejectCode = true;
    final auth = AuthService(api);
    await auth.register(signup());
    expect(await auth.verifySignupCode('000000'), isFalse);
    expect(auth.error, 'Invalid or expired verification code');
    expect(auth.hasPendingSignup, isTrue);
    expect(auth.isAuthenticated, isFalse);
    expect(api.token, isNull);
    auth.dispose();
  });

  for (final connect in [false, true]) {
    testWidgets(
      '${connect ? 'Google connection' : 'Email verification'} fits enlarged small-phone text',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final auth = AuthService(SignupApi());
        await tester.pumpWidget(
          ChangeNotifierProvider.value(
            value: auth,
            child: MaterialApp(
              theme: ownerTheme(),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: const TextScaler.linear(1.5)),
                child: child!,
              ),
              home: connect
                  ? const ConnectGoogleScreen()
                  : const VerifyEmailScreen(),
            ),
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        auth.dispose();
      },
    );
    testWidgets(
      '${connect ? 'Google connection' : 'Email verification'} mobile layout',
      (tester) async {
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final auth = AuthService(SignupApi());
        await tester.pumpWidget(
          ChangeNotifierProvider.value(
            value: auth,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: ownerTheme(),
              home: connect
                  ? const ConnectGoogleScreen()
                  : const VerifyEmailScreen(),
            ),
          ),
        );
        await tester.runAsync(
          () => precacheImage(
            const AssetImage('assets/brand-mark.png'),
            tester.element(find.byType(MaterialApp)),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        if (!connect) {
          expect(find.text('Resend in 60s'), findsOneWidget);
          await tester.tap(find.widgetWithText(FilledButton, 'Verify email'));
          await tester.pump(const Duration(milliseconds: 300));
          await tester.pumpAndSettle();
          expect(find.text('Enter the six-digit code'), findsOneWidget);
        }
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile(
            'goldens/${connect ? 'connect_google' : 'verify_email'}.png',
          ),
        );
        await tester.pumpWidget(const SizedBox());
        auth.dispose();
      },
    );
  }
}
