import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'models/restaurant_models.dart';
import 'ui/app_theme.dart';
import 'ui/waiter_alarm_host.dart';
import 'services/api_service.dart';
import 'services/auth_service.dart';
import 'services/notification_handler.dart';
import 'services/owner_api_service.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/verify_email_screen.dart';
import 'screens/connect_google_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/categories_screen.dart';
import 'screens/food_items_screen.dart';
import 'screens/food_item_form_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/qr_code_screen.dart';
import 'screens/tables_screen.dart';
import 'screens/earnings_screen.dart';
import 'screens/order_history_screen.dart';
import 'screens/item_analytics_screen.dart';
import 'screens/qr_mode_settings_screen.dart';
import 'screens/engagement_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  } catch (e) {
    // Firebase not configured — app will work without push notifications
    debugPrint('Firebase initialization failed: $e');
  }
  runApp(const RestroQRApp());
}

class RestroQRApp extends StatefulWidget {
  final ApiService? apiService;
  final NotificationHandler? notificationHandler;
  const RestroQRApp({super.key, this.apiService, this.notificationHandler});

  @override
  State<RestroQRApp> createState() => _RestroQRAppState();
}

class _RestroQRAppState extends State<RestroQRApp> {
  late final ApiService apiService;
  late final AuthService authService;
  late final OwnerApiService ownerApiService;
  late final NotificationHandler notificationHandler;
  late final GoRouter router;
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    apiService = widget.apiService ?? ApiService();
    authService = AuthService(apiService);
    ownerApiService = OwnerApiService(apiService);
    notificationHandler =
        widget.notificationHandler ??
        NotificationHandler(ownerApiService: ownerApiService);
    authService.notificationHandler = notificationHandler;
    router = _createRouter(authService, notificationHandler);
    notificationHandler.onForegroundNotification = (table, total) {
      if (!mounted || !authService.isAuthenticated) return;
      _messengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text('New order from $table - $total'),
          action: SnackBarAction(
            label: 'View',
            onPressed: () => router.go('/orders'),
          ),
        ),
      );
    };
  }

  @override
  void dispose() {
    notificationHandler.onForegroundNotification = null;
    notificationHandler.onNotificationTap = null;
    authService.dispose();
    router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiService>.value(value: apiService),
        ChangeNotifierProvider<AuthService>.value(value: authService),
        Provider<OwnerApiService>.value(value: ownerApiService),
        Provider<NotificationHandler>.value(value: notificationHandler),
      ],
      child: MaterialApp.router(
        scaffoldMessengerKey: _messengerKey,
        title: 'RestroQR Owner',
        debugShowCheckedModeBanner: false,
        theme: ownerTheme(),
        routerConfig: router,
        builder: (context, child) {
          final auth = context.watch<AuthService>();
          return WaiterAlarmHost(
            api: apiService,
            notifications: notificationHandler,
            enabled:
                const bool.fromEnvironment('WAITER_CALLING_ENABLED') &&
                auth.isAuthenticated &&
                !auth.googleConnectionRequired,
            child: child ?? const SizedBox(),
          );
        },
      ),
    );
  }

  GoRouter _createRouter(
    AuthService authService,
    NotificationHandler notificationHandler,
  ) {
    final router = GoRouter(
      initialLocation: '/login',
      refreshListenable: authService,
      redirect: (context, state) async {
        await authService.checkAuthStatus();
        final isAuthenticated = authService.isAuthenticated;
        final isAuthRoute =
            state.matchedLocation == '/login' ||
            state.matchedLocation == '/register' ||
            (state.matchedLocation == '/verify-email' &&
                authService.hasPendingSignup);

        if (!isAuthenticated && !isAuthRoute) {
          return '/login';
        }
        if (isAuthenticated &&
            authService.googleConnectionRequired &&
            state.matchedLocation != '/connect-google') {
          return '/connect-google';
        }
        if (isAuthenticated &&
            !authService.googleConnectionRequired &&
            state.matchedLocation == '/connect-google') {
          return '/dashboard';
        }
        if (isAuthenticated && isAuthRoute) {
          return '/dashboard';
        }
        return null;
      },
      routes: [
        GoRoute(path:'/engagement',builder:(context,state)=>const EngagementScreen()),
        GoRoute(
          path: '/verify-email',
          builder: (context, state) => const VerifyEmailScreen(),
        ),
        GoRoute(
          path: '/connect-google',
          builder: (context, state) => const ConnectGoogleScreen(),
        ),
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
        GoRoute(
          path: '/orders',
          builder: (context, state) => const OrdersScreen(),
        ),
        GoRoute(
          path: '/tables',
          builder: (context, state) => const TablesScreen(),
        ),
        GoRoute(
          path: '/earnings',
          builder: (context, state) => const EarningsScreen(),
        ),
        GoRoute(
          path: '/order-history',
          builder: (context, state) => const OrderHistoryScreen(),
        ),
        GoRoute(
          path: '/analytics',
          builder: (context, state) => const ItemAnalyticsScreen(),
        ),
        GoRoute(
          path: '/settings/qr-mode',
          builder: (context, state) => const QrModeSettingsScreen(),
        ),
      ],
    );

    // Set up notification tap to navigate to orders screen
    notificationHandler.onNotificationTap = () {
      router.go('/orders');
    };

    return router;
  }
}
