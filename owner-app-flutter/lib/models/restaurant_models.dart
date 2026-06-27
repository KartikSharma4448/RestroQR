class RestaurantData {
  final String id;
  final String name;
  final String address;
  final String phone;
  final String? logoUrl;
  final String? coverImageUrl;
  final String? restaurantToken;
  final String? status;

  RestaurantData({
    required this.id,
    required this.name,
    required this.address,
    required this.phone,
    this.logoUrl,
    this.coverImageUrl,
    this.restaurantToken,
    this.status,
  });

  factory RestaurantData.fromJson(Map<String, dynamic> json) {
    return RestaurantData(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      address: json['address'] ?? '',
      phone: json['phone'] ?? '',
      logoUrl: json['logoUrl'] ?? json['logo_url'],
      coverImageUrl: json['coverImageUrl'] ?? json['cover_image_url'],
      restaurantToken: json['restaurantToken'] ?? json['restaurant_token'],
      status: json['status'],
    );
  }
}

class CategoryData {
  final String id;
  final String name;
  final int displayOrder;

  CategoryData({
    required this.id,
    required this.name,
    required this.displayOrder,
  });

  factory CategoryData.fromJson(Map<String, dynamic> json) {
    return CategoryData(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      displayOrder: json['displayOrder'] ?? json['display_order'] ?? 0,
    );
  }
}

class FoodItemData {
  final String id;
  final String categoryId;
  final String name;
  final String? description;
  final double price;
  final String? imageUrl;
  final String badge;
  final bool isAvailable;

  FoodItemData({
    required this.id,
    required this.categoryId,
    required this.name,
    this.description,
    required this.price,
    this.imageUrl,
    required this.badge,
    required this.isAvailable,
  });

  factory FoodItemData.fromJson(Map<String, dynamic> json) {
    return FoodItemData(
      id: json['id'] ?? '',
      categoryId: json['categoryId'] ?? json['category_id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      price: (json['price'] is String)
          ? double.tryParse(json['price']) ?? 0.0
          : (json['price'] ?? 0).toDouble(),
      imageUrl: json['imageUrl'] ?? json['image_url'],
      badge: json['badge'] ?? 'veg',
      isAvailable: json['isAvailable'] ?? json['is_available'] ?? true,
    );
  }
}
