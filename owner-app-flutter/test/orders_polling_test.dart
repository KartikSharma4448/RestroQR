import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/screens/orders_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';

class OrdersPollingApi extends ApiService {
  final requests = <Map<String, dynamic>>[];
  final pending = <Completer<Response>>[];

  @override
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    expect(path, '/owner/orders');
    requests.add(Map<String, dynamic>.from(queryParameters!));
    final request = Completer<Response>();
    pending.add(request);
    return request.future;
  }

  void completeBatch(int batch, String ref, {Object? error}) {
    for (var offset = 0; offset < 4; offset++) {
      final index = batch * 4 + offset;
      if (offset == 0 && error != null) {
        pending[index].completeError(error);
      } else {
        pending[index].complete(Response(
          requestOptions: RequestOptions(path: '/owner/orders'),
          data: {
            'data': {
              'orders': offset == 0 ? [{
                'id': ref, 'orderRef': ref, 'status': 'pending',
                'total': '10.00', 'tableDisplayName': 'Table 1',
                'createdAt': '2026-10-11T10:00:00Z', 'items': [],
              }] : [],
              'total': offset == 0 ? 1 : 0, 'page': 1, 'pageSize': 20,
            },
          },
        ));
      }
    }
  }
}

Future<void> mount(WidgetTester tester, OrdersPollingApi api) async {
  await tester.pumpWidget(Provider<ApiService>.value(
    value: api, child: const MaterialApp(home: OrdersScreen()),
  ));
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
  });
}

void main() {
  testWidgets('new polling result wins over a slower old result', (tester) async {
    final api = OrdersPollingApi();
    await mount(tester, api);
    expect(api.requests.map((request) => request['status']),
        ['pending', 'accepted', 'completed', 'payment_received']);
    await tester.pump(const Duration(seconds: 10));
    expect(api.pending.length, 8);
    api.completeBatch(1, 'CURRENT');
    await tester.pumpAndSettle();
    expect(find.text('CURRENT'), findsOneWidget);
    api.completeBatch(0, 'STALE');
    await tester.pumpAndSettle();
    expect(find.text('CURRENT'), findsOneWidget);
    expect(find.text('STALE'), findsNothing);
  });

  for (final dioError in [true, false]) {
    testWidgets('stale ${dioError ? 'network' : 'generic'} failure keeps current orders', (tester) async {
      final api = OrdersPollingApi();
      await mount(tester, api);
      await tester.pump(const Duration(seconds: 10));
      api.completeBatch(1, 'CURRENT');
      await tester.pumpAndSettle();
      api.completeBatch(0, 'OLD', error: dioError
          ? DioException(requestOptions: RequestOptions(path: '/owner/orders'), type: DioExceptionType.connectionError)
          : Exception('failed'));
      await tester.pumpAndSettle();
      expect(find.text('CURRENT'), findsOneWidget);
      expect(find.text('Retry'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('latest failure still shows retry and retry recovers', (tester) async {
    final api = OrdersPollingApi();
    await mount(tester, api);
    api.completeBatch(0, 'OLD', error: Exception('failed'));
    await tester.pumpAndSettle();
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    api.completeBatch(1, 'RETRIED');
    await tester.pumpAndSettle();
    expect(find.text('RETRIED'), findsOneWidget);
    expect(find.text('Retry'), findsNothing);
  });

  testWidgets('leaving the orders panel cancels polling and ignores pending results', (tester) async {
    final api = OrdersPollingApi();
    await mount(tester, api);
    await tester.pumpWidget(const SizedBox());
    api.completeBatch(0, 'OLD');
    await tester.pump(const Duration(seconds: 20));
    expect(api.pending.length, 4);
    expect(tester.takeException(), isNull);
  });
}
