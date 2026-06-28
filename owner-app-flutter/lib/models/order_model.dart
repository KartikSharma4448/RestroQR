import 'order_item_model.dart';

class OrderData {
  final String id;
  final String orderRef;
  final String status;
  final double total;
  final String tableDisplayName;
  final List<OrderItemData> items;
  final DateTime createdAt;
  final DateTime? acceptedAt;
  final DateTime? completedAt;
  final DateTime? paymentReceivedAt;
  final DateTime? cancelledAt;

  OrderData({
    required this.id,
    required this.orderRef,
    required this.status,
    required this.total,
    required this.tableDisplayName,
    required this.items,
    required this.createdAt,
    this.acceptedAt,
    this.completedAt,
    this.paymentReceivedAt,
    this.cancelledAt,
  });

  factory OrderData.fromJson(Map<String, dynamic> json) {
    return OrderData(
      id: json['id'] ?? '',
      orderRef: json['orderRef'] ?? json['order_ref'] ?? '',
      status: json['status'] ?? 'pending',
      total: (json['total'] is String)
          ? double.tryParse(json['total']) ?? 0.0
          : (json['total'] ?? 0).toDouble(),
      tableDisplayName:
          json['tableDisplayName'] ?? json['table_display_name'] ?? '',
      items: json['items'] != null
          ? (json['items'] as List)
              .map((item) =>
                  OrderItemData.fromJson(item as Map<String, dynamic>))
              .toList()
          : [],
      createdAt: DateTime.parse(
          json['createdAt'] ?? json['created_at'] ?? DateTime.now().toIso8601String()),
      acceptedAt: json['acceptedAt'] != null
          ? DateTime.parse(json['acceptedAt'])
          : json['accepted_at'] != null
              ? DateTime.parse(json['accepted_at'])
              : null,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : json['completed_at'] != null
              ? DateTime.parse(json['completed_at'])
              : null,
      paymentReceivedAt: json['paymentReceivedAt'] != null
          ? DateTime.parse(json['paymentReceivedAt'])
          : json['payment_received_at'] != null
              ? DateTime.parse(json['payment_received_at'])
              : null,
      cancelledAt: json['cancelledAt'] != null
          ? DateTime.parse(json['cancelledAt'])
          : json['cancelled_at'] != null
              ? DateTime.parse(json['cancelled_at'])
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'orderRef': orderRef,
      'status': status,
      'total': total,
      'tableDisplayName': tableDisplayName,
      'items': items.map((item) => item.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'acceptedAt': acceptedAt?.toIso8601String(),
      'completedAt': completedAt?.toIso8601String(),
      'paymentReceivedAt': paymentReceivedAt?.toIso8601String(),
      'cancelledAt': cancelledAt?.toIso8601String(),
    };
  }
}
