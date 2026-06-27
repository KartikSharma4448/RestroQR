import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'models/restaurant_models.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/categories_screen.dart';
import 'screens/food_items_screen.dart';
import 'screens/food_item_form_screen.dart';
import 'screens/qr_code_screen.dart';

void main() {
  runApp(const RestroQRApp());
}

class RestroQRApp extends StatelessWidget {
  const RestroQRApp({super.key});

  @override
  Widget build(BuildContext context) {
    final apiService = ApiService();
    final authService = AuthService(apiService);

    return MultiProvider(
      providers: [
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider<AuthService>.value(value: authService),
      ],
      child: Builder(
        builder: (context) {
          final router = _createRouter(context.read<AuthService>());
          return MaterialApp.router(
            title: 'RestroQR Owner',
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(
                seedColor: const Color(0xFFFF6D00),
                primary: const Color(0xFFFF6D00),
              ),
              useMaterial3: true,
              inputDecorationTheme: InputDecorationTheme(
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(
                    color: Color(0xFFFF6D00),
                    width: 2,
                  ),
                ),
              ),
              filledButtonTheme: FilledButtonThemeData(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFF6D00),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
            routerConfig: router,
          );
        },
      ),
    );
  }

  GoRouter _createRouter(AuthService authService) {
    return GoRouter(
      initialLocation: '/login',
      redirect: (context, state) async {
        await authService.checkAuthStatus();
        final isAuthenticated = authService.isAuthenticated;
        final isAuthRoute = state.matchedLocation == '/login' ||
            state.matchedLocation == '/register';

        if (!isAuthenticated && !isAuthRoute) {
          return '/login';
        }
        if (isAuthenticated && isAuthRoute) {
          return '/dashboard';
        }
        return null;
      },
      routes: [
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
        ),
        GoRoute(
          path: '/register',
          builder: (context, state) => const RegisterScreen(),
        ),
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/profile-setup',
          builder: (context, state) => const ProfileSetupScreen(),
        ),
        GoRoute(
          path: '/categories',
          builder: (context, state) => const CategoriesScreen(),
        ),
        GoRoute(
          path: '/categories/:categoryId/items',
          builder: (context, state) {
            final categoryId = state.pathParameters['categoryId']!;
            final categoryName = state.extra as String?;
            return FoodItemsScreen(
              categoryId: categoryId,
              categoryName: categoryName,
            );
          },
        ),
        GoRoute(
          path: '/categories/:categoryId/items/add',
          builder: (context, state) {
            final categoryId = state.pathParameters['categoryId']!;
            final categoryName = state.extra as String?;
            return FoodItemFormScreen(
              categoryId: categoryId,
              categoryName: categoryName,
            );
          },
        ),
        GoRoute(
          path: '/categories/:categoryId/items/edit/:itemId',
          builder: (context, state) {
            final categoryId = state.pathParameters['categoryId']!;
            final extra = state.extra as Map<String, dynamic>?;
            final categoryName = extra?['categoryName'] as String?;
            final item = extra?['item'] as FoodItemData?;
            return FoodItemFormScreen(
              categoryId: categoryId,
              categoryName: categoryName,
              existingItem: item,
            );
          },
        ),
        GoRoute(
          path: '/qr-code',
          builder: (context, state) => const QrCodeScreen(),
        ),
      ],
    );
  }
}
