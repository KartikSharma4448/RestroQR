import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/screens/profile_setup_screen.dart';
import 'package:restroqr_owner/screens/orders_screen.dart';
import 'package:restroqr_owner/screens/earnings_screen.dart';
import 'package:restroqr_owner/screens/tables_screen.dart';
import 'package:restroqr_owner/screens/categories_screen.dart';
import 'package:restroqr_owner/screens/food_items_screen.dart';
import 'package:restroqr_owner/screens/qr_mode_settings_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';

class ControlledApi extends ApiService {
  final requests = <String>[];
  final queries = <Map<String, dynamic>>[];
  final pending = <Completer<Response>>[];
  @override
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) {
    requests.add(path);
    queries.add(queryParameters ?? {});
    final request = Completer<Response>();
    pending.add(request);
    return request.future;
  }

  void complete(int index, Object data) => pending[index].complete(
    Response(
      requestOptions: RequestOptions(path: requests[index]),
      data: {'success': true, 'data': data},
    ),
  );
}

Future<void> mountScreen(
  WidgetTester tester,
  ControlledApi api,
  Widget screen,
) async {
  await tester.pumpWidget(
    Provider<ApiService>.value(
      value: api,
      child: MaterialApp(home: screen),
    ),
  );
  addTearDown(() async => tester.pumpWidget(const SizedBox()));
}

void main() {
  testWidgets('A05 failed earnings filter hides old rows and Retry recovers', (
    tester,
  ) async {
    final api = ControlledApi();
    await mountScreen(tester, api, const EarningsScreen());
    api.complete(0, {'totalRevenue': '10.00', 'totalOrders': 1});
    api.complete(1, {
      'breakdown': [
        {'date': 'OLD-DAY', 'totalRevenue': '10.00', 'totalOrders': 1},
      ],
    });
    await tester.pumpAndSettle();
    await tester.tap(find.text('Week'));
    await tester.pump();
    api.pending[2].completeError(Exception('failed'));
    await tester.pumpAndSettle();
    expect(find.text('OLD-DAY'), findsNothing);
    expect(find.text('Failed to load earnings breakdown.'), findsOneWidget);
    expect(find.text('1 paid orders'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pump();
    expect(api.queries[3]['period'], 'weekly');
    api.complete(3, {
      'breakdown': [
        {'date': 'CURRENT-WEEK', 'totalRevenue': '20.00', 'totalOrders': 2},
      ],
    });
    await tester.pumpAndSettle();
    expect(find.text('CURRENT-WEEK'), findsOneWidget);
    expect(find.text('Retry'), findsNothing);
  });
  for (final staleFailure in [false, true]) {
    testWidgets(
      'A04 current Week survives stale Day ${staleFailure ? 'failure' : 'success'}',
      (tester) async {
        final api = ControlledApi();
        await mountScreen(tester, api, const EarningsScreen());
        api.complete(0, {'totalRevenue': '10.00', 'totalOrders': 1});
        await tester.pump();
        await tester.tap(find.text('Week'));
        await tester.pump();
        api.complete(2, {
          'breakdown': [
            {'date': 'CURRENT-WEEK', 'totalRevenue': '20.00', 'totalOrders': 2},
          ],
        });
        await tester.pumpAndSettle();
        if (staleFailure) {
          api.pending[1].completeError(Exception('old failure'));
        } else {
          api.complete(1, {
            'breakdown': [
              {'date': 'STALE-DAY', 'totalRevenue': '10.00', 'totalOrders': 1},
            ],
          });
        }
        await tester.pumpAndSettle();
        expect(find.text('CURRENT-WEEK'), findsOneWidget);
        expect(find.text('STALE-DAY'), findsNothing);
        expect(find.text('Retry'), findsNothing);
      },
    );
  }
  final screens = <String, Widget>{
    'earnings': const EarningsScreen(),
    'tables': const TablesScreen(),
    'categories': const CategoriesScreen(),
    'dishes': const FoodItemsScreen(categoryId: 'sample'),
    'QR settings': const QrModeSettingsScreen(),
  };
  for (final entry in screens.entries) {
    for (final result in ['success', 'network', 'generic']) {
      testWidgets('A03 ${entry.key} ignores late $result after disposal', (
        tester,
      ) async {
        final api = ControlledApi();
        await mountScreen(tester, api, entry.value);
        await tester.pumpWidget(const SizedBox());
        for (var i = 0; i < api.pending.length; i++) {
          if (result == 'success') {
            api.complete(i, {
              'restaurant': {},
              'tables': [],
              'items': [],
              'categories': [],
              'breakdown': [],
              'totalRevenue': '0',
              'totalOrders': 0,
            });
          } else {
            api.pending[i].completeError(
              result == 'network'
                  ? DioException(
                      requestOptions: RequestOptions(path: api.requests[i]),
                    )
                  : Exception('failed'),
            );
          }
        }
        await tester.pump();
        expect(tester.takeException(), isNull);
      });
    }
  }
  testWidgets('A02 orders show server totals and can open the second page', (
    tester,
  ) async {
    final api = ControlledApi();
    await mountScreen(tester, api, const OrdersScreen());
    void completeBatch(int start, int page) {
      for (var i = 0; i < 4; i++) {
        api.complete(start + i, {
          'orders': i == 0
              ? [
                  {
                    'id': 'page-$page',
                    'orderRef': 'PAGE-$page',
                    'status': 'pending',
                    'total': '10.00',
                    'createdAt': '2026-10-11T10:00:00Z',
                    'tableDisplayName': 'Table 1',
                    'items': [],
                  },
                ]
              : [],
          'total': i == 0 ? 25 : 0,
          'page': i == 0 ? page : 1,
          'pageSize': 20,
        });
      }
    }

    completeBatch(0, 1);
    await tester.pumpAndSettle();
    expect(find.text('Pending (25)'), findsOneWidget);
    await tester.tap(find.byTooltip('Next page'));
    await tester.pump();
    expect(api.queries[4]['page'], 2);
    completeBatch(4, 2);
    await tester.pumpAndSettle();
    expect(find.text('PAGE-2'), findsOneWidget);
    expect(find.text('Page 2 of 2'), findsOneWidget);
    expect(find.text('Pending (25)'), findsOneWidget);
    await tester.tap(find.byTooltip('Previous page'));
    await tester.pump();
    expect(api.queries[8]['page'], 1);
    completeBatch(8, 1);
    await tester.pumpAndSettle();
    expect(find.text('PAGE-1'), findsOneWidget);
  });
  testWidgets('A01 profile edit loads the nested restaurant response', (
    tester,
  ) async {
    final api = ControlledApi();
    await mountScreen(tester, api, const ProfileSetupScreen());
    api.complete(0, {
      'restaurant': {
        'id': 'sample',
        'name': 'Sample Cafe',
        'address': 'Sample Street',
        'phone': '9999999999',
      },
    });
    await tester.pumpAndSettle();
    final fields = tester.widgetList<TextFormField>(find.byType(TextFormField));
    expect(fields.map((field) => field.controller!.text), [
      'Sample Cafe',
      'Sample Street',
      '9999999999',
    ]);
    expect(find.text('Edit Profile'), findsOneWidget);
  });

  testWidgets('A01 late profile load does not write disposed controllers', (
    tester,
  ) async {
    final api = ControlledApi();
    await mountScreen(tester, api, const ProfileSetupScreen());
    await tester.pumpWidget(const SizedBox());
    api.complete(0, {
      'restaurant': {'name': 'Late'},
    });
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
