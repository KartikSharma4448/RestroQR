import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/earnings_model.dart';
import '../services/api_service.dart';
import '../services/owner_api_service.dart';

/// Earnings dashboard screen displaying monthly summary and breakdown views.
/// Validates: Requirements 8.1, 8.2, 8.3
class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  late OwnerApiService _ownerApiService;

  // State
  bool _isLoadingSummary = true;
  bool _isLoadingBreakdown = true;
  String? _error;

  EarningsSummary? _summary;
  List<EarningsBreakdown> _breakdown = [];

  // Current selected month (format: yyyy-MM)
  late String _selectedMonth;

  // Breakdown period toggle: daily, weekly, monthly
  String _selectedPeriod = 'daily';

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
    await Future.wait([
      _loadSummary(),
      _loadBreakdown(),
    ]);
  }

  Future<void> _loadSummary() async {
    setState(() {
      _isLoadingSummary = true;
      _error = null;
    });

    try {
      final summary = await _ownerApiService.getSummary(month: _selectedMonth);
      setState(() {
        _summary = summary;
        _isLoadingSummary = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = _extractError(e);
        _isLoadingSummary = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load earnings summary.';
        _isLoadingSummary = false;
      });
    }
  }

  Future<void> _loadBreakdown() async {
    setState(() {
      _isLoadingBreakdown = true;
    });

    try {
      final breakdown = await _ownerApiService.getBreakdown(
        period: _selectedPeriod,
        month: _selectedMonth,
      );
      setState(() {
        _breakdown = breakdown;
        _isLoadingBreakdown = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = _extractError(e);
        _isLoadingBreakdown = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load earnings breakdown.';
        _isLoadingBreakdown = false;
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
    return 'An unexpected error occurred.';
  }

  void _onPeriodChanged(String period) {
    setState(() {
      _selectedPeriod = period;
    });
    _loadBreakdown();
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
        title: const Text('Earnings'),
        backgroundColor: const Color(0xFFFF6D00),
        foregroundColor: Colors.white,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_error != null && _summary == null) {
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
          _buildSummaryCard(),
          const SizedBox(height: 24),
          _buildPeriodToggle(),
          const SizedBox(height: 16),
          _buildBreakdownList(),
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

  Widget _buildSummaryCard() {
    if (_isLoadingSummary) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Monthly Summary',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryTile(
                    icon: Icons.receipt_long,
                    label: 'Total Orders',
                    value: '${_summary?.totalOrders ?? 0}',
                    color: Colors.blue,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildSummaryTile(
                    icon: Icons.currency_rupee,
                    label: 'Total Revenue',
                    value: _formatCurrency(_summary?.totalRevenue ?? 0),
                    color: Colors.green,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryTile({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(color: Colors.grey[600], fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodToggle() {
    return Row(
      children: [
        Text(
          'Breakdown',
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

  Widget _buildBreakdownList() {
    if (_isLoadingBreakdown) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_breakdown.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Center(
            child: Column(
              children: [
                Icon(Icons.bar_chart, size: 48, color: Colors.grey[400]),
                const SizedBox(height: 12),
                Text(
                  'No earnings data for this period.',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      children: _breakdown.map((entry) => _buildBreakdownItem(entry)).toList(),
    );
  }

  Widget _buildBreakdownItem(EarningsBreakdown entry) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFFF6D00).withValues(alpha: 0.1),
          child: const Icon(Icons.bar_chart, color: Color(0xFFFF6D00)),
        ),
        title: Text(
          entry.date,
          style: const TextStyle(fontWeight: FontWeight.w500),
        ),
        subtitle: Text('${entry.totalOrders} orders'),
        trailing: Text(
          _formatCurrency(entry.totalRevenue),
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.green,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}
