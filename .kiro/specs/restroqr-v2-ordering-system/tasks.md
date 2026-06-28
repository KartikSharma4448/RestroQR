# Implementation Plan: RestroQR V2 Ordering System

## Overview

This plan implements the full table-wise ordering system for RestroQR V2 across three codebases: the Node.js/TypeScript backend (migrations, services, routes), the Flutter owner app (new screens for tables, orders, earnings, notifications), and the Next.js customer website (ordering flow). Tasks are ordered by dependency — database schema first, then services, routes, tests, and finally frontend integration.

## Tasks

- [x] 1. Database migrations and schema setup
  - [x] 1.1 Create migration `007_add-qr-mode-to-restaurants.js`
    - Add `qr_mode` varchar(10) column to `restaurants` table with default `'single'`
    - Include up and down migration functions
    - _Requirements: 1.1_

  - [x] 1.2 Create migration `008_create-order-status-enum.js`
    - Create PostgreSQL enum type `order_status` with values: `pending`, `accepted`, `completed`, `payment_received`, `cancelled`
    - _Requirements: 5.1_

  - [x] 1.3 Create migration `009_create-tables-table.js`
    - Create `tables` table with columns: id (uuid PK), restaurant_id (FK), display_name (varchar 50), table_token (varchar 200 UNIQUE), created_at, updated_at
    - Add index on restaurant_id
    - Add ON DELETE CASCADE for restaurant_id FK
    - _Requirements: 2.1, 2.2_

  - [x] 1.4 Create migration `010_create-orders-table.js`
    - Create `orders` table with columns: id, restaurant_id (FK), table_id (FK), order_ref (UNIQUE), status (order_status default 'pending'), total (decimal 10,2), created_at, accepted_at, completed_at, payment_received_at, cancelled_at, updated_at
    - Create indexes: idx_orders_restaurant_id, idx_orders_table_id, idx_orders_status, idx_orders_created_at, idx_orders_restaurant_status, idx_orders_restaurant_created
    - _Requirements: 10.1, 10.4_

  - [x] 1.5 Create migration `011_create-order-items-table.js`
    - Create `order_items` table with columns: id, order_id (FK CASCADE), food_item_id (FK SET NULL), item_name (varchar 100), item_price (decimal 8,2), quantity (integer CHECK >= 1), created_at
    - Create indexes: idx_order_items_order_id, idx_order_items_food_item_id
    - _Requirements: 10.2, 10.3_

  - [x] 1.6 Create migration `012_create-fcm-tokens-table.js`
    - Create `fcm_tokens` table with columns: id, owner_id (FK CASCADE), token (varchar 500 UNIQUE), created_at, updated_at
    - Create index: idx_fcm_tokens_owner_id
    - _Requirements: 7.1_

