class TableData {
  final String id;
  final String restaurantId;
  final String displayName;
  final String tableToken;
  final DateTime createdAt;
  final DateTime updatedAt;

  TableData({
    required this.id,
    required this.restaurantId,
    required this.displayName,
    required this.tableToken,
    required this.createdAt,
    required this.updatedAt,
  });

  factory TableData.fromJson(Map<String, dynamic> json) {
    return TableData(
      id: json['id'] ?? '',
      restaurantId: json['restaurantId'] ?? json['restaurant_id'] ?? '',
      displayName: json['displayName'] ?? json['display_name'] ?? '',
      tableToken: json['tableToken'] ?? json['table_token'] ?? '',
      createdAt: DateTime.parse(
          json['createdAt'] ?? json['created_at'] ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(
          json['updatedAt'] ?? json['updated_at'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'restaurantId': restaurantId,
      'displayName': displayName,
      'tableToken': tableToken,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
