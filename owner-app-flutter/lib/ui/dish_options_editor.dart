import 'package:flutter/material.dart';

class DishOptionsEditor extends StatefulWidget {
  static const enabled = bool.fromEnvironment('MENU_OPTIONS_ENABLED');
  final Map<String, dynamic>? initial;
  final bool busy;
  final ValueChanged<Map<String, dynamic>> onChanged;
  const DishOptionsEditor({
    super.key,
    this.initial,
    required this.busy,
    required this.onChanged,
  });
  @override
  State<DishOptionsEditor> createState() => _DishOptionsEditorState();
}

class _OptionDraft {
  final String? id;
  final name = TextEditingController();
  final price = TextEditingController();
  bool available;
  _OptionDraft(Map<String, dynamic> value)
    : id = value['id'] as String?,
      available = value['isAvailable'] != false {
    name.text = value['name'] as String? ?? '';
    price.text = value['price']?.toString() ?? '';
  }
  Map<String, dynamic> toJson() => {
    if (id != null) 'id': id,
    'name': name.text.trim(),
    'price': price.text.trim(),
    'isAvailable': available,
  };
  void dispose() {
    name.dispose();
    price.dispose();
  }
}

class _DishOptionsEditorState extends State<DishOptionsEditor> {
  final List<_OptionDraft> _variants = [];
  final List<_OptionDraft> _addOns = [];
  @override
  void initState() {
    super.initState();
    for (final value in widget.initial?['variants'] as List? ?? []) {
      _variants.add(_OptionDraft(Map<String, dynamic>.from(value)));
    }
    for (final value in widget.initial?['addOns'] as List? ?? []) {
      _addOns.add(_OptionDraft(Map<String, dynamic>.from(value)));
    }
  }

  @override
  void dispose() {
    for (final option in [..._variants, ..._addOns]) {
      option.dispose();
    }
    super.dispose();
  }

  void _notify() => widget.onChanged({
    'variants': _variants.map((v) => v.toJson()).toList(),
    'addOns': _addOns.map((v) => v.toJson()).toList(),
  });
  Widget _section(
    String title,
    List<_OptionDraft> options, {
    required bool variant,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleSmall),
          ),
          TextButton.icon(
            icon: const Icon(Icons.add, size: 18),
            label: Text(variant ? 'Add size' : 'Add add-on'),
            onPressed: widget.busy || options.length >= (variant ? 12 : 20)
                ? null
                : () {
                    setState(() => options.add(_OptionDraft({})));
                    _notify();
                  },
          ),
        ],
      ),
      for (final option in options)
        Padding(
          key: ObjectKey(option),
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: option.name,
                      enabled: !widget.busy,
                      maxLength: 60,
                      decoration: InputDecoration(
                        labelText: variant ? 'Size name' : 'Add-on name',
                      ),
                      onChanged: (_) => _notify(),
                      validator: (value) {
                        final name = value?.trim() ?? '';
                        if (name.isEmpty) return 'Name is required';
                        if (options
                                .where(
                                  (entry) =>
                                      entry.name.text.trim().toLowerCase() ==
                                      name.toLowerCase(),
                                )
                                .length >
                            1) {
                          return 'Use a unique name';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 140,
                    child: TextFormField(
                      controller: option.price,
                      enabled: !widget.busy,
                      decoration: InputDecoration(
                        labelText: variant ? 'Price (INR)' : 'Extra (INR)',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      onChanged: (_) => _notify(),
                      validator: (value) {
                        final text = value?.trim() ?? '';
                        final price = double.tryParse(text);
                        if (!RegExp(r'^\d{1,6}(\.\d{1,2})?$').hasMatch(text) ||
                            price == null ||
                            !price.isFinite ||
                            price < (variant ? 0.01 : 0) ||
                            price > 999999.99) {
                          return 'Invalid price';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Switch(
                    value: option.available,
                    onChanged: widget.busy
                        ? null
                        : (value) {
                            setState(() => option.available = value);
                            _notify();
                          },
                  ),
                  const Expanded(child: Text('Available')),
                  IconButton(
                    tooltip: variant ? 'Remove size' : 'Remove add-on',
                    icon: const Icon(Icons.delete_outline),
                    onPressed: widget.busy
                        ? null
                        : () {
                            setState(() => options.remove(option));
                            WidgetsBinding.instance.addPostFrameCallback(
                              (_) => option.dispose(),
                            );
                            _notify();
                          },
                  ),
                ],
              ),
            ],
          ),
        ),
    ],
  );
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _section('Sizes', _variants, variant: true),
      _section('Add-ons', _addOns, variant: false),
      const SizedBox(height: 16),
    ],
  );
}
