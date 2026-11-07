import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/investment_model.dart';
import '../services/api_service.dart';
import '../services/owner_api_service.dart';
import '../ui/app_theme.dart';

/// Owner's investment (expense) list for a month. Each entry is a topic and a
/// price. The month total is calculated automatically and subtracted from the
/// month's paid-order revenue to show profit or loss.
class InvestmentsScreen extends StatefulWidget {
  final String? initialMonth;
  const InvestmentsScreen({super.key, this.initialMonth});

  @override
  State<InvestmentsScreen> createState() => _InvestmentsScreenState();
}

class _InvestmentsScreenState extends State<InvestmentsScreen> {
  late final OwnerApiService _api;
  late String _month;
  InvestmentReport? _report;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    _api = OwnerApiService(context.read<ApiService>());
    _month =
        widget.initialMonth ?? DateFormat('yyyy-MM').format(DateTime.now());
    _load();
  }

  String _errorText(Object e) {
    if (e is DioException) {
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.connectionError) {
        return 'Network error. Please check your connection.';
      }
      // Never show raw server or route errors to the owner.
      final status = e.response?.statusCode ?? 0;
      if (status == 404 || status == 405 || status >= 500) {
        return 'Investment is not available right now. '
            'Please try again in a little while.';
      }
      final data = e.response?.data;
      if (status >= 400 && data is Map && data['error'] is Map) {
        // Validation messages (for example a bad price) are written for owners.
        final message = data['error']['message'];
        if (message != null) return message.toString();
      }
    }
    return 'Something went wrong. Please try again.';
  }

  Future<void> _load() async {
    final id = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final report = await _api.getInvestments(month: _month);
      if (!mounted || id != _requestId) return;
      setState(() {
        _report = report;
        _loading = false;
      });
    } catch (e) {
      if (!mounted || id != _requestId) return;
      setState(() {
        _error = _errorText(e);
        _loading = false;
      });
    }
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_errorText(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickMonth() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.parse('$_month-01'),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialEntryMode: DatePickerEntryMode.calendarOnly,
      helpText: 'Select month',
    );
    if (!mounted || picked == null) return;
    final next = DateFormat('yyyy-MM').format(picked);
    if (next == _month) return;
    setState(() => _month = next);
    _load();
  }

  Future<void> _openEditor([InvestmentItem? existing]) async {
    final input = await showDialog<_InvestmentInput>(
      context: context,
      builder: (_) => _InvestmentDialog(existing: existing, month: _month),
    );
    if (input == null || !mounted) return;
    await _run(() async {
      if (existing == null) {
        await _api.addInvestment(
          topic: input.topic,
          amount: input.amount,
          spentOn: input.spentOn,
        );
      } else {
        await _api.updateInvestment(
          id: existing.id,
          topic: input.topic,
          amount: input.amount,
          spentOn: input.spentOn,
        );
      }
      await _load();
    });
  }

  Future<void> _delete(InvestmentItem item) async {
    final confirmed =
        await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete this entry?'),
            content: Text('${item.topic} - ${_money(item.amount)}'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    await _run(() async {
      await _api.deleteInvestment(item.id);
      await _load();
    });
  }

  String _money(double value) => '₹${value.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Investment')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
      ),
      body: Column(
        children: [
          if (_busy) const LinearProgressIndicator(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                children: [
                  _monthSelector(),
                  const SizedBox(height: 16),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_error != null)
                    _errorView()
                  else ...[
                    _summary(_report!),
                    const SizedBox(height: 20),
                    Text(
                      'Investment list',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    if (_report!.items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text(
                            'No investment added for this month.\nTap Add to enter topic and price.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: AppColors.muted),
                          ),
                        ),
                      )
                    else
                      ..._report!.items.map(_row),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _monthSelector() => InkWell(
    onTap: _pickMonth,
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
            DateFormat('MMMM yyyy').format(DateTime.parse('$_month-01')),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          const Icon(Icons.calendar_month, color: AppColors.accent),
        ],
      ),
    ),
  );

  Widget _errorView() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Column(
      children: [
        Text(_error!, textAlign: TextAlign.center),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh),
          label: const Text('Retry'),
        ),
      ],
    ),
  );

  Widget _summary(InvestmentReport report) {
    final profit = report.netProfit >= 0;
    final color = profit ? Colors.green.shade700 : Colors.red.shade700;
    Widget line(
      String label,
      String value, {
      Color? valueColor,
      bool bold = false,
    }) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: AppColors.muted)),
          ),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontWeight: bold ? FontWeight.bold : FontWeight.w500,
              fontSize: bold ? 18 : 15,
            ),
          ),
        ],
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            line(
              'Revenue (${report.paidOrders} paid orders)',
              _money(report.totalRevenue),
            ),
            line('Total investment', '- ${_money(report.totalInvestment)}'),
            const Divider(height: 24),
            line(
              profit ? 'Net profit' : 'Net loss',
              _money(report.netProfit.abs()),
              valueColor: color,
              bold: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(InvestmentItem item) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      title: Text(
        item.topic,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: Text(_prettyDate(item.spentOn)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _money(item.amount),
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          PopupMenuButton<String>(
            tooltip: 'More actions for ${item.topic}',
            onSelected: (value) {
              if (value == 'edit') _openEditor(item);
              if (value == 'delete') _delete(item);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('Edit')),
              PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
        ],
      ),
    ),
  );

  String _prettyDate(String value) {
    final date = DateTime.tryParse(value);
    return date == null ? value : DateFormat('d MMM yyyy').format(date);
  }
}

class _InvestmentInput {
  final String topic;
  final String amount;
  final String spentOn;
  const _InvestmentInput(this.topic, this.amount, this.spentOn);
}

class _InvestmentDialog extends StatefulWidget {
  final InvestmentItem? existing;
  final String month;
  const _InvestmentDialog({required this.existing, required this.month});

  @override
  State<_InvestmentDialog> createState() => _InvestmentDialogState();
}

class _InvestmentDialogState extends State<_InvestmentDialog> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _topic;
  late final TextEditingController _amount;
  late DateTime _date;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _topic = TextEditingController(text: existing?.topic ?? '');
    _amount = TextEditingController(
      text: existing == null ? '' : existing.amount.toStringAsFixed(2),
    );
    final monthStart = DateTime.parse('${widget.month}-01');
    final now = DateTime.now();
    _date =
        DateTime.tryParse(existing?.spentOn ?? '') ??
        (now.year == monthStart.year && now.month == monthStart.month
            ? DateTime(now.year, now.month, now.day)
            : monthStart);
  }

  @override
  void dispose() {
    _topic.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
    if (picked != null) setState(() => _date = picked);
  }

  void _save() {
    if (!(_form.currentState?.validate() ?? false)) return;
    Navigator.pop(
      context,
      _InvestmentInput(
        _topic.text.trim(),
        _amount.text.trim(),
        DateFormat('yyyy-MM-dd').format(_date),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.existing == null ? 'Add investment' : 'Edit investment',
      ),
      content: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _topic,
                maxLength: 100,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Topic',
                  hintText: 'e.g. Masale, Electricity bill, Drinks',
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? 'Enter a topic'
                    : null,
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Price (INR)',
                  prefixText: '₹ ',
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (!RegExp(r'^\d{1,9}(\.\d{1,2})?$').hasMatch(text) ||
                      (double.tryParse(text) ?? 0) <= 0) {
                    return 'Enter a price above 0 (max 2 decimals)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _pickDate,
                icon: const Icon(Icons.event),
                label: Text(DateFormat('d MMM yyyy').format(_date)),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(onPressed: _save, child: const Text('Save')),
      ],
    );
  }
}
