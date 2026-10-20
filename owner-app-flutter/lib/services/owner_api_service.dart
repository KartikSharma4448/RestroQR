import 'dart:typed_data';

import '../models/earnings_model.dart';
import '../models/order_model.dart';
import '../models/table_model.dart';
import 'api_service.dart';

/// Service for owner-specific V2 API calls: tables, orders, earnings,
/// notifications, and settings.
class OwnerApiService {
  final ApiService _apiService;

  OwnerApiService(this._apiService);

  // ---------------------------------------------------------------------------
  // Table Management
  // ---------------------------------------------------------------------------

  /// Create a new table with a display name.
  Future<TableData> createTable({required String displayName}) async {
    final response = await _apiService.post(
      '/owner/tables',
      data: {'displayName': displayName},
    );
    final data = response.data['data'];
    final tableJson = data is Map && data.containsKey('table') ? data['table'] : data;
    return TableData.fromJson(tableJson as Map<String, dynamic>);
  }

  /// List all tables for the owner's restaurant.
  Future<List<TableData>> listTables() async {
    final response = await _apiService.get('/owner/tables');
    final data = response.data['data'];
    final List<dynamic> items = data is Map ? (data['tables'] ?? []) : (data ?? []);
    return items
        .map((item) => TableData.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// Update a table's display name.
  Future<TableData> updateTable({
    required String tableId,
    required String displayName,
  }) async {
    final response = await _apiService.patch(
      '/owner/tables/$tableId',
      data: {'displayName': displayName},
    );
    final data = response.data['data'];
    final tableJson = data is Map && data.containsKey('table') ? data['table'] : data;
    return TableData.fromJson(tableJson as Map<String, dynamic>);
  }

  /// Delete a table by ID.
  Future<void> deleteTable({required String tableId}) async {
    await _apiService.delete('/owner/tables/$tableId');
  }

  /// Download QR code PNG bytes for a table.
  Future<Uint8List> downloadQr({required String tableId}) async {
    final response = await _apiService.getBytes('/owner/tables/$tableId/qr');
    return Uint8List.fromList(response.data as List<int>);
  }

  // ---------------------------------------------------------------------------
  // Order Management
  // ---------------------------------------------------------------------------

  /// Get orders with optional filters for status and pagination.
  Future<OrderListResponse> getOrders({
    String? status,
    int page = 1,
    int pageSize = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (status != null) {
      queryParams['status'] = status;
    }
    final response = await _apiService.get(
      '/owner/orders',
      queryParameters: queryParams,
    );
    return OrderListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Update an order's status (e.g., pending → accepted).
  Future<OrderData> updateOrderStatus({
    required String orderId,
    required String status,
  }) async {
    final response = await _apiService.patch(
      '/owner/orders/$orderId/status',
      data: {'status': status},
    );
    final data = response.data['data'];
    final orderJson = data is Map && data.containsKey('order') ? data['order'] : data;
    return OrderData.fromJson(orderJson as Map<String, dynamic>);
  }

  /// Cancel an order.
  Future<OrderData> cancelOrder({required String orderId}) async {
    final response = await _apiService.post(
      '/owner/orders/$orderId/cancel',
    );
    final data = response.data['data'];
    final orderJson = data is Map && data.containsKey('order') ? data['order'] : data;
    return OrderData.fromJson(orderJson as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------------
  // Earnings
  // ---------------------------------------------------------------------------

  /// Get monthly earnings summary (total orders + total revenue).
  Future<EarningsSummary> getSummary({required String month}) async {
    final response = await _apiService.get(
      '/owner/earnings/summary',
      queryParameters: {'month': month},
    );
    return EarningsSummary.fromJson(
        response.data['data'] as Map<String, dynamic>);
  }

  /// Get earnings breakdown by period (daily, weekly, monthly).
  Future<List<EarningsBreakdown>> getBreakdown({
    required String period,
    required String month,
  }) async {
    final response = await _apiService.get(
      '/owner/earnings/breakdown',
      queryParameters: {'period': period, 'month': month},
    );
    final data = response.data['data'];
    final List<dynamic> items = data is Map ? (data['breakdown'] ?? []) : (data ?? []);
    return items
        .map((item) => EarningsBreakdown.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// Get paginated order history with optional status filter.
  Future<OrderListResponse> getHistory({
    int page = 1,
    int pageSize = 20,
    String? status,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'pageSize': pageSize,
    };
    if (status != null) {
      queryParams['status'] = status;
    }
    final response = await _apiService.get(
      '/owner/earnings/history',
      queryParameters: queryParams,
    );
    return OrderListResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Get per-item analytics (quantity sold, revenue per item).
  Future<List<ItemAnalytics>> getItemAnalytics({
    required String period,
    required String month,
  }) async {
    final response = await _apiService.get(
      '/owner/analytics/items',
      queryParameters: {'period': period, 'month': month},
    );
    final data = response.data['data'];
    final List<dynamic> items = data is Map ? (data['items'] ?? []) : (data ?? []);
    return items
        .map((item) => ItemAnalytics.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  /// Register an FCM device token with the backend.
  Future<void> registerFcmToken({required String fcmToken}) async {
    await _apiService.post(
      '/owner/notifications/register',
      data: {'fcmToken': fcmToken},
    );
  }

  /// Unregister the FCM device token from the backend.
  Future<void> unregisterFcmToken() async {
    await _apiService.delete('/owner/notifications/unregister');
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  /// Update the restaurant's QR mode (single or multi).
  Future<Map<String, dynamic>> updateQrMode({required String qrMode}) async {
    final response = await _apiService.patch(
      '/owner/settings/qr-mode',
      data: {'qrMode': qrMode},
    );
    return response.data['data'] as Map<String, dynamic>;
  }
}

/// Response wrapper for paginated order lists.
class OrderListResponse {
  final List<OrderData> orders;
  final int totalCount;
  final int page;
  final int pageSize;

  OrderListResponse({
    required this.orders,
    required this.totalCount,
    required this.page,
    required this.pageSize,
  });

  factory OrderListResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    List<dynamic> orderList;
    int total;
    int currentPage;
    int size;

    if (data is Map<String, dynamic>) {
      orderList = data['orders'] ?? data['items'] ?? [];
      total = data['totalCount'] ?? data['total_count'] ?? data['total'] ?? 0;
      currentPage = data['page'] ?? 1;
      size = data['pageSize'] ?? data['page_size'] ?? 20;
    } else if (data is List) {
      orderList = data;
      total = data.length;
      currentPage = 1;
      size = 20;
    } else {
      orderList = [];
      total = 0;
      currentPage = 1;
      size = 20;
    }

    return OrderListResponse(
      orders: orderList
          .map((item) => OrderData.fromJson(item as Map<String, dynamic>))
          .toList(),
      totalCount: total,
      page: currentPage,
      pageSize: size,
    );
  }
}
