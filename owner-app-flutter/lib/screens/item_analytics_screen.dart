import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/earnings_model.dart';
import '../services/api_service.dart';
import '../services/owner_api_service.dart';

/// Per-item analytics screen displaying a ranked list of food items
/// sorted by total quantity sold (descending), with revenue per item.
/// Validates: Requirements 9.1, 9.2, 9.3, 9.4
class ItemAnalyticsScreen extends StatefulWidget {
  const ItemAnalyticsScreen({super.key});

  @override
  State<ItemAnalyticsScreen> createState() => _ItemAnalyticsScreenState();
}

class _ItemAnalyticsScreenState extends State<ItemAnalyticsScreen> {
  late OwnerApiService _ownerApiService;

  // State
  bool _isLoading = true;
  String? _error;

  List<ItemAnalytics> _items = [];

  // Current selected month (format: yyyy-MM)
  late String _selectedMonth;

  // Period filter: daily, weekly, monthly
  String _selectedPeriod = 'monthly';

  final List<String> _periods = ['daily', 'weekly', 'monthly'];

  @override
  void initState() {
    super.initState();
    _selectedMonth = DateFormat('yyyy-MM').format(DateTime.now());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final apiService = context.read<ApiService>();
    _ownerApiService = OwnerApiService(apiService);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final items = await _ownerApiService.getItemAnalytics(
        period: _selectedPeriod,
        month: _selectedMonth,
      );
      setState(() {
        _items = items;
        _isLoading = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = _extractError(e);
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load item analytics.';
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
    if (e.response?.statusCode == 404) {
      return 'Analytics feature is not yet available on the server. '
          'Please ensure your backend is updated and migrations have been run.';
    }
    if (e.response?.statusCode == 500) {
      return 'Server error. The analytics service may not be fully deployed yet.';
    }
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      if (data['error'] != null && data['error']['message'] != null) {
        return data['error']['message'];
      }
    }
    return 'An unexpected error occurred. Please try again.';
  }

  void _onPeriodChanged(String period) {
    setState(() {
      _selectedPeriod = period;
    });
    _loadData();
  }

  Future<void> _selectMonth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse('$_selectedMonth-01'),
      firstDate: DateTime(2020),
      lastDate: now,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
      helpText: 'Select month',
    );

    if (picked != null) {
      final newMonth = DateFormat('yyyy-MM').format(picked);
      if (newMonth != _selectedMonth) {
        setState(() {
          _selectedMonth = newMonth;
        });
        _loadData();
      }
    }
  }

  String _formatCurrency(double amount) {
    return '₹${amount.toStringAsFixed(2)}';
  }

  String _formatMonth(String month) {
    final date = DateTime.parse('$month-01');
    return DateFormat('MMMM yyyy').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Item Analytics'),
        backgroundColor: const Color(0xFFFF6D00),
        foregroundColor: Colors.white,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null && _items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loadData,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildMonthSelector(),
          const SizedBox(height: 16),
          _buildPeriodToggle(),
          const SizedBox(height: 16),
          _buildItemList(),
        ],
      ),
    );
  }

  Widget _buildMonthSelector() {
    return InkWell(
      onTap: _selectMonth,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[300]!),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _formatMonth(_selectedMonth),
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w600),
            ),
            const Icon(Icons.calendar_month, color: Color(0xFFFF6D00)),
          ],
        ),
      ),
    );
  }

  Widget _buildPeriodToggle() {
    return Row(
      children: [
        Text(
          'Period',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const Spacer(),
        SegmentedButton<String>(
          segments: _periods
              .map(
                (p) => ButtonSegment(
                  value: p,
                  label: Text(
                    p[0].toUpperCase() + p.substring(1),
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              )
              .toList(),
          selected: {_selectedPeriod},
          onSelectionChanged: (selected) {
            _onPeriodChanged(selected.first);
          },
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
          ),
        ),
      ],
    );
  }

  Widget _buildItemList() {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_items.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Center(
            child: Column(
              children: [
                Icon(Icons.restaurant_menu, size: 48, color: Colors.grey[400]),
                const SizedBox(height: 12),
                Text(
                  'No item data for this period.',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      children: List.generate(_items.length, (index) {
        return _buildItemCard(_items[index], index + 1);
      }),
    );
  }

  Widget _buildItemCard(ItemAnalytics item, int rank) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getRankColor(rank).withValues(alpha: 0.1),
          child: Text(
            '#$rank',
            style: TextStyle(
              color: _getRankColor(rank),
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
        ),
        title: Text(
          item.itemName,
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Text('${item.totalQuantity} sold'),
        trailing: Text(
          _formatCurrency(item.totalRevenue),
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.green,
            fontSize: 15,
          ),
        ),
      ),
    );
  }

  Color _getRankColor(int rank) {
    switch (rank) {
      case 1:
        return Colors.amber[700]!;
      case 2:
        return Colors.blueGrey[600]!;
      case 3:
        return Colors.brown[400]!;
      default:
        return const Color(0xFFFF6D00);
    }
  }
}
