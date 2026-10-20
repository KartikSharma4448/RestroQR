import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../ui/app_theme.dart';
import '../ui/owner_widgets.dart';
import 'package:provider/provider.dart';

import '../models/table_model.dart';
import '../services/api_service.dart';
import '../services/owner_api_service.dart';
import '../services/qr_save_service.dart';

/// Screen for managing restaurant tables (add, edit, delete, download QR).
/// Only accessible when the restaurant's qr_mode is 'multi'.
class TablesScreen extends StatefulWidget {
  const TablesScreen({super.key});

  @override
  State<TablesScreen> createState() => _TablesScreenState();
}

class _TablesScreenState extends State<TablesScreen> {
  late final OwnerApiService _ownerApiService;
  List<TableData> _tables = [];
  bool _isLoading = true;
  String? _error;
  final Set<String> _savingQr = {};

  @override
  void initState() {
    super.initState();
    _ownerApiService = OwnerApiService(context.read<ApiService>());
    _loadTables();
  }

  Future<void> _loadTables() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final tables = await _ownerApiService.listTables();
      setState(() {
        _tables = tables;
        _isLoading = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = _extractError(e);
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Error: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  Future<void> _addTable() async {
    final displayName = await _showNameDialog(title: 'Add Table');
    if (displayName == null || displayName.trim().isEmpty) return;

    setState(() => _isLoading = true);
    try {
      await _ownerApiService.createTable(displayName: displayName.trim());
      await _loadTables();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  Future<void> _editTable(TableData table) async {
    final displayName = await _showNameDialog(
      title: 'Edit Table Name',
      initialValue: table.displayName,
    );
    if (displayName == null ||
        displayName.trim().isEmpty ||
        displayName.trim() == table.displayName) {
      return;
    }

    setState(() => _isLoading = true);
    try {
      await _ownerApiService.updateTable(
        tableId: table.id,
        displayName: displayName.trim(),
      );
      await _loadTables();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteTable(TableData table) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Table'),
        content: Text(
          'Are you sure you want to delete "${table.displayName}"? '
          'The associated QR code will be invalidated.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _isLoading = true);
    try {
      await _ownerApiService.deleteTable(tableId: table.id);
      await _loadTables();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  Future<void> _downloadQr(TableData table) async {
    if (_savingQr.contains(table.id)) return;
    setState(() => _savingQr.add(table.id));
    try {
      final Uint8List qrBytes = await _ownerApiService.downloadQr(
        tableId: table.id,
      );

      if (!mounted) return;
      final message = await QrSaveService.save(qrBytes, table.displayName);
      if (message == null) return;

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.green.shade700,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download QR code: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingQr.remove(table.id));
    }
  }

  Future<String?> _showNameDialog({
    required String title,
    String? initialValue,
  }) async {
    final controller = TextEditingController(text: initialValue);
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Display Name',
            hintText: 'e.g., Table 5, Patio 2',
            border: OutlineInputBorder(),
          ),
          maxLength: 50,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(null),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            style: FilledButton.styleFrom(backgroundColor: AppColors.accent),
            child: const Text('Save'),
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
      return 'Could not reach the tables service. '
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tables')),
      floatingActionButton: FloatingActionButton(
        onPressed: _addTable,
        backgroundColor: AppColors.accent,
        child: const Icon(Icons.add, color: Colors.white),
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
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red[300]),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: _loadTables, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_tables.isEmpty) {
      return OwnerEmptyState(
        icon: Icons.table_bar_outlined,
        title: 'No tables yet',
        action: 'Add table',
        onAction: _addTable,
      );
    }

    return RefreshIndicator(
      onRefresh: _loadTables,
      child: ListView.builder(
        padding: const EdgeInsets.all(8),
        itemCount: _tables.length,
        itemBuilder: (context, index) {
          final table = _tables[index];
          return Card(
            margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: AppColors.accent.withValues(alpha: 0.1),
                child: const Icon(
                  Icons.table_restaurant,
                  color: AppColors.accent,
                ),
              ),
              title: Text(
                table.displayName,
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: _savingQr.contains(table.id)
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.download),
                    onPressed: _savingQr.contains(table.id)
                        ? null
                        : () => _downloadQr(table),
                    tooltip: 'Download QR Code',
                    color: AppColors.accent,
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: () => _editTable(table),
                    tooltip: 'Edit Name',
                    color: AppColors.accent,
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => _deleteTable(table),
                    tooltip: 'Delete Table',
                    color: Colors.red,
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
