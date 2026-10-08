import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/screens/dashboard_screen.dart';
import 'package:restroqr_owner/screens/login_screen.dart';
import 'package:restroqr_owner/screens/register_screen.dart';
import 'package:restroqr_owner/screens/categories_screen.dart';
import 'package:restroqr_owner/screens/orders_screen.dart';
import 'package:restroqr_owner/screens/earnings_screen.dart';
import 'package:restroqr_owner/screens/qr_code_screen.dart';
import 'package:restroqr_owner/screens/tables_screen.dart';
import 'package:restroqr_owner/screens/food_items_screen.dart';
import 'package:restroqr_owner/screens/profile_setup_screen.dart';
import 'package:restroqr_owner/screens/food_item_form_screen.dart';
import 'package:restroqr_owner/screens/item_analytics_screen.dart';
import 'package:restroqr_owner/screens/order_history_screen.dart';
import 'package:restroqr_owner/screens/qr_mode_settings_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'package:restroqr_owner/services/auth_service.dart';
import 'package:restroqr_owner/ui/app_theme.dart';
import 'package:restroqr_owner/models/restaurant_models.dart';

class SavingApi extends SampleApi {
  final calls = <String, dynamic>{};
  @override
  Future<Response> put(String path, {dynamic data}) async {
    calls[path] = data;
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true},
    );
  }

  @override
  Future<Response> patch(String path, {dynamic data}) async {
    calls[path] = data;
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true},
    );
  }
}

