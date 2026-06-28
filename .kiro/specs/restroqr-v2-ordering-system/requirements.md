# Requirements Document — RestroQR V2 Ordering System

## Introduction

RestroQR V2 extends the existing view-only digital QR menu platform with a full table-wise ordering system. All V2 features are additions to the existing applications — the existing Flutter Owner App (at `D:\RestroQr\owner-app-flutter`), the existing Next.js Customer Website (at `D:\RestroQr\customer-website`), and the existing Node.js Backend API (at `D:\RestroQr\backend`). No new applications are created; V2 functionality is built on top of the current V1 codebase. Owners can generate unique QR codes per table, receive real-time orders in the owner app, manage order lifecycle, track earnings, and receive push notifications. Customers place orders from their phone by scanning a table-specific QR code — payment happens at the counter (no online payment in V2).

## Glossary

- **Owner_App**: The existing Flutter-based Android application (at `owner-app-flutter/`) used by restaurant owners — V2 features are added as new screens and functionality within this app
- **Customer_Website**: The existing Next.js 14 web application (at `customer-website/`) — V2 adds the ordering flow (Place Order button, order confirmation) to the existing menu page
- **Backend_API**: The existing Node.js/Express/TypeScript REST API (at `backend/`) — V2 adds new routes, services, and database tables to the existing codebase
- **Order_Service**: The backend module responsible for order creation, status transitions, and retrieval
- **Table_Service**: The backend module responsible for table CRUD operations and encrypted QR link generation
- **Notification_Service**: The backend module responsible for sending FCM push notifications to the Owner_App
- **Restaurant**: A registered restaurant entity in the system, owned by exactly one Owner
- **Table**: A physical dining table within a Restaurant, identified by a unique encrypted table identifier
- **Table_Token**: An encrypted, URL-safe identifier for a table that prevents customers from guessing other table identifiers
- **Order**: A collection of one or more food items placed by a customer from a specific Table
- **Order_Status**: The lifecycle state of an Order: `pending`, `accepted`, `completed`, or `payment_received`
- **QR_Mode**: The QR configuration for a restaurant: either `single` (one QR for entire restaurant, V1 behavior) or `multi` (one QR per table)
- **FCM_Token**: A Firebase Cloud Messaging device token registered by the Owner_App for receiving push notifications
- **Earnings_Dashboard**: The section of the Owner_App displaying revenue summaries, order history, and per-item analytics

## Requirements

### Requirement 1: QR Mode Selection

**User Story:** As a restaurant owner, I want to freely switch between a single QR code (current V1 behavior) and table-wise QR codes at any time, so that I can adopt or revert the multi-table ordering system as needed.

#### Acceptance Criteria

1. THE Backend_API SHALL support a `qr_mode` field on the Restaurant entity with values `single` or `multi`
2. WHEN an owner sets `qr_mode` to `single`, THE Backend_API SHALL maintain the existing V1 behavior with a single restaurant-level QR code
3. WHEN an owner sets `qr_mode` to `multi`, THE Backend_API SHALL enable table management and ordering endpoints for that Restaurant
4. THE Owner_App SHALL display a QR mode toggle in the restaurant settings screen allowing the owner to switch between `single` and `multi` at any time
5. WHEN the owner switches `qr_mode` from `multi` to `single`, THE Backend_API SHALL retain existing table data and order history but disable table-specific QR links and new order placement
6. WHEN the owner switches `qr_mode` from `single` back to `multi`, THE Backend_API SHALL re-enable table-specific QR links and ordering using the previously created tables
7. THE Backend_API SHALL allow unlimited switches between `single` and `multi` mode without data loss

### Requirement 2: Table Management

**User Story:** As a restaurant owner, I want to add, remove, and manage tables from the owner app, so that each table has its own QR code for ordering.

#### Acceptance Criteria

1. WHEN an owner adds a table, THE Table_Service SHALL create a table record with a unique Table_Token
2. THE Table_Service SHALL generate Table_Tokens using cryptographic encryption so that customers cannot guess or enumerate other table identifiers
3. THE Backend_API SHALL expose the table-specific public URL in the format `/r/{restaurant_token}/t/{table_token}`
4. WHEN an owner removes a table, THE Backend_API SHALL delete the table record and invalidate the associated Table_Token
5. THE Owner_App SHALL allow the owner to assign a display name (e.g., "Table 5", "Patio 2") to each table
6. THE Owner_App SHALL display a list of all tables with their display names and QR download options
7. WHEN an owner requests a QR code for a table, THE Owner_App SHALL generate a downloadable PNG image containing the encrypted table URL
8. THE Backend_API SHALL allow the owner to add or remove tables without any hard limit on table count

### Requirement 3: Table-Specific Menu Access

**User Story:** As a customer, I want to scan a table QR code and view the restaurant menu associated with that table, so that I can place an order from my seat.

#### Acceptance Criteria

1. WHEN a customer navigates to `/r/{restaurant_token}/t/{table_token}`, THE Customer_Website SHALL decrypt the table_token and identify the corresponding table
2. WHEN a valid table_token is provided, THE Customer_Website SHALL display the restaurant menu with an active "Place Order" button
3. IF an invalid or expired table_token is provided, THEN THE Customer_Website SHALL display a generic error page without revealing internal details
4. IF the restaurant's `qr_mode` is `single`, THEN THE Backend_API SHALL reject table-specific URL requests with a generic not-found response
5. WHILE a table is active, THE Customer_Website SHALL associate the customer's session with that table for order placement

