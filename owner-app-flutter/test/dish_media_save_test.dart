import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:restroqr_owner/screens/food_item_form_screen.dart';
import 'package:restroqr_owner/ui/dish_media_editor.dart';
import 'package:restroqr_owner/services/api_service.dart';
import 'session_recovery_test.dart' show MemoryApi;

class RetryMediaApi extends MemoryApi {
  int creates = 0;
  int updates = 0;
  int mediaSaves = 0;
  @override
  Future<Response> post(String path, {dynamic data}) async {
    creates++;
    return Response(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': {
          'item': {'id': 'saved-dish'},
        },
      },
    );
  }

  @override
  Future<Response> put(String path, {dynamic data}) async {
    if (path.endsWith('/media')) {
      mediaSaves++;
      if (mediaSaves == 1) {
        throw DioException(
          requestOptions: RequestOptions(path: path),
          response: Response(
            requestOptions: RequestOptions(path: path),
            statusCode: 503,
            data: {
              'error': {'message': 'Storage unavailable'},
            },
          ),
        );
      }
    } else {
      updates++;
    }
    return Response(
      requestOptions: RequestOptions(path: path),
      data: {'success': true},
    );
  }
}

void main() {
  testWidgets(
    'retry after media failure updates the saved dish instead of duplicating it',
    (tester) async {
      final api = RetryMediaApi();
      final router = GoRouter(
        initialLocation: '/add',
        routes: [
          GoRoute(
            path: '/',
            builder: (_, state) =>
                const Scaffold(body: Text('Saved dish list')),
          ),
          GoRoute(
            path: '/add',
            builder: (_, state) =>
                const FoodItemFormScreen(categoryId: 'category'),
          ),
        ],
      );
      // Ensure the form was pushed so successful save can pop back to the list.
      router.go('/');
      await tester.pumpWidget(
        Provider<ApiService>.value(
          value: api,
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      router.push('/add');
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).at(0), 'Pizza');
      await tester.enterText(find.byType(TextFormField).at(2), '120');
      await tester.ensureVisible(find.text('Emoji'));
      await tester.tap(find.text('Emoji'));
      await tester.pumpAndSettle();
      final save = find.widgetWithText(FilledButton, 'Add Item');
      await tester.ensureVisible(save);
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Item details saved. Options or media failed:'),
        findsOneWidget,
      );
      expect(api.creates, 1);
      expect(api.mediaSaves, 1);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      await tester.ensureVisible(save);
      await tester.tap(save);
      await tester.pumpAndSettle();
      expect(api.creates, 1);
      expect(api.updates, 1);
      expect(api.mediaSaves, 2);
      expect(find.text('Saved dish list'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      router.dispose();
    },
    skip: !DishMediaEditor.enabled,
  );
}
