double _money(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

class InvestmentItem {
  final String id;
  final String topic;
  final double amount;

  /// Calendar date in yyyy-MM-dd.
  final String spentOn;

  const InvestmentItem({
    required this.id,
    required this.topic,
    required this.amount,
    required this.spentOn,
  });

  factory InvestmentItem.fromJson(Map<String, dynamic> json) {
    return InvestmentItem(
      id: (json['id'] ?? '').toString(),
      topic: (json['topic'] ?? '').toString(),
      amount: _money(json['amount']),
      spentOn: (json['spentOn'] ?? '').toString(),
    );
  }
}

/// A month's investments with revenue and the resulting profit or loss.
class InvestmentReport {
  final String month;
  final List<InvestmentItem> items;
  final double totalInvestment;
  final double totalRevenue;
  final int paidOrders;
  final double netProfit;

  const InvestmentReport({
    required this.month,
    required this.items,
    required this.totalInvestment,
    required this.totalRevenue,
    required this.paidOrders,
    required this.netProfit,
  });

  factory InvestmentReport.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    return InvestmentReport(
      month: (json['month'] ?? '').toString(),
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (e) => InvestmentItem.fromJson(Map<String, dynamic>.from(e)),
                )
                .toList()
          : const [],
      totalInvestment: _money(json['totalInvestment']),
      totalRevenue: _money(json['totalRevenue']),
      paidOrders: json['paidOrders'] is int ? json['paidOrders'] as int : 0,
      netProfit: _money(json['netProfit']),
    );
  }
}
