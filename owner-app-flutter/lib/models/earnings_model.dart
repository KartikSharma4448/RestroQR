class EarningsSummary {
  final int totalOrders;
  final double totalRevenue;

  EarningsSummary({
    required this.totalOrders,
    required this.totalRevenue,
  });

  factory EarningsSummary.fromJson(Map<String, dynamic> json) {
    return EarningsSummary(
      totalOrders: json['totalOrders'] ?? json['total_orders'] ?? 0,
      totalRevenue: (json['totalRevenue'] ?? json['total_revenue'] ?? 0) is String
          ? double.tryParse(json['totalRevenue'] ?? json['total_revenue'] ?? '0') ?? 0.0
          : (json['totalRevenue'] ?? json['total_revenue'] ?? 0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'totalOrders': totalOrders,
      'totalRevenue': totalRevenue,
    };
  }
}

class EarningsBreakdown {
  final String date;
  final int totalOrders;
  final double totalRevenue;

  EarningsBreakdown({
    required this.date,
    required this.totalOrders,
    required this.totalRevenue,
  });

  factory EarningsBreakdown.fromJson(Map<String, dynamic> json) {
    return EarningsBreakdown(
      date: json['date'] ?? '',
      totalOrders: json['totalOrders'] ?? json['total_orders'] ?? 0,
      totalRevenue: (json['totalRevenue'] ?? json['total_revenue'] ?? 0) is String
          ? double.tryParse(json['totalRevenue'] ?? json['total_revenue'] ?? '0') ?? 0.0
          : (json['totalRevenue'] ?? json['total_revenue'] ?? 0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date,
      'totalOrders': totalOrders,
      'totalRevenue': totalRevenue,
    };
  }
}

class ItemAnalytics {
  final String itemName;
  final int totalQuantity;
  final double totalRevenue;

  ItemAnalytics({
    required this.itemName,
    required this.totalQuantity,
    required this.totalRevenue,
  });

  factory ItemAnalytics.fromJson(Map<String, dynamic> json) {
    return ItemAnalytics(
      itemName: json['itemName'] ?? json['item_name'] ?? '',
      totalQuantity: json['totalQuantity'] ?? json['total_quantity'] ?? 0,
      totalRevenue: (json['totalRevenue'] ?? json['total_revenue'] ?? 0) is String
          ? double.tryParse(json['totalRevenue'] ?? json['total_revenue'] ?? '0') ?? 0.0
          : (json['totalRevenue'] ?? json['total_revenue'] ?? 0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'itemName': itemName,
      'totalQuantity': totalQuantity,
      'totalRevenue': totalRevenue,
    };
  }
}
