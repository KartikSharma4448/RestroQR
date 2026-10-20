import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../ui/app_theme.dart';
import '../ui/owner_widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';
import '../services/owner_api_service.dart';

class QrModeSettingsScreen extends StatefulWidget {
  const QrModeSettingsScreen({super.key});

  @override
  State<QrModeSettingsScreen> createState() => _QrModeSettingsScreenState();
}

class _QrModeSettingsScreenState extends State<QrModeSettingsScreen> {
  bool _isMultiMode = false;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _error;

  late final OwnerApiService _ownerApiService;

  @override
  void initState() {
    super.initState();
    _ownerApiService = OwnerApiService(context.read<ApiService>());
    _loadCurrentMode();
  }

  Future<void> _loadCurrentMode() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.get('/owner/restaurant');
      final data = response.data;

      if (data['success'] == true && data['data'] != null) {
        final restaurant = data['data'] is Map<String, dynamic>
            ? (data['data']['restaurant'] ?? data['data'])
            : data['data'];
        final qrMode =
            restaurant['qrMode'] ?? restaurant['qr_mode'] ?? 'single';
        setState(() {
          _isMultiMode = qrMode == 'multi';
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load restaurant settings';
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      setState(() {
        _error = _extractError(e);
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Network error. Please check your connection.';
        _isLoading = false;
      });
    }
  }

  Future<void> _onModeToggle(bool newValue) async {
    final targetMode = newValue ? 'multi' : 'single';
    final confirmed = await _showConfirmationDialog(targetMode);
    if (confirmed != true) return;

    setState(() => _isSaving = true);

    try {
      await _ownerApiService.updateQrMode(qrMode: targetMode);
      setState(() {
        _isMultiMode = newValue;
        _isSaving = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'QR mode switched to ${targetMode == 'multi' ? 'Multi-Table' : 'Single'}',
            ),
            backgroundColor: Colors.green,
          ),
        );
      }
    } on DioException catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Network error. Please try again.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<bool?> _showConfirmationDialog(String targetMode) {
    final isMulti = targetMode == 'multi';
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Switch to ${isMulti ? 'Multi-Table' : 'Single'} QR Mode?'),
        content: Text(
          isMulti
              ? 'This will enable table-wise QR codes. Each table will have its own QR code for ordering.'
              : 'This will disable table-wise QR codes and revert to a single restaurant QR code. Your table data will be preserved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  String _extractError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Network error. Please check your connection.';
    }
    if (e.response?.statusCode == 404) {
      return 'QR mode settings are not yet available on the server. '
          'Please ensure your backend is updated and migrations have been run.';
    }
    if (e.response?.statusCode == 500) {
      return 'Server error. The settings service may not be fully deployed yet.';
    }
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      if (data['error'] != null && data['error']['message'] != null) {
        return data['error']['message'];
      }
    }
    return 'An unexpected error occurred. Please try again.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: const Text('QR Mode Settings'),
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
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[700], fontSize: 16),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _loadCurrentMode,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.accent,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SectionHeading('Ordering'),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Table ordering'),
          subtitle: Text(_isMultiMode ? 'Per-table QR' : 'Single menu QR'),
          value: _isMultiMode,
          onChanged: _isSaving ? null : _onModeToggle,
        ),
        if (_isSaving) const LinearProgressIndicator(),
        const SizedBox(height: 20),
        const Divider(),
        if (_isMultiMode)
          ActionRow(
            icon: Icons.table_bar_outlined,
            title: 'Tables',
            onTap: () => context.push('/tables'),
          ),
      ],
    );
  }
}
