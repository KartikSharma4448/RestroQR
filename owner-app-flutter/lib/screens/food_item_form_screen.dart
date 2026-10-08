import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../ui/app_theme.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../models/restaurant_models.dart';
import '../services/api_service.dart';

class FoodItemFormScreen extends StatefulWidget {
  final String categoryId;
  final String? categoryName;
  final FoodItemData? existingItem;

  const FoodItemFormScreen({
    super.key,
    required this.categoryId,
    this.categoryName,
    this.existingItem,
  });

  @override
  State<FoodItemFormScreen> createState() => _FoodItemFormScreenState();
}

class _FoodItemFormScreenState extends State<FoodItemFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();
  String _badge = 'veg';
  bool _isAvailable = true;
  bool _isLoading = false;

  bool get _isEditing => widget.existingItem != null;

  @override
  void initState() {
    super.initState();
    if (widget.existingItem != null) {
      _nameController.text = widget.existingItem!.name;
      _descriptionController.text = widget.existingItem!.description ?? '';
      _priceController.text = widget.existingItem!.price.toStringAsFixed(2);
      _badge = widget.existingItem!.badge;
      _isAvailable = widget.existingItem!.isAvailable;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final apiService = context.read<ApiService>();
      final price = double.parse(_priceController.text.trim());

      if (_isEditing) {
        await apiService.put(
          '/owner/items/${widget.existingItem!.id}',
          data: {
            'name': _nameController.text.trim(),
            'description': _descriptionController.text.trim().isNotEmpty
                ? _descriptionController.text.trim()
                : null,
            'price': price,
            'badge': _badge,
          },
        );
        if (_isAvailable != widget.existingItem!.isAvailable) {
          await apiService.patch(
            '/owner/items/${widget.existingItem!.id}/availability',
            data: {'isAvailable': _isAvailable},
          );
        }
      } else {
        await apiService.post(
          '/owner/items',
          data: {
            'categoryId': widget.categoryId,
            'name': _nameController.text.trim(),
            'description': _descriptionController.text.trim().isNotEmpty
                ? _descriptionController.text.trim()
                : null,
            'price': price,
            'badge': _badge,
          },
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isEditing
                  ? 'Item updated successfully'
                  : 'Item added successfully',
            ),
            backgroundColor: Colors.green,
          ),
        );
        context.pop();
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
          const SnackBar(
            content: Text('Network error. Please check your connection.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }

    if (mounted) setState(() => _isLoading = false);
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
        title: Text(_isEditing ? 'Edit Item' : 'Add Item'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Item Name *',
                  prefixIcon: Icon(Icons.fastfood_outlined),
                  border: OutlineInputBorder(),
                ),
                maxLength: 100,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Item name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _descriptionController,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  prefixIcon: Icon(Icons.description_outlined),
                  border: OutlineInputBorder(),
                ),
                maxLength: 500,
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _priceController,
                decoration: const InputDecoration(
                  labelText: 'Price *',
                  prefixIcon: Icon(Icons.currency_rupee),
                  border: OutlineInputBorder(),
                ),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Price is required';
                  }
                  final price = double.tryParse(value.trim());
                  if (price == null) {
                    return 'Enter a valid number';
                  }
                  if (price < 0.01) {
                    return 'Price must be at least 0.01';
                  }
                  if (price > 999999.99) {
                    return 'Price cannot exceed 999999.99';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              Text(
                'Food Type',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(
                    value: 'veg',
                    label: Text('Veg'),
                    icon: Icon(Icons.circle, size: 12),
                  ),
                  ButtonSegment(
                    value: 'non_veg',
                    label: Text('Non-veg'),
                    icon: Icon(Icons.circle_outlined, size: 12),
                  ),
                ],
                selected: {_badge},
                onSelectionChanged: _isLoading
                    ? null
                    : (values) => setState(() => _badge = values.first),
              ),
              if (_isEditing) ...[
                const SizedBox(height: 24),
                SwitchListTile(
                  title: const Text('Available'),
                  subtitle: Text(
                    _isAvailable
                        ? 'Item is visible on menu'
                        : 'Item is hidden from menu',
                  ),
                  value: _isAvailable,
                  onChanged: (value) {
                    setState(() => _isAvailable = value);
                  },
                  activeTrackColor: AppColors.accent,
                  contentPadding: EdgeInsets.zero,
                ),
              ],
              const SizedBox(height: 32),
              FilledButton(
                onPressed: _isLoading ? null : _handleSubmit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        _isEditing ? 'Update Item' : 'Add Item',
                        style: const TextStyle(fontSize: 16),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
