import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../ui/app_theme.dart';
import '../ui/owner_widgets.dart';
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
  late OwnerApiService _ownerApiService;

  Timer? _pollTimer;
  bool _isLoading = true;
  String? _error;
  int _requestId = 0;
  final _pages = <String, int>{};
  final _totals = <String, int>{};
  final _paymentLoading = <String>{};
  static const _pageSize = 20;

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
    if (!mounted) return;
    final requestId = ++_requestId;
    try {
      // Fetch all statuses in parallel
      final results = await Future.wait([
        _loadStatus('pending'),
        _loadStatus('accepted'),
        _loadStatus('completed'),
        _loadStatus('payment_received'),
      ]);

      if (!mounted || requestId != _requestId) return;

      setState(() {
        _pendingOrders = _sortNewestFirst(results[0].orders);
        _acceptedOrders = _sortNewestFirst(results[1].orders);
        _completedOrders = _sortNewestFirst(results[2].orders);
        _paidOrders = _sortNewestFirst(results[3].orders);
        for (var i = 0; i < results.length; i++) {
          final status = [
            'pending',
            'accepted',
            'completed',
            'payment_received',
          ][i];
          _totals[status] = results[i].totalCount;
          _pages[status] = results[i].page;
        }
        _isLoading = false;
        _error = null;
      });
    } on DioException catch (e) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = _extractError(e);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _error = 'Failed to load orders. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<OrderListResponse> _loadStatus(String status) async {
    var result = await _ownerApiService.getOrders(
      status: status,
      page: _pages[status] ?? 1,
      pageSize: _pageSize,
    );
    final lastPage = (result.totalCount / _pageSize).ceil().clamp(1, 1000000);
    if (result.page > lastPage) {
      result = await _ownerApiService.getOrders(
        status: status,
        page: lastPage,
        pageSize: _pageSize,
      );
    }
    return result;
  }

  void _changePage(String status, int page) {
    setState(() {
      _pages[status] = page;
      _isLoading = true;
    });
    _loadOrders();
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
    if (e.response?.statusCode == 404) {
      return 'Could not reach the orders service. '
          'The server may be starting up — please try again in a moment.';
    }
    if (e.response?.statusCode == 500) {
      return 'Server is temporarily unavailable. '
          'It may be waking up from sleep — please wait a moment and retry.';
    }
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      if (data['error'] != null && data['error']['message'] != null) {
        return data['error']['message'];
      }
    }
    return 'An unexpected error occurred. Please try again.';
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Orders'),
        actions: [
          IconButton(
            tooltip: 'Refresh orders',
            onPressed: _isLoading ? null : _loadOrders,
            icon: const Icon(Icons.refresh, size: 22),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelColor: AppColors.accent,
          unselectedLabelColor: AppColors.muted,
          indicatorColor: AppColors.accent,
          tabs: [
            Tab(text: 'Pending (${_totals['pending'] ?? 0})'),
            Tab(text: 'Accepted (${_totals['accepted'] ?? 0})'),
            Tab(text: 'Completed (${_totals['completed'] ?? 0})'),
            Tab(text: 'Paid (${_totals['payment_received'] ?? 0})'),
          ],
        ),
      ),
      body: _buildBody(),
      bottomNavigationBar: const OwnerNavigation(selected: 1),
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
            FilledButton(onPressed: _loadOrders, child: const Text('Retry')),
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
            Icon(
              Icons.receipt_long_outlined,
              size: 64,
              color: Colors.grey[300],
            ),
            const SizedBox(height: 16),
            Text(
              'No ${_statusLabel(status).toLowerCase()} orders',
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
          ],
        ),
      );
    }

    final page = _pages[status] ?? 1;
    final pageCount = ((_totals[status] ?? 0) / _pageSize).ceil().clamp(
      1,
      1000000,
    );
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadOrders,
            child: ListView.builder(
              key: ValueKey('$status-$page'),
              padding: const EdgeInsets.all(12),
              itemCount: orders.length,
              itemBuilder: (context, index) => _buildOrderCard(orders[index]),
            ),
          ),
        ),
        if (pageCount > 1)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  tooltip: 'Previous page',
                  icon: const Icon(Icons.chevron_left),
                  onPressed: page > 1
                      ? () => _changePage(status, page - 1)
                      : null,
                ),
                Text('Page $page of $pageCount'),
                IconButton(
                  tooltip: 'Next page',
                  icon: const Icon(Icons.chevron_right),
                  onPressed: page < pageCount
                      ? () => _changePage(status, page + 1)
                      : null,
                ),
              ],
            ),
          ),
      ],
    );
  }

  Future<void> _reviewPayment(OrderData order) async {
    setState(() => _paymentLoading.add(order.id));
    try {
      final payment = await _ownerApiService.getOrderPayment(order.id);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Payment - ${order.orderRef}'),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Choice: ${payment['choice']}'),
                  if (payment['transactionId'] != null)
                    SelectableText(
                      'Transaction ID: ${payment['transactionId']}',
                    ),
                  const SizedBox(height: 12),
                  const Text(
                    'Confirm payment in your bank/UPI app or collect cash before marking paid. A screenshot is not verification.',
                  ),
                  if (payment['proofUrl'] is String) ...[
                    const SizedBox(height: 12),
                    Image.network(
                      payment['proofUrl'] as String,
                      fit: BoxFit.contain,
                      loadingBuilder: (context, child, progress) =>
                          progress == null
                          ? child
                          : const SizedBox(
                              height: 120,
                              child: Center(child: CircularProgressIndicator()),
                            ),
                      errorBuilder: (context, error, stack) => const Text(
                        'Screenshot unavailable. Close and reopen to refresh access.',
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not load payment. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _paymentLoading.remove(order.id));
    }
  }

  Color _ticketColor(String status) => switch (status) {
    'pending' => AppColors.amber,
    'accepted' => AppColors.blue,
    'completed' => AppColors.accent,
    _ => AppColors.muted,
  };

  Widget _buildOrderCard(OrderData order) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.circle, size: 7, color: _ticketColor(order.status)),
                const SizedBox(width: 6),
                Text(
                  _statusLabel(order.status),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _ticketColor(order.status),
                  ),
                ),
                const Spacer(),
                Text(
                  '${order.items.fold<int>(0, (sum, item) => sum + item.quantity)} items',
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
                ),
              ],
            ),
            const SizedBox(height: 12),
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    order.orderRef,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              ],
            ),
            if (order.customerName != null || order.customerPhone != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.person_pin_rounded,
                    size: 16,
                    color: Colors.grey[600],
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      [
                        order.customerName ?? 'Guest',
                        if (order.customerPhone?.isNotEmpty == true)
                          order.customerPhone!,
                      ].join(' · '),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey[800],
                      ),
                    ),
                  ),
                ],
              ),
            ],
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
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.itemName),
                          if (item.optionSummary?.isNotEmpty == true)
                            Text(
                              item.optionSummary!,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                        ],
                      ),
                    ),
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
                    color: AppColors.accent,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Action buttons based on current status
            if (order.paymentSummary != null) ...[
              Text(
                order.paymentSummary!['choice'] == 'upi_submitted'
                    ? 'UPI proof submitted - verify in your bank app'
                    : order.paymentSummary!['choice'] == 'cash'
                    ? 'Cash selected - collect at counter'
                    : 'Payment not submitted',
              ),
              TextButton.icon(
                onPressed: _paymentLoading.contains(order.id)
                    ? null
                    : () => _reviewPayment(order),
                icon: const Icon(Icons.receipt_long_outlined, size: 18),
                label: Text(
                  _paymentLoading.contains(order.id)
                      ? 'Loading...'
                      : 'Review payment',
                ),
              ),
              const SizedBox(height: 8),
            ],
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
              style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
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
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFB42334),
              ),
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
              style: FilledButton.styleFrom(backgroundColor: AppColors.blue),
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
              style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
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
