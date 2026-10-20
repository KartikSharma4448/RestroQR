import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../ui/app_theme.dart';
import '../ui/owner_widgets.dart';
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
  String? _summaryError;
  String? _breakdownError;
  int _summaryRequestId = 0;
  int _breakdownRequestId = 0;

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
    await Future.wait([_loadSummary(), _loadBreakdown()]);
  }

  Future<void> _loadSummary() async {
    if (!mounted) return;
    final requestId = ++_summaryRequestId;
    setState(() {
      _isLoadingSummary = true;
      _summaryError = null;
      _summary = null;
    });

    try {
      final summary = await _ownerApiService.getSummary(month: _selectedMonth);
      if (!mounted || requestId != _summaryRequestId) return;
      setState(() {
        _summary = summary;
        _isLoadingSummary = false;
      });
    } on DioException catch (e) {
      if (!mounted || requestId != _summaryRequestId) return;
      setState(() {
        _summaryError = _extractError(e);
        _isLoadingSummary = false;
      });
    } catch (e) {
      if (!mounted || requestId != _summaryRequestId) return;
      setState(() {
        _summaryError = 'Failed to load earnings summary.';
        _isLoadingSummary = false;
      });
    }
  }

  Future<void> _loadBreakdown() async {
    if (!mounted) return;
    final requestId = ++_breakdownRequestId;
    setState(() {
      _isLoadingBreakdown = true;
      _breakdownError = null;
      _breakdown = [];
    });

    try {
      final breakdown = await _ownerApiService.getBreakdown(
        period: _selectedPeriod,
        month: _selectedMonth,
      );
      if (!mounted || requestId != _breakdownRequestId) return;
      setState(() {
        _breakdown = breakdown;
        _isLoadingBreakdown = false;
      });
    } on DioException catch (e) {
      if (!mounted || requestId != _breakdownRequestId) return;
      setState(() {
        _breakdownError = _extractError(e);
        _isLoadingBreakdown = false;
      });
    } catch (e) {
      if (!mounted || requestId != _breakdownRequestId) return;
      setState(() {
        _breakdownError = 'Failed to load earnings breakdown.';
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
    if (e.response?.statusCode == 404) {
      return 'Earnings feature is not yet available on the server. '
          'Please ensure your backend is updated and migrations have been run.';
    }
    if (e.response?.statusCode == 500) {
      return 'Server error. The earnings service may not be fully deployed yet.';
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

    if (mounted && picked != null) {
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
        automaticallyImplyLeading: false,
        title: const Text('Revenue'),
      ),
      body: _buildBody(),
      bottomNavigationBar: const OwnerNavigation(selected: 3),
    );
  }

  Widget _buildBody() {
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
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const Icon(Icons.calendar_month, color: AppColors.accent),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard() {
    if (_isLoadingSummary) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_summaryError != null) return _buildError(_summaryError!, _loadSummary);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Revenue received',
            style: TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 8),
          Text(
            _formatCurrency(_summary?.totalRevenue ?? 0),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(
                Icons.receipt_long_outlined,
                color: AppColors.muted,
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${_summary?.totalOrders ?? 0} paid orders',
                  style: const TextStyle(color: AppColors.muted),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(),
        ],
      ),
    );
  }

  Widget _buildPeriodToggle() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('Breakdown', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      SizedBox(
        width: double.infinity,
        child: SegmentedButton<String>(
          showSelectedIcon: false,
          segments: _periods
              .map(
                (period) => ButtonSegment(
                  value: period,
                  label: Text(
                    {
                      'daily': 'Day',
                      'weekly': 'Week',
                      'monthly': 'Month',
                    }[period]!,
                  ),
                ),
              )
              .toList(),
          selected: {_selectedPeriod},
          onSelectionChanged: (selection) => _onPeriodChanged(selection.first),
        ),
      ),
    ],
  );

  Widget _buildBreakdownList() {
    if (_isLoadingBreakdown) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_breakdownError != null) {
      return _buildError(_breakdownError!, _loadBreakdown);
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

  Widget _buildError(String message, Future<void> Function() retry) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Column(
      children: [
        Text(message, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: retry,
          icon: const Icon(Icons.refresh),
          label: const Text('Retry'),
        ),
      ],
    ),
  );

  Widget _buildBreakdownItem(EarningsBreakdown entry) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppColors.accent.withValues(alpha: 0.1),
          child: const Icon(Icons.bar_chart, color: AppColors.accent),
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
