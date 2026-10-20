import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:restroqr_owner/models/restaurant_models.dart';
import 'package:restroqr_owner/screens/food_items_screen.dart';
import 'package:restroqr_owner/screens/food_item_form_screen.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'audit_fixes_test.dart' show ControlledApi;

class DishApi extends ControlledApi {
  int saves = 0;
  @override
  Future<Response> post(String path, {dynamic data}) async {
    saves++;
    return Response(
      requestOptions: RequestOptions(path: path),
      data: {'success': true},
    );
  }

  @override
  Future<Response> put(String path, {dynamic data}) => post(path, data: data);
}

void main() {
  for (final action in ['add', 'edit', 'cancel']) {
    testWidgets('A06 $action returns to the correct dish list', (tester) async {
      final api = DishApi();
      final item = {
        'id': 'dish',
        'name': 'Old Dish',
        'price': '10.00',
        'isAvailable': true,
        'badge': 'veg',
        'categoryId': 'sample',
      };
      final router = GoRouter(
        initialLocation: '/categories/sample/items',
        routes: [
          GoRoute(
            path: '/categories/sample/items',
            builder: (_, state) => const FoodItemsScreen(categoryId: 'sample'),
            routes: [
              GoRoute(
                path: 'add',
                builder: (_, state) =>
                    const FoodItemFormScreen(categoryId: 'sample'),
              ),
              GoRoute(
                path: 'edit/:id',
                builder: (_, state) => FoodItemFormScreen(
                  categoryId: 'sample',
                  existingItem: (state.extra as Map)['item'] as FoodItemData,
                ),
              ),
            ],
          ),
        ],
      );
      await tester.pumpWidget(
        Provider<ApiService>.value(
          value: api,
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      api.complete(0, {
        'items': action == 'edit' ? [item] : [],
      });
      await tester.pumpAndSettle();
      await tester.tap(
        action == 'edit' ? find.byTooltip('Edit dish') : find.text('Add dish'),
      );
      await tester.pumpAndSettle();
      if (action == 'cancel') {
        await tester.tap(find.byIcon(Icons.arrow_back));
      } else {
        await tester.enterText(find.byType(TextFormField).at(0), 'Saved Dish');
        await tester.enterText(find.byType(TextFormField).at(2), '10');
        final save = find.widgetWithText(
          FilledButton,
          action == 'edit' ? 'Update Item' : 'Add Item',
        );
        await tester.ensureVisible(save);
        await tester.tap(save);
      }
      await tester.pump();
      if (action != 'cancel') {
        expect(api.saves, 1);
        expect(api.requests.length, 2);
        api.complete(1, {
          'items': [
            {...item, 'name': 'Saved Dish'},
          ],
        });
        await tester.pumpAndSettle();
        expect(find.text('Saved Dish'), findsOneWidget);
        expect(find.text('No dishes yet'), findsNothing);
      } else {
        await tester.pumpAndSettle();
        expect(api.saves, 0);
        expect(api.requests.length, 1);
      }
      await tester.pumpWidget(const SizedBox());
      router.dispose();
    });
  }
}