- [x] 2. Backend core services
  - [x] 2.1 Implement `tableService.ts` in `backend/src/services/`
    - Implement `encryptTableToken(tableId, restaurantId)` using AES-256-GCM encryption
    - Implement `decryptTableToken(token)` returning `{ restaurantId, tableId }`
    - Implement `createTable(restaurantId, displayName)` — validates qr_mode is 'multi', generates token, inserts record
    - Implement `listTables(restaurantId)` — returns all tables for restaurant
    - Implement `updateTable(tableId, restaurantId, displayName)` — updates display name
    - Implement `deleteTable(tableId, restaurantId)` — removes table record
    - Implement `getTableQrUrl(tableId, restaurantId)` — returns public URL format `/r/{restaurant_token}/t/{table_token}`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8_

  - [x] 2.2 Write property tests for table token encryption (Properties 3, 4, 5)
    - Create `backend/src/tests/properties/table.properties.test.ts`
    - **Property 3: Table Token Encryption Round-Trip** — For any valid table UUID and restaurant UUID, encrypt then decrypt returns original values
    - **Property 4: Table Token Uniqueness** — For any N tables, all generated tokens are distinct
    - **Property 5: Invalid Token Handling** — For any non-valid token string, decryption throws generic error
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.3**

  - [x] 2.3 Implement `orderService.ts` in `backend/src/services/`
    - Implement `createOrder(tableToken, items[])` — decrypt token, validate restaurant qr_mode is 'multi', validate all items belong to restaurant and are available, calculate total server-side, insert order + order_items with price snapshots, generate order_ref (format "ORD-XXXXXX")
    - Implement `getOrders(restaurantId, { status, page, pageSize })` — paginated order listing with filters
    - Implement `updateOrderStatus(orderId, restaurantId, newStatus)` — enforce valid transitions per state machine
    - Implement `cancelOrder(orderId, restaurantId)` — cancel from pending/accepted/completed, reject from payment_received/cancelled
    - Implement status transition validation: pending→accepted, accepted→completed, completed→payment_received
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 2.4 Write property tests for order validation (Properties 6, 7, 8, 9)
    - Create `backend/src/tests/properties/order.properties.test.ts`
    - **Property 6: Order Item Validation (All-or-Nothing)** — Invalid items reject entire order with no DB record created
    - **Property 7: Order Total Integrity** — Total equals sum of (price × quantity) for all items
    - **Property 8: Initial Order State Invariant** — New orders always have status 'pending' and correct table_id
    - **Property 9: Multiple Orders Per Table** — N valid orders create N distinct records for same table
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6, 4.7, 10.5**

  - [x] 2.5 Write property tests for order status transitions (Properties 10, 11, 12)
    - Create `backend/src/tests/properties/order-status.properties.test.ts`
    - **Property 10: Status Transition Enforcement** — Only valid (S, T) pairs succeed
    - **Property 11: Cancellation Rules** — Cancel succeeds from pending/accepted/completed, fails from payment_received/cancelled
    - **Property 12: Transition Timestamps** — Valid transitions set corresponding timestamp column
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6**

  - [x] 2.6 Implement `notificationService.ts` in `backend/src/services/`
    - Implement `registerFcmToken(ownerId, fcmToken)` — upsert token record
    - Implement `unregisterFcmToken(ownerId)` — delete token record
    - Implement `sendOrderNotification(restaurantId, tableName, orderTotal)` — look up owner FCM token, send push with table name and total, log errors without blocking
    - Use Firebase Admin SDK for FCM dispatch
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 2.7 Write property test for notification payload (Property 13)
    - Create `backend/src/tests/properties/notification.properties.test.ts`
    - **Property 13: Notification Payload Completeness** — Constructed payload contains both table display name and order total
    - **Validates: Requirements 7.3**

  - [x] 2.8 Implement `earningsService.ts` in `backend/src/services/`
    - Implement `getMonthlySummary(restaurantId, month)` — total orders count and revenue for payment_received orders only
    - Implement `getEarningsBreakdown(restaurantId, period, month)` — daily/weekly/monthly breakdown
    - Implement `getOrderHistory(restaurantId, { page, pageSize, status })` — paginated history with filters
    - Implement `getItemAnalytics(restaurantId, period, month)` — per-item quantity sold and revenue from payment_received orders
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 2.9 Write property tests for earnings and analytics (Properties 14, 15, 16)
    - Create `backend/src/tests/properties/earnings.properties.test.ts`
    - **Property 14: Earnings Filter** — Only payment_received orders contribute to earnings sum
    - **Property 15: Pagination Correctness** — Page P with size S returns correct subset and total count
    - **Property 16: Analytics Aggregation** — Per-item totals equal sum of quantities/revenue from payment_received order_items
    - **Validates: Requirements 8.3, 8.5, 9.1, 9.4**

- [x] 3. Backend QR mode service and property tests
  - [x] 3.1 Implement QR mode toggle in `ownerRestaurantService.ts` or new `settingsService.ts`
    - Add `updateQrMode(restaurantId, qrMode)` — validate input is 'single' or 'multi', update restaurant record
    - Ensure mode switch preserves all table and order data
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x] 3.2 Write property tests for QR mode (Properties 1, 2)
    - Create `backend/src/tests/properties/qr-mode.properties.test.ts`
    - **Property 1: QR Mode Validation** — Only 'single' or 'multi' accepted, all other values rejected
    - **Property 2: Mode Switch Round-Trip Preserves Data** — Any sequence of mode switches preserves table and order records
    - **Validates: Requirements 1.1, 1.5, 1.6, 1.7**

  - [x] 3.3 Write property test for data integrity (Property 17)
    - Create `backend/src/tests/properties/data-integrity.properties.test.ts`
    - **Property 17: Snapshot Preservation After Item Deletion** — Deleting a food_item preserves item_name and item_price in order_items
    - **Validates: Requirements 10.3**

