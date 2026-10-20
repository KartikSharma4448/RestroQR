import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/models/order_model.dart';
import 'package:restroqr_owner/screens/orders_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';

Map<String, dynamic> order() => {
  'id': 'order-1',
  'orderRef': 'ORD-PROOF',
  'status': 'pending',
  'total': '20.00',
  'tableDisplayName': 'Table A',
  'createdAt': '2026-10-20T10:00:00Z',
  'items': [],
  'paymentSummary': {'choice': 'upi_submitted', 'transactionId': 'TX12345678'},
};

class PaymentApi extends ApiService {
  final calls = <String>[];
  @override
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    calls.add(path);
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {
        'success': true,
        'data': path.endsWith('/payment')
            ? {
                'choice': 'upi_submitted',
                'transactionId': 'TX12345678',
                'proofUrl': null,
              }
            : {
                'orders': queryParameters?['status'] == 'pending'
                    ? [order()]
                    : [],
                'total': queryParameters?['status'] == 'pending' ? 1 : 0,
                'page': 1,
                'pageSize': 20,
              },
      },
    );
  }
}

void main() {
  test(
    'order model keeps optional payment summary and supports legacy orders',
    () {
      expect(
        OrderData.fromJson(order()).toJson()['paymentSummary'],
        order()['paymentSummary'],
      );
      final legacy = order()..remove('paymentSummary');
      expect(OrderData.fromJson(legacy).paymentSummary, isNull);
    },
  );
  testWidgets(
    'owner reviews an unverified UPI transaction without marking paid',
    (tester) async {
      final api = PaymentApi();
      await tester.pumpWidget(
        Provider<ApiService>.value(
          value: api,
          child: const MaterialApp(home: OrdersScreen()),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('UPI proof submitted - verify in your bank app'),
        findsOneWidget,
      );
      await tester.tap(find.text('Review payment'));
      await tester.pumpAndSettle();
      expect(find.text('Transaction ID: TX12345678'), findsOneWidget);
      expect(
        find.textContaining('A screenshot is not verification.'),
        findsOneWidget,
      );
      expect(api.calls, contains('/owner/orders/order-1/payment'));
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
    },
  );
}
