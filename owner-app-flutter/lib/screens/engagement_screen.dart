import 'dart:math';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

class EngagementScreen extends StatefulWidget {
  const EngagementScreen({super.key});
  @override
  State<EngagementScreen> createState() => _EngagementScreenState();
}

class _EngagementScreenState extends State<EngagementScreen> {
  final _visit = TextEditingController();
  final _spend = TextEditingController();
  final _threshold = TextEditingController();
  final _expiry = TextEditingController();
  final _zone = TextEditingController();
  final _claim = TextEditingController();
  final _order = TextEditingController();
  final _refund = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _loading = true, _busy = false, _enabled = false;
  String _scheme = 'visits';
  String? _error, _message;
  Map<String, dynamic>? _data;
  String? _refundRequest, _refundFingerprint;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _visit,
      _spend,
      _threshold,
      _expiry,
      _zone,
      _claim,
      _order,
      _refund,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String _errorText(Object e) {
    if (e is DioException && e.response?.data is Map) {
      return (e.response?.data['error']?['message'] ?? 'Request failed')
          .toString();
    }
    return 'Could not connect. Please try again.';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await context.read<ApiService>().get(
        '/owner/engagement',
      );
      if (!mounted) return;
      final data = Map<String, dynamic>.from(response.data['data']);
      final s = data['settings'];
      if (s is Map) {
        _enabled = s['enabled'] == true;
        _scheme = s['scheme'];
        _visit.text = s['visitReward'];
        _spend.text = s['spendReward'];
        _threshold.text = ((s['thresholdCents'] as num) / 100).toStringAsFixed(
          2,
        );
        _expiry.text = '${s['expiryDays']}';
        _zone.text = s['timezone'];
      }
      setState(() {
        _data = data;
      });
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _action(Future<void> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _error = _errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String title, String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(title),
          content: Text(text),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirm'),
            ),
          ],
        ),
      ) ??
      false;
  Future<void> _save() => _action(() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    await context.read<ApiService>().put(
      '/owner/loyalty/settings',
      data: {
        'enabled': _enabled,
        'scheme': _scheme,
        'visitReward': _visit.text.trim(),
        'spendReward': _spend.text.trim(),
        'thresholdCents': (double.parse(_threshold.text) * 100).round(),
        'expiryDays': int.parse(_expiry.text),
        'timezone': _zone.text.trim(),
      },
    );
    if (mounted) setState(() => _message = 'Loyalty settings saved');
  });
  Future<void> _redeem() => _action(() async {
    final raw = _claim.text.trim(),
        code = raw.contains('.') ? raw.split('.').last : raw;
    final api = context.read<ApiService>();
    final preview = await api.post(
      '/owner/loyalty/claim',
      data: {'code': code},
    );
    if (!mounted) return;
    final reward = preview.data['data'];
    if (reward['status'] != 'available') {
      setState(() => _message = 'Reward ${reward['status']}');
      return;
    }
    if (!await _confirm('Redeem reward?', '${reward['reward']}')) return;
    await api.post('/owner/loyalty/redeem', data: {'code': code});
    if (!mounted) return;
    _claim.clear();
    await _load();
    if (mounted) setState(() => _message = 'Reward redeemed');
  });
  Future<void> _moderate(String order, String status) => _action(() async {
    await context.read<ApiService>().patch(
      '/owner/reviews/$order',
      data: {'status': status},
    );
    await _load();
  });
  String _uuid() {
    final r = Random.secure(), b = List.generate(16, (_) => r.nextInt(256));
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    final h = b.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
  }

  Future<void> _recordRefund() => _action(() async {
    final value = double.tryParse(_refund.text), order = _order.text.trim();
    if (value == null ||
        !value.isFinite ||
        value <= 0 ||
        !(RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(order) ||
            RegExp(r'^ORD-[A-Z0-9]{6}$').hasMatch(order))) {
      setState(
        () =>
            _error = 'Enter the order reference and a positive refunded amount',
      );
      return;
    }
    if (!await _confirm(
      'Record loyalty adjustment?',
      'INR ${value.toStringAsFixed(2)}. This records an already-completed refund; no money will be sent.',
    )) {
      return;
    }
    if (!mounted) return;
    final fingerprint = '$order:${(value * 100).round()}';
    if (_refundFingerprint != fingerprint) {
      _refundFingerprint = fingerprint;
      _refundRequest = _uuid();
    }
    await context.read<ApiService>().post(
      '/owner/loyalty/refunds',
      data: {
        'orderId': order,
        'amountCents': (value * 100).round(),
        'requestId': _refundRequest,
      },
    );
    if (!mounted) return;
    _refund.clear();
    _order.clear();
    _refundRequest = null;
    _refundFingerprint = null;
    await _load();
    if (mounted) setState(() => _message = 'Refund adjustment recorded');
  });
  Widget _field(
    TextEditingController c,
    String label, {
    bool number = false,
    int? max,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: c,
      maxLength: max,
      keyboardType: number
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      decoration: InputDecoration(labelText: label),
      validator: (value) {
        if (value == null || value.trim().isEmpty) return 'Required';
        if (number) {
          final v = double.tryParse(value);
          if (v == null || !v.isFinite || v <= 0) {
            return 'Enter a positive amount';
          }
        }
        if (c == _expiry &&
            (int.tryParse(value) == null || int.parse(value) > 365)) {
          return 'Use 1 to 365 days';
        }
        return null;
      },
    ),
  );
  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Guests & rewards'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _busy || _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
        bottom: const TabBar(
          tabs: [
            Tab(text: 'Loyalty'),
            Tab(text: 'Rewards'),
            Tab(text: 'Reviews'),
          ],
        ),
      ),
      body: Column(
        children: [
          if (_busy) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if (_message != null)
            Padding(padding: const EdgeInsets.all(12), child: Text(_message!)),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _data == null
                ? Center(
                    child: TextButton(
                      onPressed: _load,
                      child: const Text('Try again'),
                    ),
                  )
                : AbsorbPointer(
                    absorbing: _busy,
                    child: TabBarView(
                      children: [_settings(), _rewards(), _reviews()],
                    ),
                  ),
          ),
        ],
      ),
    ),
  );
  Widget _settings() => _data!['loyaltyEnabled'] != true
      ? const Center(child: Text('Loyalty is not enabled on this server'))
      : Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Loyalty program'),
                value: _enabled,
                onChanged: (v) => setState(() => _enabled = v),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _scheme,
                decoration: const InputDecoration(labelText: 'Reward scheme'),
                items: const [
                  DropdownMenuItem(
                    value: 'visits',
                    child: Text('7 paid visit dates'),
                  ),
                  DropdownMenuItem(value: 'spend', child: Text('Daily spend')),
                  DropdownMenuItem(value: 'both', child: Text('Both')),
                ],
                onChanged: (v) => setState(() => _scheme = v!),
              ),
              const SizedBox(height: 20),
              _field(_visit, '7-day reward', max: 160),
              _field(_spend, 'Daily spend reward', max: 160),
              _field(_threshold, 'Daily spend threshold (INR)', number: true),
              _field(_expiry, 'Reward expiry (days)', number: true),
              _field(_zone, 'Restaurant timezone', max: 80),
              FilledButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.save_outlined),
                label: const Text('Save settings'),
              ),
            ],
          ),
        );
  Widget _rewards() => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      if (_data!['loyaltyEnabled'] == true) ...[
        TextField(
          controller: _claim,
          decoration: const InputDecoration(labelText: 'Customer claim code'),
          autocorrect: false,
          enableSuggestions: false,
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _redeem,
          icon: const Icon(Icons.redeem),
          label: const Text('Check reward'),
        ),
        const SizedBox(height: 24),
        ...(_data!['rewards'] as List).map(
          (r) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.card_giftcard),
            title: Text('${r['reward']}'),
            subtitle: Text(
              r['refund_review'] == true
                  ? 'Refund adjustment needs review'
                  : r['redeemed_at'] != null
                  ? 'Redeemed'
                  : r['revoked'] == true
                  ? 'Revoked'
                  : DateTime.tryParse(
                          '${r['expires_at']}',
                        )?.isBefore(DateTime.now()) ==
                        true
                  ? 'Expired'
                  : 'Available',
            ),
          ),
        ),
        if ((_data!['rewards'] as List).isEmpty)
          const Text('No rewards earned yet'),
        const Divider(height: 40),
        ExpansionTile(
          title: const Text('Refund accounting'),
          tilePadding: EdgeInsets.zero,
          children: [
            TextField(
              controller: _order,
              decoration: const InputDecoration(
                labelText: 'Order reference or ID',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _refund,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Already-refunded amount (INR)',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _recordRefund,
              child: const Text('Record adjustment'),
            ),
          ],
        ),
      ] else
        const Text('Loyalty is not enabled on this server'),
    ],
  );
  Widget _reviews() => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      if (_data!['reviewsEnabled'] != true)
        const Text('Reviews are not enabled on this server')
      else if ((_data!['reviews'] as List).isEmpty)
        const Text('No guest reviews yet')
      else
        ...(_data!['reviews'] as List).map(
          (r) => Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${r['rating']}/5  -  ${r['status']}',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                Text('${r['body']}'),
                Wrap(
                  spacing: 12,
                  children: [
                    if (r['status'] != 'published')
                      TextButton.icon(
                        onPressed: () => _moderate(r['order_id'], 'published'),
                        icon: const Icon(Icons.check),
                        label: const Text('Publish'),
                      ),
                    if (r['status'] != 'hidden')
                      TextButton.icon(
                        onPressed: () => _moderate(r['order_id'], 'hidden'),
                        icon: const Icon(Icons.visibility_off_outlined),
                        label: const Text('Hide'),
                      ),
                  ],
                ),
                const Divider(),
              ],
            ),
          ),
        ),
    ],
  );
}