### Requirement 4: Order Placement

**User Story:** As a customer, I want to add items to my selection and place an order, so that the restaurant receives my order with the correct table number.

#### Acceptance Criteria

1. WHEN a customer adds items and taps "Place Order", THE Customer_Website SHALL submit the order to the Backend_API with the table identifier and list of items with quantities
2. THE Backend_API SHALL validate that all item IDs belong to the specified restaurant and are currently available
3. WHEN a valid order is submitted, THE Order_Service SHALL create an Order record with status `pending` and associate it with the table
4. WHEN an order is successfully created, THE Customer_Website SHALL display an order confirmation with an order reference number
5. THE Backend_API SHALL allow multiple orders from the same table (customers can place additional orders later)
6. IF any item in the order is unavailable, THEN THE Backend_API SHALL reject the entire order and return a descriptive error identifying the unavailable items
7. THE Order_Service SHALL store the order total price calculated server-side from current item prices at time of order placement

### Requirement 5: Order Lifecycle Management

**User Story:** As a restaurant owner, I want to accept, complete, and mark orders as paid, so that I can track order progress from kitchen to payment.

#### Acceptance Criteria

1. THE Order_Service SHALL enforce the status transition sequence: `pending` → `accepted` → `completed` → `payment_received`
2. WHEN an owner updates an order status, THE Backend_API SHALL validate that the transition follows the allowed sequence
3. IF an owner attempts an invalid status transition, THEN THE Backend_API SHALL reject the request with a validation error describing the allowed transitions
4. WHEN an owner cancels an order, THE Order_Service SHALL set the order status to `cancelled` from any state except `payment_received`
5. THE Customer_Website SHALL NOT provide any order cancellation functionality to the customer
6. WHEN an order status changes, THE Backend_API SHALL record a timestamp for the transition

### Requirement 6: Real-Time Order Display in Owner App

**User Story:** As a restaurant owner, I want to see new orders in real-time with table numbers and item details, so that I can act on orders quickly.

#### Acceptance Criteria

1. THE Owner_App SHALL display incoming orders in a list sorted by creation time (newest first)
2. WHEN a new order arrives, THE Owner_App SHALL display the table display name, item names, quantities, and order total
3. THE Owner_App SHALL group orders by status tabs: pending, accepted, completed, and payment_received
4. THE Owner_App SHALL provide action buttons for each valid status transition on the order card
5. WHEN the Owner_App is in the foreground, THE Owner_App SHALL poll for new orders at a regular interval not exceeding 10 seconds

### Requirement 7: Push Notifications

**User Story:** As a restaurant owner, I want to receive push notifications on new orders and cancellations, so that I am alerted even when the app is in the background.

#### Acceptance Criteria

1. WHEN the Owner_App is installed, THE Owner_App SHALL register its FCM device token with the Backend_API
2. WHEN a new order is placed, THE Notification_Service SHALL send an FCM push notification to the owner's registered device token
3. THE Notification_Service SHALL include the table display name and order total in the notification payload
4. WHEN an owner cancels an order, THE Notification_Service SHALL NOT send a notification for owner-initiated cancellations
5. IF the FCM delivery fails, THEN THE Notification_Service SHALL log the failure without blocking the order creation flow
6. WHEN an owner logs out, THE Owner_App SHALL unregister the FCM device token from the Backend_API

### Requirement 8: Earnings Dashboard

**User Story:** As a restaurant owner, I want to view my monthly earnings summary with daily, weekly, and monthly breakdowns, so that I can track revenue performance.

#### Acceptance Criteria

1. THE Owner_App SHALL display a monthly earnings summary showing total orders count and total revenue for the selected month
2. THE Owner_App SHALL provide daily, weekly, and monthly breakdown views of earnings data
3. THE Backend_API SHALL calculate earnings only from orders with status `payment_received`
4. THE Owner_App SHALL display an order history list with filters for date range and order status
5. THE Backend_API SHALL support pagination for order history requests with a default page size of 20

### Requirement 9: Per-Item Analytics

**User Story:** As a restaurant owner, I want to see which items sell the most, so that I can make informed menu decisions.

#### Acceptance Criteria

1. THE Backend_API SHALL track the total quantity ordered for each food item across all completed orders (status `payment_received`)
2. THE Owner_App SHALL display a ranked list of food items sorted by total quantity sold in descending order
3. THE Owner_App SHALL allow filtering per-item analytics by date range (daily, weekly, monthly)
4. THE Backend_API SHALL include the total revenue generated per item in analytics responses

### Requirement 10: Order Data Persistence and Integrity

**User Story:** As a system operator, I want order data to maintain referential integrity and support efficient querying, so that the system remains reliable under load.

#### Acceptance Criteria

1. THE Backend_API SHALL store orders in a PostgreSQL `orders` table with foreign keys to the restaurant and table
2. THE Backend_API SHALL store order line items in an `order_items` table with foreign keys to the order and food item
3. IF a food item is deleted after being ordered, THEN THE Backend_API SHALL retain the item name and price in the order_items record (snapshot at order time)
4. THE Backend_API SHALL create database indexes on order status, table_id, restaurant_id, and created_at columns for efficient querying
5. THE Backend_API SHALL enforce that order total equals the sum of (item price × quantity) for all items in the order
