class OrderItemData {
  final String itemName;
  final double itemPrice;
  final int quantity;
  final String? optionSummary;

  OrderItemData({
    required this.itemName,
    required this.itemPrice,
    required this.quantity,
    this.optionSummary,
  });

  factory OrderItemData.fromJson(Map<String, dynamic> json) {
    return OrderItemData(
      itemName: json['itemName'] ?? json['item_name'] ?? '',
      itemPrice: (json['itemPrice'] ?? json['item_price'] ?? 0) is String
          ? double.tryParse(json['itemPrice'] ?? json['item_price'] ?? '0') ??
                0.0
          : (json['itemPrice'] ?? json['item_price'] ?? 0).toDouble(),
      quantity: json['quantity'] ?? 0,
      optionSummary: json['optionSummary'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'itemName': itemName,
      'itemPrice': itemPrice,
      'quantity': quantity,
      if (optionSummary != null) 'optionSummary': optionSummary,
    };
  }
}