- [x] 4. Checkpoint - Ensure all backend services and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Backend API routes
  - [x] 5.1 Create `backend/src/routes/owner/settings.ts`
    - PATCH `/api/owner/settings/qr-mode` — validate body `{ qrMode }`, call settingsService, return updated mode
    - Apply authenticate + requireRole('owner') middleware
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.2 Create `backend/src/routes/owner/tables.ts`
    - POST `/api/owner/tables` — create table (validate qr_mode is 'multi', body `{ displayName }`)
    - GET `/api/owner/tables` — list all tables for authenticated owner's restaurant
    - PATCH `/api/owner/tables/:id` — update display name
    - DELETE `/api/owner/tables/:id` — delete table
    - GET `/api/owner/tables/:id/qr` — generate and return QR code PNG
    - Apply authenticate + requireRole('owner') middleware
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 5.3 Create `backend/src/routes/public/orders.ts`
    - POST `/api/public/orders` — validate body `{ tableToken, items[] }`, call orderService.createOrder, trigger notification, return 201 with order confirmation
    - Handle errors: invalid token → 404, unavailable items → 400, empty items → 400
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [x] 5.4 Create `backend/src/routes/owner/orders.ts`
    - GET `/api/owner/orders` — list orders with query params (status, page, pageSize)
    - PATCH `/api/owner/orders/:id/status` — update order status (body `{ status }`)
    - POST `/api/owner/orders/:id/cancel` — cancel order
    - Apply authenticate + requireRole('owner') middleware
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 5.5 Create `backend/src/routes/owner/earnings.ts`
    - GET `/api/owner/earnings/summary` — monthly summary (query: month)
    - GET `/api/owner/earnings/breakdown` — breakdown by period (query: period, month)
    - GET `/api/owner/earnings/history` — paginated order history (query: page, pageSize, status)
    - GET `/api/owner/analytics/items` — per-item analytics (query: period, month)
    - Apply authenticate + requireRole('owner') middleware
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 5.6 Create `backend/src/routes/owner/notifications.ts`
    - POST `/api/owner/notifications/register` — register FCM token (body `{ fcmToken }`)
    - DELETE `/api/owner/notifications/unregister` — unregister FCM token
    - Apply authenticate + requireRole('owner') middleware
    - _Requirements: 7.1, 7.6_

  - [x] 5.7 Register all new routes in `backend/src/index.ts`
    - Import and mount ownerSettingsRoutes, ownerTablesRoutes, ownerOrdersRoutes, ownerEarningsRoutes, ownerNotificationsRoutes, publicOrdersRoutes
    - Apply appropriate middleware (authenticate + requireRole for owner routes, publicRateLimiter for public orders)
    - _Requirements: 1.3, 2.1, 4.1, 5.1, 7.1, 8.1_

- [x] 6. Backend integration tests
  - [x] 6.1 Write integration tests for table management endpoints
    - Create `backend/src/tests/integration/tables.integration.test.ts`
    - Test CRUD flow: create table, list, update name, delete
    - Test QR code PNG generation endpoint
    - Test error cases: create table when qr_mode is 'single', duplicate display name
    - _Requirements: 2.1, 2.4, 2.5, 2.7_

  - [x] 6.2 Write integration tests for order placement flow
    - Create `backend/src/tests/integration/orders.integration.test.ts`
    - Test end-to-end: create restaurant → set multi mode → create table → place order → verify confirmation
    - Test error cases: invalid token, unavailable items, empty items, invalid quantity
    - Test multiple orders from same table
    - _Requirements: 3.1, 4.1, 4.2, 4.4, 4.5, 4.6_

  - [x] 6.3 Write integration tests for order lifecycle and earnings
    - Create `backend/src/tests/integration/order-lifecycle.integration.test.ts`
    - Test full lifecycle: pending → accepted → completed → payment_received
    - Test cancellation from each valid state
    - Test invalid transitions rejected
    - Test earnings summary only counts payment_received orders
    - Test pagination for order history
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.3, 8.5_

  - [x] 6.4 Write integration tests for notifications
    - Create `backend/src/tests/integration/notifications.integration.test.ts`
    - Test FCM token registration and unregistration
    - Test notification sent on order creation (mocked FCM)
    - Test notification failure doesn't block order creation
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

- [x] 7. Checkpoint - Ensure all backend routes and integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Flutter Owner App — models and services
  - [x] 8.1 Create Dart models for V2 entities in `owner-app-flutter/lib/models/`
    - Create `table_model.dart` — Table model with id, restaurantId, displayName, tableToken, createdAt
    - Create `order_model.dart` — Order model with id, orderRef, status, total, tableDisplayName, items, timestamps
    - Create `order_item_model.dart` — OrderItem model with itemName, itemPrice, quantity
    - Create `earnings_model.dart` — EarningsSummary, EarningsBreakdown, ItemAnalytics models
    - _Requirements: 2.1, 4.3, 6.2, 8.1, 9.1_

  - [x] 8.2 Create API service methods in `owner-app-flutter/lib/services/`
    - Add table management API calls: createTable, listTables, updateTable, deleteTable, downloadQr
    - Add order management API calls: getOrders, updateOrderStatus, cancelOrder
    - Add earnings API calls: getSummary, getBreakdown, getHistory, getItemAnalytics
    - Add notification API calls: registerFcmToken, unregisterFcmToken
    - Add settings API call: updateQrMode
    - _Requirements: 1.4, 2.6, 5.1, 6.1, 7.1, 8.1, 9.1_

