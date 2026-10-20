import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/screens/order_history_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/services/owner_api_service.dart';

class HistoryApi extends ApiService {
  final requests = <Map<String, dynamic>>[];
  final pending = <Completer<Response>>[];

  @override
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    expect(path, '/owner/earnings/history');
    requests.add(Map<String, dynamic>.from(queryParameters ?? {}));
    final completer = Completer<Response>();
    pending.add(completer);
    return completer.future;
  }

  void complete(
    int index, {
    int count = 1,
    int total = 1,
    String ref = 'ORDER',
    int page = 1,
  }) {
    pending[index].complete(
      Response(
        requestOptions: RequestOptions(path: '/owner/earnings/history'),
        data: {
          'success': true,
          'data': {
            'orders': List.generate(
              count,
              (i) => {
                'id': '$ref-$i',
                'orderRef': '$ref-$i',
                'status': 'pending',
                'total': '100.00',
                'tableDisplayName': 'Table 1',
                'createdAt': '2026-10-01T00:00:00Z',
              },
            ),
            'total': total,
            'page': page,
            'pageSize': 20,
          },
        },
      ),
    );
  }
}

Future<void> mount(WidgetTester tester, HistoryApi api) async {
  await tester.pumpWidget(
    Provider<ApiService>.value(
      value: api,
      child: const MaterialApp(home: OrderHistoryScreen()),
    ),
  );
}

void main() {
  test('API sends UTC start and exclusive end bounds', () async {
    final api = HistoryApi();
    final start = DateTime(2026, 10, 1);
    final end = DateTime(2026, 10, 3);
    final result = OwnerApiService(
      api,
    ).getHistory(startDate: start, endDate: end, status: 'completed');
    expect(api.requests.single, {
      'page': 1,
      'pageSize': 20,
      'status': 'completed',
      'startDate': start.toUtc().toIso8601String(),
      'endDate': end.toUtc().toIso8601String(),
    });
    api.complete(0);
    await result;
  });

  testWidgets('last page has no load-more request', (tester) async {
    final api = HistoryApi();
    await mount(tester, api);
    api.complete(0);
    await tester.pumpAndSettle();
    expect(find.text('ORDER-0'), findsOneWidget);
    expect(find.text('Load more'), findsNothing);
    expect(api.requests, hasLength(1));
  });

  testWidgets('date picker sends full-day bounds and clearing resets them', (
    tester,
  ) async {
    final api = HistoryApi();
    await mount(tester, api);
    api.complete(0);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Select Date Range'));
    await tester.pumpAndSettle();
    final now = DateTime.now();
    final day = find.text('${now.day}').last;
    await tester.ensureVisible(day);
    await tester.tap(day);
    await tester.pump();
    await tester.tap(day);
    await tester.pump();
    await tester.tap(find.text('Save'));
    await tester.pump();
    expect(
      api.requests.last['startDate'],
      DateTime(now.year, now.month, now.day).toUtc().toIso8601String(),
    );
    expect(
      api.requests.last['endDate'],
      DateTime(now.year, now.month, now.day + 1).toUtc().toIso8601String(),
    );
    api.complete(1, count: 0, total: 0);
    await tester.pumpAndSettle();
    expect(find.text('No orders found'), findsOneWidget);
    await tester.tap(find.byTooltip('Clear date filter'));
    await tester.pump();
    expect(api.requests.last.containsKey('startDate'), false);
    expect(api.requests.last.containsKey('endDate'), false);
    api.complete(2);
    await tester.pumpAndSettle();
  });

  testWidgets('empty next page stops pagination even with a stale total', (
    tester,
  ) async {
    final api = HistoryApi();
    await mount(tester, api);
    api.complete(0, total: 40);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Load more'));
    await tester.pump();
    expect(api.requests.last['page'], 2);
    api.complete(1, count: 0, total: 40, page: 2);
    await tester.pumpAndSettle();
    expect(find.text('Load more'), findsNothing);
    expect(find.text('ORDER-0'), findsOneWidget);
  });

  testWidgets('load-more errors retain orders and retry the same page', (
    tester,
  ) async {
    final api = HistoryApi();
    await mount(tester, api);
    api.complete(0, total: 40);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Load more'));
    await tester.pump();
    api.pending[1].completeError(Exception('Network error'));
    await tester.pumpAndSettle();
    expect(find.text('ORDER-0'), findsOneWidget);
    await tester.tap(find.text('Retry loading more'));
    await tester.pump();
    expect(api.requests.last['page'], 2);
    api.complete(2, page: 2, total: 21, ref: 'NEXT');
    await tester.pumpAndSettle();
    expect(find.text('NEXT-0'), findsOneWidget);
  });

  testWidgets('filter changes ignore an older pending response', (
    tester,
  ) async {
    final api = HistoryApi();
    await mount(tester, api);
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Accepted').last);
    await tester.pump();
    expect(api.requests.last['status'], 'accepted');
    api.complete(1, ref: 'FILTERED');
    await tester.pumpAndSettle();
    api.complete(0, ref: 'STALE');
    await tester.pumpAndSettle();
    expect(find.text('FILTERED-0'), findsOneWidget);
    expect(find.text('STALE-0'), findsNothing);
  });

  testWidgets(
    'a response after leaving the screen does not update disposed state',
    (tester) async {
      final api = HistoryApi();
      await mount(tester, api);
      await tester.pumpWidget(const MaterialApp(home: SizedBox()));
      api.complete(0);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
}
