import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/order_model.dart';
import '../services/api_service.dart';
import '../services/owner_api_service.dart';

/// Displays orders grouped by status tabs with polling support.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late final OwnerApiService _ownerApiService;

  Timer? _pollTimer;
  bool _isLoading = true;
  String? _error;

  // Orders grouped by status
  List<OrderData> _pendingOrders = [];
  List<OrderData> _acceptedOrders = [];
  List<OrderData> _completedOrders = [];
  List<OrderData> _paidOrders = [];

  static const _pollInterval = Duration(seconds: 10);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ownerApiService = OwnerApiService(context.read<ApiService>());
    _loadOrders();
    _startPolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tabController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadOrders();
      _startPolling();
    } else if (state == AppLifecycleState.paused) {
      _pollTimer?.cancel();
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_pollInterval, (_) => _loadOrders());
  }

  Future<void> _loadOrders() async {
    try {
      // Fetch all statuses in parallel
      final results = await Future.wait([
        _ownerApiService.getOrders(status: 'pending'),
        _ownerApiService.getOrders(status: 'accepted'),
        _ownerApiService.getOrders(status: 'completed'),
        _ownerApiService.getOrders(status: 'payment_received'),
      ]);

      if (!mounted) return;

      setState(() {
        _pendingOrders = _sortNewestFirst(results[0].orders);
        _acceptedOrders = _sortNewestFirst(results[1].orders);
        _completedOrders = _sortNewestFirst(results[2].orders);
        _paidOrders = _sortNewestFirst(results[3].orders);
        _isLoading = false;
        _error = null;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _extractError(e);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load orders. Please try again.';
        _isLoading = false;
      });
    }
  }

  List<OrderData> _sortNewestFirst(List<OrderData> orders) {
    final sorted = List<OrderData>.from(orders);
    sorted.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return sorted;
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

  Future<void> _updateStatus(OrderData order, String newStatus) async {
    try {
      await _ownerApiService.updateOrderStatus(
        orderId: order.id,
        status: newStatus,
      );
      await _loadOrders();
    } on DioException catch (e) {
      if (!mounted) return;
      _showSnackBar(_extractError(e));
    } catch (_) {
      if (!mounted) return;
      _showSnackBar('Failed to update order status');
    }
  }

  Future<void> _cancelOrder(OrderData order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Order'),
        content: Text('Cancel order ${order.orderRef}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _ownerApiService.cancelOrder(orderId: order.id);
      await _loadOrders();
    } on DioException catch (e) {
      if (!mounted) return;
      _showSnackBar(_extractError(e));
    } catch (_) {
      if (!mounted) return;
      _showSnackBar('Failed to cancel order');
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Orders'),
        backgroundColor: const Color(0xFFFF6D00),
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: [
            Tab(text: 'Pending (${_pendingOrders.length})'),
            Tab(text: 'Accepted (${_acceptedOrders.length})'),
            Tab(text: 'Completed (${_completedOrders.length})'),
            Tab(text: 'Paid (${_paidOrders.length})'),
          ],
        ),
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
              onPressed: _loadOrders,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return TabBarView(
      controller: _tabController,
      children: [
        _buildOrderList(_pendingOrders, 'pending'),
        _buildOrderList(_acceptedOrders, 'accepted'),
        _buildOrderList(_completedOrders, 'completed'),
        _buildOrderList(_paidOrders, 'payment_received'),
      ],
    );
  }

  Widget _buildOrderList(List<OrderData> orders, String status) {
    if (orders.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'No ${_statusLabel(status).toLowerCase()} orders',
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: orders.length,
        itemBuilder: (context, index) => _buildOrderCard(orders[index]),
      ),
    );
  }

  Widget _buildOrderCard(OrderData order) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: table name + order ref
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    order.tableDisplayName,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF6D00).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    order.orderRef,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFFF6D00),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Items list
            ...order.items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Text(
                      '${item.quantity}x',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[700],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(item.itemName)),
                  ],
                ),
              ),
            ),

            const Divider(height: 20),

            // Total
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  '₹${order.total.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: Color(0xFFFF6D00),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Action buttons based on current status
            _buildActionButtons(order),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButtons(OrderData order) {
    final buttons = <Widget>[];

    switch (order.status) {
      case 'pending':
        buttons.add(
          Expanded(
            child: FilledButton.icon(
              onPressed: () => _updateStatus(order, 'accepted'),
              icon: const Icon(Icons.check, size: 18),
              label: const Text('Accept'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.green,
              ),
            ),
          ),
        );
        buttons.add(const SizedBox(width: 8));
        buttons.add(
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _cancelOrder(order),
              icon: const Icon(Icons.close, size: 18),
              label: const Text('Cancel'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            ),
          ),
        );
        break;

      case 'accepted':
        buttons.add(
          Expanded(
            child: FilledButton.icon(
              onPressed: () => _updateStatus(order, 'completed'),
              icon: const Icon(Icons.done_all, size: 18),
              label: const Text('Complete'),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.blue,
              ),
            ),
          ),
        );
        buttons.add(const SizedBox(width: 8));
        buttons.add(
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _cancelOrder(order),
              icon: const Icon(Icons.close, size: 18),
              label: const Text('Cancel'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            ),
          ),
        );
        break;

      case 'completed':
        buttons.add(
          Expanded(
            child: FilledButton.icon(
              onPressed: () => _updateStatus(order, 'payment_received'),
              icon: const Icon(Icons.payments_outlined, size: 18),
              label: const Text('Mark Paid'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFFF6D00),
              ),
            ),
          ),
        );
        buttons.add(const SizedBox(width: 8));
        buttons.add(
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _cancelOrder(order),
              icon: const Icon(Icons.close, size: 18),
              label: const Text('Cancel'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            ),
          ),
        );
        break;

      case 'payment_received':
        // Terminal state — no actions available
        buttons.add(
          Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green[700], size: 18),
              const SizedBox(width: 6),
              Text(
                'Payment received',
                style: TextStyle(
                  color: Colors.green[700],
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        );
        break;
    }

    return Row(children: buttons);
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'completed':
        return 'Completed';
      case 'payment_received':
        return 'Paid';
      default:
        return status;
    }
  }
}
