import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
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
        final qrMode = restaurant['qrMode'] ?? restaurant['qr_mode'] ?? 'single';
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
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFF6D00),
            ),
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
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      if (data['error'] != null && data['error']['message'] != null) {
        return data['error']['message'];
      }
    }
    return 'An unexpected error occurred';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        title: const Text('QR Mode Settings'),
        backgroundColor: const Color(0xFFFF6D00),
        foregroundColor: Colors.white,
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
                  backgroundColor: const Color(0xFFFF6D00),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.qr_code_2, color: const Color(0xFFFF6D00)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'QR Code Mode',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  'Choose how QR codes work for your restaurant.',
                  style: TextStyle(color: Colors.grey[600]),
                ),
                const SizedBox(height: 20),
                SwitchListTile(
                  title: const Text(
                    'Multi-Table QR Mode',
                    style: TextStyle(fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(
                    _isMultiMode
                        ? 'Each table has its own QR code for ordering'
                        : 'Single QR code for the entire restaurant',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  value: _isMultiMode,
                  onChanged: _isSaving ? null : _onModeToggle,
                  activeColor: const Color(0xFFFF6D00),
                  contentPadding: EdgeInsets.zero,
                ),
                if (_isSaving)
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: LinearProgressIndicator(
                      color: Color(0xFFFF6D00),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          elevation: 1,
          color: Colors.blue[50],
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, color: Colors.blue[700], size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _isMultiMode
                        ? 'In multi-table mode, you can create individual QR codes for each table. Customers scan a table QR to place orders directly from their seat.'
                        : 'In single mode, your restaurant has one QR code that shows the full menu. Switch to multi-table mode to enable table-wise ordering.',
                    style: TextStyle(color: Colors.blue[800], fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
