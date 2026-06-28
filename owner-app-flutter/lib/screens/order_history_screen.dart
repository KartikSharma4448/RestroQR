import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/order_model.dart';
import '../services/api_service.dart';
import '../services/owner_api_service.dart';

/// Displays a paginated order history list with filters for date range
/// and order status.
///
/// Validates: Requirements 8.4, 8.5
class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  late final OwnerApiService _ownerApiService;

  final List<OrderData> _orders = [];
  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;
  int _currentPage = 1;
  int _totalCount = 0;
  static const int _pageSize = 20;

  // Filters
  String? _selectedStatus;
  DateTimeRange? _selectedDateRange;

  final ScrollController _scrollController = ScrollController();

  static const List<String> _statusOptions = [
    'pending',
    'accepted',
    'completed',
    'payment_received',
    'cancelled',
  ];

  @override
  void initState() {
    super.initState();
    _ownerApiService = OwnerApiService(context.read<ApiService>());
    _scrollController.addListener(_onScroll);
    _loadOrders();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_isLoadingMore &&
        _hasMorePages) {
      _loadMore();
    }
  }

  bool get _hasMorePages => _orders.length < _totalCount;

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _currentPage = 1;
      _orders.clear();
    });

    try {
      final response = await _ownerApiService.getHistory(
        page: 1,
        pageSize: _pageSize,
        status: _selectedStatus,
      );
      setState(() {
        _orders.addAll(_filterByDateRange(response.orders));
        _totalCount = response.totalCount;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = _extractErrorMessage(e);
        _isLoading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMorePages) return;

    setState(() {
      _isLoadingMore = true;
    });

    try {
      final nextPage = _currentPage + 1;
      final response = await _ownerApiService.getHistory(
        page: nextPage,
        pageSize: _pageSize,
        status: _selectedStatus,
      );
      setState(() {
        _currentPage = nextPage;
        _orders.addAll(_filterByDateRange(response.orders));
        _totalCount = response.totalCount;
        _isLoadingMore = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingMore = false;
      });
    }
  }

  List<OrderData> _filterByDateRange(List<OrderData> orders) {
    if (_selectedDateRange == null) return orders;
    final start = _selectedDateRange!.start;
    final end = _selectedDateRange!.end
        .add(const Duration(hours: 23, minutes: 59, seconds: 59));
    return orders.where((order) {
      return order.createdAt.isAfter(start.subtract(const Duration(seconds: 1))) &&
          order.createdAt.isBefore(end.add(const Duration(seconds: 1)));
    }).toList();
  }

  String _extractErrorMessage(Object error) {
    if (error is DioException) {
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.connectionError) {
        return 'Network error. Please check your connection.';
      }
      if (error.response?.statusCode == 404) {
        return 'Order history feature is not yet available on the server. '
            'Please ensure your backend is updated and migrations have been run.';
      }
      if (error.response?.statusCode == 500) {
        return 'Server error. The order history service may not be fully deployed yet.';
      }
      if (error.response?.data is Map) {
        final data = error.response!.data as Map;
        if (data['error'] != null && data['error']['message'] != null) {
          return data['error']['message'];
        }
      }
    }
    final errorStr = error.toString();
    if (errorStr.contains('connection')) {
      return 'Network error. Please check your connection.';
    }
    return 'Failed to load order history. Please try again.';
  }

  Future<void> _selectDateRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 1),
      lastDate: now,
      initialDateRange: _selectedDateRange,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
                  primary: const Color(0xFFFF6D00),
                ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDateRange = picked;
      });
      _loadOrders();
    }
  }

  void _clearDateRange() {
    setState(() {
      _selectedDateRange = null;
    });
    _loadOrders();
  }

  void _onStatusFilterChanged(String? status) {
    setState(() {
      _selectedStatus = status;
    });
    _loadOrders();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order History'),
        backgroundColor: const Color(0xFFFF6D00),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          _buildFilters(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status filter dropdown
          DropdownButtonFormField<String>(
            initialValue: _selectedStatus,
            decoration: InputDecoration(
              labelText: 'Filter by Status',
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            items: [
              const DropdownMenuItem<String>(
                value: null,
                child: Text('All Statuses'),
              ),
              ..._statusOptions.map(
                (status) => DropdownMenuItem<String>(
                  value: status,
                  child: Text(_formatStatus(status)),
                ),
              ),
            ],
            onChanged: _onStatusFilterChanged,
          ),
          const SizedBox(height: 8),
          // Date range filter
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _selectDateRange,
                  icon: const Icon(Icons.date_range, size: 18),
                  label: Text(
                    _selectedDateRange != null
                        ? '${_formatDate(_selectedDateRange!.start)} - ${_formatDate(_selectedDateRange!.end)}'
                        : 'Select Date Range',
                    style: const TextStyle(fontSize: 13),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFFF6D00),
                    side: const BorderSide(color: Color(0xFFFF6D00)),
                  ),
                ),
              ),
              if (_selectedDateRange != null) ...[
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _clearDateRange,
                  icon: const Icon(Icons.clear, size: 20),
                  tooltip: 'Clear date filter',
                  style: IconButton.styleFrom(
                    foregroundColor: Colors.grey[600],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
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
        ),
      );
    }

    if (_orders.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.receipt_long_outlined,
                  size: 64, color: Colors.grey[400]),
              const SizedBox(height: 16),
              Text(
                'No orders found',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.grey[600],
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                _selectedStatus != null || _selectedDateRange != null
                    ? 'Try adjusting your filters'
                    : 'Orders will appear here once customers place them',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadOrders,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: _orders.length + (_isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _orders.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return _buildOrderCard(_orders[index]);
        },
      ),
    );
  }

  Widget _buildOrderCard(OrderData order) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  order.orderRef,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                _buildStatusChip(order.status),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.table_bar, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  order.tableDisplayName,
                  style: TextStyle(color: Colors.grey[700], fontSize: 14),
                ),
                const Spacer(),
                Icon(Icons.access_time, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 4),
                Text(
                  _formatDateTime(order.createdAt),
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                ),
              ],
            ),
            if (order.items.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Divider(height: 1),
              const SizedBox(height: 8),
              ...order.items.take(3).map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${item.quantity}x ${item.itemName}',
                              style: const TextStyle(fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '₹${(item.itemPrice * item.quantity).toStringAsFixed(2)}',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey[700],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              if (order.items.length > 3)
                Text(
                  '+${order.items.length - 3} more items',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[500],
                    fontStyle: FontStyle.italic,
                  ),
                ),
            ],
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),
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
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    final (Color bgColor, Color textColor) = switch (status) {
      'pending' => (Colors.orange.shade50, Colors.orange.shade800),
      'accepted' => (Colors.blue.shade50, Colors.blue.shade800),
      'completed' => (Colors.green.shade50, Colors.green.shade800),
      'payment_received' => (Colors.teal.shade50, Colors.teal.shade800),
      'cancelled' => (Colors.red.shade50, Colors.red.shade800),
      _ => (Colors.grey.shade100, Colors.grey.shade800),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        _formatStatus(status),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }

  String _formatStatus(String status) {
    return switch (status) {
      'pending' => 'Pending',
      'accepted' => 'Accepted',
      'completed' => 'Completed',
      'payment_received' => 'Paid',
      'cancelled' => 'Cancelled',
      _ => status,
    };
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  String _formatDateTime(DateTime dateTime) {
    final date = _formatDate(dateTime);
    final hour = dateTime.hour.toString().padLeft(2, '0');
    final minute = dateTime.minute.toString().padLeft(2, '0');
    return '$date $hour:$minute';
  }
}
