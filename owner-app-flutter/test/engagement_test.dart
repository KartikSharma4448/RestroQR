import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/screens/engagement_screen.dart';

class EngagementApi extends ApiService {
  bool fail = false;
  String? redeemed;
  Map? saved;
  String reviewStatus = 'pending';
  Response reply(String path, dynamic data) => Response(
    requestOptions: RequestOptions(path: path),
    data: {'data': data},
  );
  @override
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    if (fail) throw Exception('offline');
    return reply(path, {
      'loyaltyEnabled': true,
      'reviewsEnabled': true,
      'settings': {
        'enabled': false,
        'scheme': 'both',
        'visitReward': 'Tea',
        'spendReward': 'Dip',
        'thresholdCents': 30000,
        'expiryDays': 30,
        'timezone': 'Asia/Kolkata',
      },
      'rewards': [],
      'reviews': [
        {
          'order_id': 'order-1',
          'rating': 5,
          'body': 'Good food',
          'status': reviewStatus,
        },
      ],
    });
  }

  @override
  Future<Response> put(String path, {dynamic data}) async {
    saved = Map.from(data);
    return reply(path, data);
  }

  @override
  Future<Response> post(String path, {dynamic data}) async {
    if (path.endsWith('/claim')) {
      return reply(path, {'reward': 'Tea', 'status': 'available'});
    }
    redeemed = data['code'];
    return reply(path, {'status': 'redeemed'});
  }

  @override
  Future<Response> patch(String path, {dynamic data}) async {
    reviewStatus = data['status'];
    return reply(path, data);
  }
}

void main() {
  Widget host(EngagementApi api) => Provider<ApiService>.value(
    value: api,
    child: const MaterialApp(home: EngagementScreen()),
  );
  testWidgets(
    'owner saves opt-in loyalty settings with currency converted to cents',
    (tester) async {
      final api = EngagementApi();
      await tester.pumpWidget(host(api));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Save settings'),
        300,
        scrollable: find
            .descendant(
              of: find.byType(Form),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(find.text('Save settings'));
      await tester.pumpAndSettle();
      expect(api.saved, containsPair('enabled', true));
      expect(api.saved, containsPair('thresholdCents', 30000));
      expect(find.text('Loyalty settings saved'), findsOneWidget);
    },
  );
  testWidgets(
    'reward requires owner confirmation and never redeems on preview',
    (tester) async {
      final api = EngagementApi();
      await tester.pumpWidget(host(api));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Rewards'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'a' * 64);
      await tester.tap(find.text('Check reward'));
      await tester.pump(const Duration(milliseconds: 400));
      expect(api.redeemed, isNull);
      expect(find.text('Redeem reward?'), findsOneWidget);
      await tester.tap(find.text('Confirm'));
      await tester.pumpAndSettle();
      expect(api.redeemed, 'a' * 64);
      expect(find.text('Reward redeemed'), findsOneWidget);
    },
  );
  testWidgets('owner can publish and hide a submitted review', (tester) async {
    final api = EngagementApi();
    await tester.pumpWidget(host(api));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reviews'));
    await tester.pumpAndSettle();
    expect(find.text('Good food'), findsOneWidget);
    await tester.tap(find.text('Publish'));
    await tester.pumpAndSettle();
    expect(api.reviewStatus, 'published');
    await tester.tap(find.text('Hide'));
    await tester.pumpAndSettle();
    expect(api.reviewStatus, 'hidden');
  });
  testWidgets(
    'network failure has recovery and compact layout does not overflow',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final api = EngagementApi()..fail = true;
      await tester.pumpWidget(host(api));
      await tester.pumpAndSettle();
      expect(find.text('Try again'), findsOneWidget);
      api.fail = false;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Loyalty program'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
