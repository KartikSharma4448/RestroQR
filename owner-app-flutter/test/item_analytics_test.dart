import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/screens/item_analytics_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';

class AnalyticsApi extends ApiService {
  final requests = <Map<String, dynamic>>[];
  final pending = <Completer<Response>>[];
  @override
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    expect(path, '/owner/analytics/items');
    requests.add(Map<String, dynamic>.from(queryParameters!));
    final completer = Completer<Response>();
    pending.add(completer);
    return completer.future;
  }
  void complete(int index, String name) {
    pending[index].complete(Response(requestOptions: RequestOptions(path: '/owner/analytics/items'), data: {
      'data': {'items': [{'itemName': name, 'totalQuantity': 2, 'totalRevenue': '200.00'}]},
    }));
  }
}

Future<void> mount(WidgetTester tester, AnalyticsApi api) async {
  await tester.pumpWidget(Provider<ApiService>.value(value: api, child: const MaterialApp(home: ItemAnalyticsScreen())));
}

void main() {
  testWidgets('period buttons send distinct calendar ranges', (tester) async {
    final api = AnalyticsApi();
    final now = DateTime.now();
    await mount(tester, api);
    expect(api.requests[0]['startDate'], DateTime(now.year, now.month).toUtc().toIso8601String());
    expect(api.requests[0]['endDate'], DateTime(now.year, now.month + 1).toUtc().toIso8601String());
    api.complete(0, 'MONTH');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Day'));
    await tester.pump();
    expect(api.requests[1]['period'], 'daily');
    expect(api.requests[1]['startDate'], DateTime(now.year, now.month, now.day).toUtc().toIso8601String());
    expect(api.requests[1]['endDate'], DateTime(now.year, now.month, now.day + 1).toUtc().toIso8601String());
    api.complete(1, 'DAY');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Week'));
    await tester.pump();
    final monday = DateTime(now.year, now.month, now.day - (now.weekday - 1));
    expect(api.requests[2]['startDate'], monday.toUtc().toIso8601String());
    expect(api.requests[2]['endDate'], DateTime(monday.year, monday.month, monday.day + 7).toUtc().toIso8601String());
    api.complete(2, 'WEEK');
    await tester.pumpAndSettle();
    expect(find.text('WEEK'), findsOneWidget);
    expect(find.text('DAY'), findsNothing);
  });

  testWidgets('new period results win over a stale request', (tester) async {
    final api = AnalyticsApi();
    await mount(tester, api);
    await tester.tap(find.text('Day'));
    await tester.pump();
    api.complete(1, 'CURRENT');
    await tester.pumpAndSettle();
    api.complete(0, 'STALE');
    await tester.pumpAndSettle();
    expect(find.text('CURRENT'), findsOneWidget);
    expect(find.text('STALE'), findsNothing);
  });

  testWidgets('a failed filter hides stale analytics and supports retry', (tester) async {
    final api = AnalyticsApi();
    await mount(tester, api);
    api.complete(0, 'MONTH');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Day'));
    await tester.pump();
    api.pending[1].completeError(Exception('failed'));
    await tester.pumpAndSettle();
    expect(find.text('MONTH'), findsNothing);
    expect(find.text('Failed to load item analytics.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    expect(api.requests[2], api.requests[1]);
    api.complete(2, 'RETRIED');
    await tester.pumpAndSettle();
    expect(find.text('RETRIED'), findsOneWidget);
  });

  testWidgets('leaving analytics safely ignores pending results', (tester) async {
    final api = AnalyticsApi();
    await mount(tester, api);
    await tester.pumpWidget(const MaterialApp(home: SizedBox()));
    api.complete(0, 'OLD');
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
