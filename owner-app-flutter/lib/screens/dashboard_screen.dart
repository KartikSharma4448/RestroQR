import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/restaurant_models.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';

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
        title: const Text('Dashboard'),
        backgroundColor: const Color(0xFFFF6D00),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await context.read<AuthService>().logout();
              if (mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loadRestaurant,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_noRestaurant) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.store_outlined,
                size: 80,
                color: Colors.grey[400],
              ),
              const SizedBox(height: 24),
              Text(
                'Welcome to RestroQR!',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Set up your restaurant profile to get started.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600], fontSize: 16),
              ),
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: () => context.go('/profile-setup'),
                icon: const Icon(Icons.add_business),
                label: const Text('Setup Profile'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFF6D00),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 16,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadRestaurant,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.restaurant, color: const Color(0xFFFF6D00)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _restaurant!.name,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 18, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _restaurant!.address,
                          style: TextStyle(color: Colors.grey[700]),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.phone_outlined,
                          size: 18, color: Colors.grey[600]),
                      const SizedBox(width: 8),
                      Text(
                        _restaurant!.phone,
                        style: TextStyle(color: Colors.grey[700]),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Quick Actions',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          _buildActionTile(
            icon: Icons.receipt_long_outlined,
            title: 'Orders',
            subtitle: 'View and manage incoming orders',
            onTap: () => context.push('/orders'),
          ),
          if (_restaurant!.qrMode == 'multi')
            _buildActionTile(
              icon: Icons.table_bar_outlined,
              title: 'Tables',
              subtitle: 'Manage tables and download QR codes',
              onTap: () => context.push('/tables'),
            ),
          _buildActionTile(
            icon: Icons.monetization_on_outlined,
            title: 'Earnings',
            subtitle: 'View monthly revenue and breakdowns',
            onTap: () => context.push('/earnings'),
          ),
          _buildActionTile(
            icon: Icons.analytics_outlined,
            title: 'Analytics',
            subtitle: 'Per-item sales and revenue analytics',
            onTap: () => context.push('/analytics'),
          ),
          _buildActionTile(
            icon: Icons.category_outlined,
            title: 'Manage Categories',
            subtitle: 'Add, edit, and reorder menu categories',
            onTap: () => context.push('/categories'),
          ),
          _buildActionTile(
            icon: Icons.edit_outlined,
            title: 'Edit Profile',
            subtitle: 'Update restaurant details',
            onTap: () => context.push('/profile-setup'),
          ),
          _buildActionTile(
            icon: Icons.qr_code,
            title: 'QR Code',
            subtitle: 'View and download your restaurant QR code',
            onTap: () => context.push('/qr-code'),
          ),
          _buildActionTile(
            icon: Icons.settings_outlined,
            title: 'QR Mode Settings',
            subtitle: 'Switch between single and multi-table QR modes',
            onTap: () => context.push('/settings/qr-mode'),
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFFF6D00).withValues(alpha: 0.1),
          child: Icon(icon, color: const Color(0xFFFF6D00)),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
