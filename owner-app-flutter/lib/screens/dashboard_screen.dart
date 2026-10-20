import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/restaurant_models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../ui/app_theme.dart';
import '../ui/owner_widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  RestaurantData? _restaurant;
  bool _isLoading = true;
  String? _error;
  bool _noRestaurant = false;

  @override
  void initState() {
    super.initState();
    _loadRestaurant();
  }

  Future<void> _loadRestaurant() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.get('/owner/restaurant');
      if (!mounted) return;
      final data = response.data;

      if (data['success'] == true && data['data'] != null) {
        final restaurantJson = data['data'] is Map<String, dynamic>
            ? (data['data']['restaurant'] ?? data['data'])
            : data['data'];
        setState(() {
          _restaurant = RestaurantData.fromJson(
            restaurantJson is Map<String, dynamic> ? restaurantJson : {},
          );
          _noRestaurant = false;
          _isLoading = false;
        });
      } else {
        setState(() {
          _noRestaurant = true;
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      if (e.response?.statusCode == 404) {
        setState(() {
          _noRestaurant = true;
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = _extractError(e);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Network error. Please check your connection.';
        _isLoading = false;
      });
    }
  }

  String _extractError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Network error. Please check your connection.';
    }
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      if (data['error'] != null && data['error']['message'] != null) {
        return data['error']['message'];
      }
    }
    return 'An unexpected error occurred';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const BrandHeading(compact: true),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _loadRestaurant,
          ),
          PopupMenuButton<String>(
            tooltip: 'Account',
            icon: const Icon(Icons.account_circle_outlined),
            onSelected: (value) async {
              if (value == 'profile') {
                await context.push('/profile-setup');
                if (mounted) _loadRestaurant();
              } else {
                await context.read<AuthService>().logout();
                if (context.mounted) context.go('/login');
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'profile',
                child: Text('Restaurant profile'),
              ),
              PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      bottomNavigationBar: _restaurant == null
          ? null
          : const OwnerNavigation(selected: 0),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return OwnerEmptyState(
        icon: Icons.wifi_off_outlined,
        title: 'Unable to load restaurant',
        message: _error,
        action: 'Try again',
        onAction: _loadRestaurant,
      );
    }
    if (_noRestaurant) {
      return OwnerEmptyState(
        icon: Icons.storefront_outlined,
        title: 'Your restaurant',
        action: 'Create restaurant',
        onAction: () async {
          await context.push('/profile-setup');
          if (mounted) _loadRestaurant();
        },
      );
    }
    final restaurant = _restaurant!;
    return RefreshIndicator(
      onRefresh: _loadRestaurant,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        children: [
          Text(
            'OVERVIEW',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppColors.muted,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            restaurant.name,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(
                Icons.location_on_outlined,
                size: 16,
                color: AppColors.muted,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  restaurant.address,
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              _statusTag(
                Icons.qr_code_2,
                restaurant.qrMode == 'multi' ? 'Table ordering' : 'Menu QR',
                AppColors.accent,
              ),
              if (restaurant.status != null)
                _statusTag(
                  Icons.circle,
                  restaurant.status == 'active' ? 'Active' : 'Disabled',
                  restaurant.status == 'active'
                      ? AppColors.accent
                      : Theme.of(context).colorScheme.error,
                ),
            ],
          ),
          const SectionHeading('Daily operations'),
          _shortcutGrid(),
          const SectionHeading('Restaurant'),
          ActionRow(
            icon: Icons.restaurant_menu,
            title: 'Menu categories',
            onTap: () => context.push('/categories'),
          ),
          const Divider(),
          if (restaurant.qrMode == 'multi') ...[
            ActionRow(
              icon: Icons.table_bar_outlined,
              title: 'Tables',
              onTap: () => context.push('/tables'),
            ),
            const Divider(),
          ],
          ActionRow(
            icon: Icons.qr_code_2,
            title: 'Restaurant QR',
            onTap: () => context.push('/qr-code'),
          ),
          const Divider(),
          ActionRow(
            icon: Icons.tune,
            title: 'QR settings',
            detail: restaurant.qrMode == 'multi' ? 'Multi-table' : 'Single',
            onTap: () async {
              await context.push('/settings/qr-mode');
              if (mounted) _loadRestaurant();
            },
          ),
          const SectionHeading('Performance'),
          ActionRow(
            icon: Icons.account_balance_wallet_outlined,
            title: 'Revenue',
            onTap: () => context.push('/earnings'),
          ),
          const Divider(),
          ActionRow(
            icon: Icons.insights_outlined,
            title: 'Item analytics',
            onTap: () => context.push('/analytics'),
          ),
          const Divider(),
          ActionRow(
            icon: Icons.history,
            title: 'Order history',
            onTap: () => context.push('/order-history'),
          ),
        ],
      ),
    );
  }

  Widget _statusTag(IconData icon, String label, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(4),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: icon == Icons.circle ? 7 : 15, color: color),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: color,
          ),
        ),
      ],
    ),
  );

  Widget _shortcutGrid() {
    final shortcuts = [
      (Icons.receipt_long_outlined, 'Orders', '/orders'),
      (Icons.restaurant_menu, 'Menu', '/categories'),
      (Icons.qr_code_2, 'QR image', '/qr-code'),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 340 ? 3 : 2;
        final width = (constraints.maxWidth - (columns - 1) * 10) / columns;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: shortcuts
              .map(
                (shortcut) => SizedBox(
                  width: width,
                  child: Card(
                    child: InkWell(
                      borderRadius: BorderRadius.circular(8),
                      onTap: () => context.push(shortcut.$3),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              shortcut.$1,
                              color: AppColors.accent,
                              size: 25,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              shortcut.$2,
                              style: Theme.of(context).textTheme.labelLarge,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}
