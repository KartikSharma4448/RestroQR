import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/notification_handler.dart';

class WaiterAlarmHost extends StatefulWidget {
  final Widget child;
  final ApiService api;
  final bool enabled;
  final NotificationHandler? notifications;
  const WaiterAlarmHost({
    super.key,
    required this.child,
    required this.api,
    required this.enabled,
    this.notifications,
  });
  @override
  State<WaiterAlarmHost> createState() => _WaiterAlarmHostState();
}

class _WaiterAlarmHostState extends State<WaiterAlarmHost>
    with WidgetsBindingObserver {
  static const _sound = MethodChannel('restroqr/waiter_alarm');
  Timer? _timer;
  List<Map<String, dynamic>> _calls = [];
  final _muted = <String>{};
  bool _foreground = true;
  bool _loading = false;
  bool _closing = false;
  int _revision = 0;
  String? _ringingFor;
  String? _error;
  late final VoidCallback _onPush;
  @override
  void initState() {
    super.initState();
    _foreground =
        WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
    WidgetsBinding.instance.addObserver(this);
    _onPush = () => unawaited(_refresh());
    widget.notifications?.onWaiterCall = _onPush;
    if (widget.enabled) _startPolling();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_refresh());
    });
  }

  @override
  void didUpdateWidget(covariant WaiterAlarmHost old) {
    super.didUpdateWidget(old);
    if (old.enabled != widget.enabled) {
      _revision++;
      _calls = [];
      _muted.clear();
      _error = null;
      _closing = false;
      if (widget.enabled) {
        _startPolling();
      } else {
        _timer?.cancel();
        _timer = null;
      }
      _syncSound();
      if (widget.enabled) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) unawaited(_refresh());
        });
      }
    }
  }

  void _startPolling() {
    _timer ??= Timer.periodic(
      const Duration(seconds: 10),
      (_) => unawaited(_refresh()),
    );
  }

  Future<void> _audio(String action) async {
    try {
      await _sound.invokeMethod<void>(action);
    } catch (_) {
      /* Visual alert remains usable if the device cannot play audio. */
    }
  }

  void _syncSound() {
    final id = widget.enabled && _foreground && _calls.isNotEmpty
        ? _calls.first['id'] as String
        : null;
    final desired = id != null && !_muted.contains(id) ? id : null;
    if (desired == _ringingFor) return;
    _ringingFor = desired;
    unawaited(_audio(desired == null ? 'stop' : 'start'));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    _syncSound();
    if (_foreground) unawaited(_refresh());
  }

  Future<void> _refresh() async {
    if (!mounted || !widget.enabled || !_foreground || _loading || _closing) {
      return;
    }
    _loading = true;
    final revision = _revision;
    try {
      final response = await widget.api.get('/owner/waiter-calls');
      final calls = (response.data['data']['calls'] as List)
          .map((row) => Map<String, dynamic>.from(row))
          .toList();
      if (!mounted || !widget.enabled || revision != _revision) return;
      if (_calls.isEmpty && calls.isNotEmpty) {
        FocusManager.instance.primaryFocus?.unfocus();
      }
      setState(() => _calls = calls);
      _muted.removeWhere((id) => !calls.any((row) => row['id'] == id));
      _syncSound();
    } catch (_) {
      /* Durable calls will be retried on the next foreground refresh. */
    } finally {
      _loading = false;
    }
  }

  Future<void> _confirm() async {
    if (_closing || _calls.isEmpty) return;
    final id = _calls.first['id'] as String;
    final revision = ++_revision;
    _muted.add(id);
    _syncSound();
    setState(() {
      _closing = true;
      _error = null;
    });
    try {
      await widget.api
          .patch('/owner/waiter-calls/$id', data: {'status': 'resolved'})
          .timeout(const Duration(seconds: 10));
      if (!mounted || revision != _revision) return;
      setState(() => _calls.removeWhere((row) => row['id'] == id));
      _syncSound();
    } catch (_) {
      if (mounted && revision == _revision) {
        setState(
          () => _error =
              'Could not close the request. Check your connection and tap OK again.',
        );
      }
    } finally {
      if (mounted && revision == _revision) setState(() => _closing = false);
    }
  }

  @override
  void dispose() {
    _revision++;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    if (identical(widget.notifications?.onWaiterCall, _onPush)) {
      widget.notifications?.onWaiterCall = null;
    }
    unawaited(_audio('stop'));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.enabled && _calls.isNotEmpty;
    return Stack(
      fit: StackFit.expand,
      children: [
        ExcludeSemantics(excluding: active, child: widget.child),
        if (active)
          Positioned.fill(
            child: Material(
              color: const Color(0xFFF4F8F7),
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(28),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.notifications_active_rounded,
                            size: 88,
                            color: Color(0xFF087F73),
                          ),
                          const SizedBox(height: 28),
                          const Text(
                            'Waiter requested',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF153B38),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _calls.first['tableName'] as String? ?? 'Table',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF153B38),
                            ),
                          ),
                          if (_calls.length > 1)
                            Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(
                                '${_calls.length - 1} more waiting',
                                style: const TextStyle(fontSize: 16),
                              ),
                            ),
                          if (_error != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 20),
                              child: Text(
                                _error!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Color(0xFFB42334),
                                ),
                              ),
                            ),
                          const SizedBox(height: 36),
                          SizedBox(
                            width: 280,
                            height: 56,
                            child: FilledButton(
                              onPressed: _closing ? null : _confirm,
                              child: Text(
                                _closing ? 'Closing...' : 'OK',
                                style: const TextStyle(fontSize: 18),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