- [x] 9. Flutter Owner App — screens
  - [x] 9.1 Create QR mode settings screen
    - Add toggle widget in restaurant settings for switching between 'single' and 'multi' QR mode
    - Call PATCH `/api/owner/settings/qr-mode` on toggle
    - Show confirmation dialog before switching modes
    - _Requirements: 1.4_

  - [x] 9.2 Create table management screen (`tables_screen.dart`)
    - Display list of all tables with display names and QR download buttons
    - Add table button — dialog for entering display name
    - Edit table name inline or via dialog
    - Delete table with confirmation
    - Download QR code PNG for each table
    - Only accessible when qr_mode is 'multi'
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 9.3 Create orders screen (`orders_screen.dart`)
    - Display orders in tabs: Pending, Accepted, Completed, Payment Received
    - Each order card shows: table display name, item names with quantities, order total, order_ref
    - Action buttons on each card for valid transitions (Accept, Complete, Mark Paid, Cancel)
    - Poll for new orders every 10 seconds when screen is in foreground
    - Sort orders by creation time (newest first)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.4 Create earnings dashboard screen (`earnings_screen.dart`)
    - Display monthly summary: total orders count and total revenue
    - Toggle between daily, weekly, monthly breakdown views
    - Display chart or list of earnings breakdown data
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 9.5 Create order history screen (`order_history_screen.dart`)
    - Display paginated order history list
    - Filter by date range and order status
    - Default page size of 20, load more on scroll
    - _Requirements: 8.4, 8.5_

  - [x] 9.6 Create per-item analytics screen (`item_analytics_screen.dart`)
    - Display ranked list of food items sorted by total quantity sold (descending)
    - Show quantity sold and revenue per item
    - Filter by period: daily, weekly, monthly
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 9.7 Implement FCM push notification handling
    - Register FCM token on app login/startup, call POST `/api/owner/notifications/register`
    - Unregister FCM token on logout, call DELETE `/api/owner/notifications/unregister`
    - Handle incoming push notifications — show system notification with table name and order total
    - Navigate to orders screen when notification is tapped
    - _Requirements: 7.1, 7.2, 7.3, 7.6_

  - [x] 9.8 Wire new screens into app navigation
    - Add navigation entries for: Tables, Orders, Earnings, Analytics in the app drawer/bottom nav
    - Conditionally show Tables entry only when qr_mode is 'multi'
    - Ensure existing V1 screens remain accessible and unchanged
    - _Requirements: 1.4, 2.6, 6.1, 8.1, 9.2_

- [x] 10. Checkpoint - Ensure Flutter owner app compiles and all new screens render
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Customer Website — ordering flow (Next.js)
  - [x] 11.1 Create table-specific route page `customer-website/app/r/[token]/t/[tableToken]/page.tsx`
    - Fetch menu data using decrypted table token via backend API
    - Display restaurant menu with item cards (name, price, image)
    - Add "Add to Order" buttons on each available item
    - Maintain client-side cart state (items + quantities)
    - Display "Place Order" button when cart has items
    - Handle invalid/expired tokens — show generic error page
    - Handle restaurant in single mode — show not-found page
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1_

  - [x] 11.2 Implement order placement and confirmation UI
    - On "Place Order" click, POST to `/api/public/orders` with tableToken and items array
    - Display order confirmation page with order reference number, items summary, and total
    - Handle error responses: show user-friendly messages for unavailable items
    - Allow placing additional orders from same table after confirmation
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

  - [x] 11.3 Create error/not-found pages for table routes
    - Generic error page for invalid table tokens (no internal detail leakage)
    - Not-found page for single-mode restaurants accessed via table URL
    - Consistent styling with existing customer website
    - _Requirements: 3.3, 3.4, 5.5_

- [x] 12. Final checkpoint - Ensure all tests pass across all codebases
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses TypeScript with Jest + fast-check for testing
- The Flutter owner app uses Dart with standard widget testing
- The customer website uses Next.js 14 with TypeScript
- All V2 routes reuse existing `authenticate` and `requireRole` middleware
- FCM integration requires Firebase Admin SDK setup in the backend

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.6"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5"] },
    { "id": 3, "tasks": ["2.1", "2.6", "2.8", "3.1"] },
    { "id": 4, "tasks": ["2.2", "2.3", "2.7", "2.9", "3.2", "3.3"] },
    { "id": 5, "tasks": ["2.4", "2.5"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 7, "tasks": ["5.7"] },
    { "id": 8, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2"] },
    { "id": 11, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 12, "tasks": ["9.8"] },
    { "id": 13, "tasks": ["11.1"] },
    { "id": 14, "tasks": ["11.2", "11.3"] }
  ]
}
```