class SampleApi extends ApiService {
  @override
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final Object data;
    if (path == '/owner/restaurant') {
      data = {
        'restaurant': {
          'id': 'r1',
          'name': 'The Green Table',
          'address': 'C-Scheme, Jaipur',
          'phone': '9000000000',
          'qrMode': 'multi',
          'status': 'active',
        },
      };
    } else if (path == '/owner/categories') {
      data = {
        'categories': [
          {'id': 'c1', 'name': 'Small plates', 'displayOrder': 0},
          {'id': 'c2', 'name': 'Main course', 'displayOrder': 1},
          {'id': 'c3', 'name': 'From the grill', 'displayOrder': 2},
          {'id': 'c4', 'name': 'Desserts', 'displayOrder': 3},
          {'id': 'c5', 'name': 'Beverages', 'displayOrder': 4},
        ],
      };
    } else if (path == '/owner/orders') {
      data = {
        'orders': queryParameters?['status'] == 'pending'
            ? [
                {
                  'id': 'o1',
                  'orderRef': 'ORD-6FH2Q1',
                  'status': 'pending',
                  'tableDisplayName': 'Table 04',
                  'total': '780.00',
                  'createdAt': '2026-01-15T12:00:00Z',
                  'items': [
                    {
                      'id': 'i1',
                      'itemName': 'Paneer tikka',
                      'quantity': 2,
                      'itemPrice': '240',
                    },
                    {
                      'id': 'i2',
                      'itemName': 'Masala lemonade',
                      'quantity': 2,
                      'itemPrice': '150',
                    },
                  ],
                },
                {
                  'id': 'o2',
                  'orderRef': 'ORD-A9V3M2',
                  'status': 'pending',
                  'tableDisplayName': 'Patio 02',
                  'total': '460.00',
                  'createdAt': '2026-01-15T12:00:00Z',
                  'items': [
                    {
                      'id': 'i3',
                      'itemName': 'Garden bowl',
                      'quantity': 1,
                      'itemPrice': '320',
                    },
                    {
                      'id': 'i4',
                      'itemName': 'Cold coffee',
                      'quantity': 1,
                      'itemPrice': '140',
                    },
                  ],
                },
              ]
            : [],
      };
    } else if (path == '/owner/earnings/summary') {
      data = {'totalOrders': 128, 'totalRevenue': '84620.00'};
    } else if (path == '/owner/earnings/breakdown') {
      data = {'breakdown': []};
    } else if (path == '/owner/tables') {
      data = {
        'tables': List.generate(
          5,
          (index) => {
            'id': 't$index',
            'restaurantId': 'r1',
            'displayName': 'Table 0${index + 1}',
            'tableToken': 'test-token',
            'createdAt': '2026-01-15T12:00:00Z',
            'updatedAt': '2026-01-15T12:00:00Z',
          },
        ),
      };
    } else if (path == '/owner/earnings/history') {
      data = {'orders': [], 'totalCount': 0};
    } else if (path == '/owner/analytics/items') {
      data = {'items': []};
    } else if (path.contains('/items')) {
      data = {
        'items': [
          {
            'id': 'i1',
            'categoryId': 'c1',
            'name': 'Paneer tikka',
            'description': 'Chargrilled paneer, mint chutney',
            'price': '240',
            'badge': 'veg',
            'isAvailable': true,
          },
          {
            'id': 'i2',
            'categoryId': 'c1',
            'name': 'Crispy corn',
            'description': 'Pepper, spring onion, lime',
            'price': '180',
            'badge': 'veg',
            'isAvailable': true,
          },
        ],
      };
    } else {
      throw StateError('Unexpected preview API request: $path');
    }
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );
  }

  @override
  Future<Response> getBytes(String path) async => Response(
    requestOptions: RequestOptions(path: path),
    statusCode: 200,
    data: File('test/fixtures/qr.png').readAsBytesSync(),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final loader = FontLoader('Roboto');
    for (final name in ['regular', 'medium', 'bold']) {
      loader.addFont(rootBundle.load('assets/fonts/roboto-$name.ttf'));
    }
    await loader.load();
    final icons = FontLoader('MaterialIcons');
    icons.addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });

  final screens = <String, Widget Function()>{
    'overview': () => const DashboardScreen(),
    'login': () => const LoginScreen(),
    'register': () => const RegisterScreen(),
    'menu': () => const CategoriesScreen(),
    'orders': () => const OrdersScreen(),
    'qr': () => const QrCodeScreen(),
    'tables': () => const TablesScreen(),
    'items': () =>
        const FoodItemsScreen(categoryId: 'c1', categoryName: 'Small plates'),
    'profile': () => const ProfileSetupScreen(),
    'dish_form': () => const FoodItemFormScreen(
      categoryId: 'c1',
      categoryName: 'Small plates',
    ),
    'qr_settings': () => const QrModeSettingsScreen(),
    'history': () => const OrderHistoryScreen(),
  };

  Future<void> showScreen(
    WidgetTester tester,
    Widget screen,
    Size size,
    double scale,
  ) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = SampleApi();
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          Provider<ApiService>.value(value: api),
          ChangeNotifierProvider<AuthService>(create: (_) => AuthService(api)),
        ],
        child: RepaintBoundary(
          key: const ValueKey('screen'),
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: ownerTheme(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: screen,
          ),
        ),
      ),
    );
    await tester.runAsync(() async {
      final context = tester.element(find.byKey(const ValueKey('screen')));
      await precacheImage(const AssetImage('assets/brand-mark.png'), context);
      await precacheImage(
        MemoryImage(File('test/fixtures/qr.png').readAsBytesSync()),
        context,
      );
    });
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final context = tester.element(find.byKey(const ValueKey('screen')));
      for (final image in tester.widgetList<Image>(find.byType(Image))) {
        await precacheImage(image.image, context);
      }
    });
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }

  for (final entry in screens.entries) {
    testWidgets('${entry.key} has a professional mobile visual baseline', (
      tester,
    ) async {
      await showScreen(tester, entry.value(), const Size(390, 844), 1);
      await expectLater(
        find.byKey(const ValueKey('screen')),
        matchesGoldenFile('goldens/${entry.key}.png'),
      );
      await tester.pumpWidget(const SizedBox());
    });
    testWidgets('${entry.key} fits a small phone with enlarged text', (
      tester,
    ) async {
      await showScreen(tester, entry.value(), const Size(320, 720), 1.5);
      await tester.pumpWidget(const SizedBox());
    });
  }

  testWidgets(
    'revenue fits small and tablet screens without nested summary cards',
    (tester) async {
      await showScreen(
        tester,
        const EarningsScreen(),
        const Size(320, 720),
        1.5,
      );
      await showScreen(tester, const EarningsScreen(), const Size(800, 900), 1);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('analytics fits small and tablet screens', (tester) async {
    await showScreen(
      tester,
      const ItemAnalyticsScreen(),
      const Size(320, 720),
      1.5,
    );
    await showScreen(
      tester,
      const ItemAnalyticsScreen(),
      const Size(800, 900),
      1,
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('sign-in keeps visibility and validation controls functional', (
    tester,
  ) async {
    await showScreen(tester, const LoginScreen(), const Size(390, 844), 1);
    await tester.tap(find.byTooltip('Show password'));
    await tester.pump();
    expect(
      tester.widget<EditableText>(find.byType(EditableText).last).obscureText,
      isFalse,
    );
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Enter your email or phone'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('food type segmented control updates selection', (tester) async {
    await showScreen(
      tester,
      const FoodItemFormScreen(categoryId: 'c1'),
      const Size(320, 720),
      1.5,
    );
    await tester.ensureVisible(find.text('Non-veg'));
    await tester.tap(find.text('Non-veg'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<SegmentedButton<String>>(find.byType(SegmentedButton<String>))
          .selected,
      {'non_veg'},
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('QR save remains connected to the native storage service', (
    tester,
  ) async {
    const channel = MethodChannel('restroqr/qr_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          expect(call.method, 'saveQr');
          return {'uri': 'content://media/1', 'gallery': true};
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null),
    );
    await showScreen(tester, const QrCodeScreen(), const Size(390, 844), 1);
    await tester.tap(find.text('Save QR Image'));
    await tester.pumpAndSettle();
    expect(
      find.text('QR saved to Gallery / Pictures / RestroQR'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('dish form persists the availability switch when edited', (
    tester,
  ) async {
    final api = SavingApi();
    final item = FoodItemData(
      id: 'i1',
      categoryId: 'c1',
      name: 'Paneer tikka',
      price: 240,
      badge: 'veg',
      isAvailable: true,
    );
    final router = GoRouter(
      initialLocation: '/items/edit',
      routes: [
        GoRoute(
          path: '/items',
          builder: (_, _) => const Scaffold(body: Text('Menu items')),
          routes: [
            GoRoute(
              path: 'edit',
              builder: (_, _) =>
                  FoodItemFormScreen(categoryId: 'c1', existingItem: item),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: api,
        child: MaterialApp.router(theme: ownerTheme(), routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(Switch));
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.widgetWithText(FilledButton, 'Update Item'),
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Update Item'));
    await tester.pumpAndSettle();
    expect(api.calls['/owner/items/i1/availability'], {'isAvailable': false});
    expect(find.text('Menu items'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('bottom navigation switches between real owner routes', (
    tester,
  ) async {
    final api = SampleApi();
    final router = GoRouter(
      initialLocation: '/dashboard',
      routes: [
        GoRoute(path: '/dashboard', builder: (_, _) => const DashboardScreen()),
        GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
        GoRoute(
          path: '/categories',
          builder: (_, _) => const CategoriesScreen(),
        ),
        GoRoute(path: '/earnings', builder: (_, _) => const EarningsScreen()),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      Provider<ApiService>.value(
        value: api,
        child: MaterialApp.router(theme: ownerTheme(), routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Menu').last);
    await tester.pumpAndSettle();
    expect(find.text('Menu categories'), findsOneWidget);
    await tester.tap(find.text('Orders').last);
    await tester.pumpAndSettle();
    expect(find.text('Table 04'), findsOneWidget);
    await tester.tap(find.text('Revenue').last);
    await tester.pumpAndSettle();
    expect(find.text('Revenue received'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
