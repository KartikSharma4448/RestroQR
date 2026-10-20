import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/ui/waiter_alarm_host.dart';

class WaiterApi extends ApiService {
  String status = 'pending';
  bool fail = false;
  bool failClose = false;
  final updates = <String>[];
  Map<String, dynamic> get call => {
    'id': 'call-1',
    'tableName': 'Table 01',
    'status': status,
  };
  @override
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    if (fail) throw Exception('offline');
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {
        'data': {
          'calls': status == 'resolved' ? [] : [call],
        },
      },
    );
  }

  @override
  Future<Response> patch(String path, {dynamic data}) async {
    if (failClose) throw Exception('offline');
    status = data['status'];
    updates.add(status);
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {
        'data': {'call': call},
      },
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const sound = MethodChannel('restroqr/waiter_alarm');
  final audio = <String>[];
  setUp(() {
    audio.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(sound, (call) async {
          audio.add(call.method);
          return null;
        });
  });
  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(sound, null),
  );
  Widget host(WaiterApi api, {bool enabled = true}) => MaterialApp(
    home: WaiterAlarmHost(
      api: api,
      enabled: enabled,
      child: const Scaffold(body: Text('Dashboard')),
    ),
  );
  testWidgets(
    'full-screen waiter bell stays active until one OK closes the request',
    (tester) async {
      final api = WaiterApi();
      await tester.pumpWidget(host(api));
      await tester.pumpAndSettle();
      expect(find.text('Waiter requested'), findsOneWidget);
      expect(find.text('Table 01'), findsOneWidget);
      expect(find.text('Acknowledge'), findsNothing);
      expect(find.text('Resolve'), findsNothing);
      expect(audio.where((action) => action == 'start'), hasLength(1));
      await tester.pump(const Duration(seconds: 11));
      await tester.pumpAndSettle();
      expect(audio.where((action) => action == 'start'), hasLength(1));
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(api.updates, ['resolved']);
      expect(find.text('Waiter requested'), findsNothing);
      expect(audio.last, 'stop');
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'OK silences immediately on network failure and retries without ringing again',
    (tester) async {
      final api = WaiterApi()..failClose = true;
      await tester.pumpWidget(host(api));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(audio.last, 'stop');
      expect(find.textContaining('Could not close'), findsOneWidget);
      await tester.pump(const Duration(seconds: 11));
      await tester.pumpAndSettle();
      expect(audio.where((action) => action == 'start'), hasLength(1));
      api.failClose = false;
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(find.text('Waiter requested'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('bell pauses in background and stops when owner logs out', (
    tester,
  ) async {
    final api = WaiterApi();
    await tester.pumpWidget(host(api));
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(audio.last, 'stop');
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(audio.last, 'start');
    await tester.pumpWidget(host(api, enabled: false));
    await tester.pumpAndSettle();
    expect(find.text('Waiter requested'), findsNothing);
    expect(audio.last, 'stop');
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'alert fits a small phone and is recovered after a network outage',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = WaiterApi()..fail = true;
      await tester.pumpWidget(host(api));
      await tester.pumpAndSettle();
      expect(find.text('Waiter requested'), findsNothing);
      api.fail = false;
      await tester.pump(const Duration(seconds: 11));
      await tester.pumpAndSettle();
      expect(find.text('Table 01'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
