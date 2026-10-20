import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../ui/app_theme.dart';
import '../ui/owner_widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/restaurant_models.dart';
import '../services/api_service.dart';

class FoodItemsScreen extends StatefulWidget {
  final String categoryId;
  final String? categoryName;

  const FoodItemsScreen({
    super.key,
    required this.categoryId,
    this.categoryName,
  });

  @override
  State<FoodItemsScreen> createState() => _FoodItemsScreenState();
}

class _FoodItemsScreenState extends State<FoodItemsScreen> {
  List<FoodItemData> _items = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadItems();
  }

  Future<void> _loadItems() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final apiService = context.read<ApiService>();
      final response = await apiService.get(
        '/owner/categories/${widget.categoryId}/items',
      );
      if (!mounted) return;
      final data = response.data;

      if (data['success'] == true) {
        final list = data['data'] is List
            ? data['data']
            : (data['data']?['items'] ?? []);
        setState(() {
          _items = (list as List)
              .map((i) => FoodItemData.fromJson(i as Map<String, dynamic>))
              .toList();
          _isLoading = false;
        });
      }
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _extractError(e);
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Network error. Please check your connection.';
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleAvailability(FoodItemData item) async {
    try {
      final apiService = context.read<ApiService>();
      await apiService.patch(
        '/owner/items/${item.id}/availability',
        data: {'isAvailable': !item.isAvailable},
      );
      await _loadItems();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  Future<void> _openForm({FoodItemData? item}) async {
    final saved = await context.push<bool>(
      item == null
          ? '/categories/${widget.categoryId}/items/add'
          : '/categories/${widget.categoryId}/items/edit/${item.id}',
      extra: item == null
          ? widget.categoryName
          : {'categoryName': widget.categoryName, 'item': item},
    );
    if (mounted && saved == true) await _loadItems();
  }

  Future<void> _deleteItem(FoodItemData item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Item'),
        content: Text('Are you sure you want to delete "${item.name}"?'),
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

    if (!mounted || confirmed != true) return;

    setState(() => _isLoading = true);
    try {
      final apiService = context.read<ApiService>();
      await apiService.delete('/owner/items/${item.id}');
      await _loadItems();
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_extractError(e)),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
      if (mounted) setState(() => _isLoading = false);
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
    return 'An unexpected error occurred';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(widget.categoryName ?? 'Food Items'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openForm,
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
            FilledButton(onPressed: _loadItems, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_items.isEmpty) {
      return OwnerEmptyState(
        icon: Icons.restaurant_menu,
        title: 'No dishes yet',
        action: 'Add dish',
        onAction: _openForm,
      );
    }

    return RefreshIndicator(
      onRefresh: _loadItems,
      child: ListView.builder(
        padding: const EdgeInsets.all(8),
        itemCount: _items.length,
        itemBuilder: (context, index) {
          final item = _items[index];
          return _buildItemCard(item);
        },
      ),
    );
  }

  Widget _buildItemCard(FoodItemData item) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 68,
                  height: 68,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: ColoredBox(
                      color: AppColors.background,
                      child: item.imageUrl != null
                          ? Image.network(
                              item.imageUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, error, stack) => const Icon(
                                Icons.restaurant_outlined,
                                color: AppColors.muted,
                              ),
                            )
                          : item.emoji != null
                          ? Center(
                              child: Text(
                                item.emoji!,
                                style: const TextStyle(fontSize: 30),
                              ),
                            )
                          : const Icon(
                              Icons.restaurant_outlined,
                              color: AppColors.muted,
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.name,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: item.isAvailable ? null : Colors.grey,
                          decoration: item.isAvailable
                              ? null
                              : TextDecoration.lineThrough,
                        ),
                      ),
                      if (item.description != null &&
                          item.description!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          item.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        '₹${item.price.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.accent,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Divider(),
            Row(
              children: [
                Icon(
                  Icons.circle,
                  size: 8,
                  color: item.badge == 'veg'
                      ? AppColors.accent
                      : AppColors.coral,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    item.badge == 'veg' ? 'Vegetarian' : 'Non-veg',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.muted,
                    ),
                  ),
                ),
                Tooltip(
                  message: item.isAvailable ? 'Available' : 'Unavailable',
                  child: Switch(
                    value: item.isAvailable,
                    onChanged: (_) => _toggleAvailability(item),
                    activeTrackColor: AppColors.accent,
                  ),
                ),
                const SizedBox(width: 4),
                IconButton(
                  tooltip: 'Edit dish',
                  icon: const Icon(Icons.edit_outlined, size: 20),
                  onPressed: () => _openForm(item: item),
                  color: AppColors.accent,
                  constraints: const BoxConstraints(
                    minWidth: 44,
                    minHeight: 44,
                  ),
                ),
                IconButton(
                  tooltip: 'Delete dish',
                  icon: const Icon(Icons.delete_outline, size: 20),
                  onPressed: () => _deleteItem(item),
                  color: AppColors.coral,
                  constraints: const BoxConstraints(
                    minWidth: 44,
                    minHeight: 44,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
