# Technical Documentation — RestroQR

## Table of Contents

- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Order Lifecycle](#order-lifecycle)
- [Security](#security)
- [Folder Structure](#folder-structure)
- [Testing Strategy](#testing-strategy)
- [Deployment Architecture](#deployment-architecture)

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Node.js + Express + TypeScript | Node 18, Express 4 |
| **Database** | PostgreSQL (Neon) | 14+ |
| **Migrations** | node-pg-migrate | 7.x |
| **Auth** | JWT (jsonwebtoken) | HS256 |
| **Push Notifications** | Firebase Cloud Messaging (Admin SDK) | 14.x |
| **Image Storage** | Cloudinary | v2 |
| **Owner App** | Flutter (Dart) | 3.11+ |
| **State Management** | Provider | 6.x |
| **HTTP Client** | Dio | 5.x |
| **Navigation** | go_router | 17.x |
| **Customer Website** | Next.js 14 (App Router) | 14.x |
| **Styling** | Tailwind CSS | 3.x |
| **Admin Panel** | React + Vite + TypeScript | React 18 |
| **Testing** | Jest + fast-check + supertest | — |
| **CI/CD** | GitHub → Render (backend), Vercel (frontend) | Auto-deploy |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                     │
├────────────────────┬──────────────────────┬──────────────────────────┤
│  Flutter Owner App │  Next.js Customer    │  React Admin Panel       │
│  (Android)         │  Website (Vercel)    │  (Vercel/Render)         │
│                    │                      │                          │
│  - Menu CRUD       │  - View menu         │  - Manage owners         │
│  - Table mgmt      │  - Place orders      │  - Manage restaurants    │
│  - Order mgmt      │  - Order confirm     │  - System admin          │
│  - Earnings        │                      │                          │
│  - FCM push        │                      │                          │
└────────┬───────────┴──────────┬───────────┴────────────┬─────────────┘
         │                      │                        │
         │         REST API (HTTPS)                      │
         ▼                      ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Render)                                    │
│                                                                       │
│  Express.js Application                                               │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Middleware: CORS → Helmet → Rate Limiter → JSON Parser         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┬──────────────┬──────────────┬────────────────────┐ │
│  │ Auth Routes  │ Owner Routes │ Public Routes│ Admin Routes       │ │
│  │              │              │              │                    │ │
│  │ POST /login  │ /restaurant  │ /menu/:token │ /owners            │ │
│  │ POST /register│ /categories │ /orders      │ /restaurants       │ │
│  │              │ /items       │              │                    │ │
│  │              │ /tables      │              │                    │ │
│  │              │ /orders      │              │                    │ │
│  │              │ /earnings    │              │                    │ │
│  │              │ /analytics   │              │                    │ │
│  │              │ /settings    │              │                    │ │
│  │              │ /notifications│             │                    │ │
│  └──────────────┴──────────────┴──────────────┴────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Service Layer: authService, tableService, orderService,        │ │
│  │  earningsService, notificationService, settingsService          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│   PostgreSQL     │ │  Firebase FCM   │ │   Cloudinary     │
│   (Neon)         │ │                 │ │                  │
│                  │ │  Push notifs    │ │  Image storage   │
│  12 tables       │ │  to owner app   │ │  logos, items    │
└──────────────────┘ └─────────────────┘ └──────────────────┘
```

---

## Database Schema

### Entity Relationship Diagram

```
┌───────────────┐       ┌────────────────────┐       ┌──────────────┐
│   admins      │       │   owners           │       │  fcm_tokens  │
│               │       │                    │       │              │
│  id (PK)      │       │  id (PK)           │◄──────│  owner_id(FK)│
│  email        │       │  name              │       │  token       │
│  password_hash│       │  email             │       └──────────────┘
└───────────────┘       │  password_hash     │
                        │  phone             │
                        └────────┬───────────┘
                                 │ 1:1
                                 ▼
                        ┌────────────────────┐
                        │   restaurants      │
                        │                    │
                        │  id (PK)           │
                        │  owner_id (FK)     │
                        │  name              │
                        │  address           │
                        │  phone             │
                        │  restaurant_token  │
                        │  logo_url          │
                        │  cover_image_url   │
                        │  qr_mode           │  ◄── 'single' | 'multi'
                        │  status            │
                        └──┬──────────┬──────┘
                           │          │
                   ┌───────┘          └──────────┐
                   ▼                             ▼
          ┌────────────────┐           ┌──────────────────┐
          │  categories    │           │   tables         │
          │                │           │                  │
          │  id (PK)       │           │  id (PK)         │
          │  restaurant_id │           │  restaurant_id   │
          │  name          │           │  display_name    │
          │  display_order │           │  table_token     │  ◄── AES-256-GCM encrypted
          └───────┬────────┘           └────────┬─────────┘
                  │                             │
                  ▼                             ▼
          ┌────────────────┐           ┌──────────────────┐
          │  food_items    │           │   orders         │
          │                │           │                  │
          │  id (PK)       │           │  id (PK)         │
          │  category_id   │           │  restaurant_id   │
          │  name          │           │  table_id (FK)   │
          │  description   │           │  order_ref       │  ◄── "ORD-XXXXXX"
          │  price         │           │  status          │  ◄── order_status enum
          │  image_url     │           │  total           │
          │  badge         │           │  created_at      │
          │  is_available  │           │  accepted_at     │
          └───────┬────────┘           │  completed_at    │
                  │                    │  payment_received_at│
                  │                    │  cancelled_at    │
                  │                    └────────┬─────────┘
                  │                             │
                  └──────────┐    ┌─────────────┘
                             ▼    ▼
                    ┌──────────────────────┐
                    │   order_items        │
                    │                      │
                    │  id (PK)             │
                    │  order_id (FK)       │  ◄── CASCADE delete
                    │  food_item_id (FK)   │  ◄── SET NULL on delete
                    │  item_name           │  ◄── Snapshot at order time
                    │  item_price          │  ◄── Snapshot at order time
                    │  quantity            │  ◄── CHECK >= 1
                    └──────────────────────┘
```

### Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `admins` | Platform administrators | email, password_hash |
| `owners` | Restaurant owners (app users) | name, email, password_hash |
| `restaurants` | Restaurant profiles | name, address, qr_mode, restaurant_token |
| `categories` | Menu categories | name, display_order |
| `food_items` | Menu items | name, price, badge, is_available |
| `tables` | Physical tables (V2) | display_name, table_token (encrypted) |
| `orders` | Customer orders (V2) | order_ref, status, total, timestamps |
| `order_items` | Order line items (V2) | item_name, item_price (snapshots), quantity |
| `fcm_tokens` | Push notification tokens (V2) | owner_id, token |

### Enums

```sql
-- Order lifecycle states
CREATE TYPE order_status AS ENUM (
  'pending',
  'accepted',
  'completed',
  'payment_received',
  'cancelled'
);
```

### Indexes

```sql
-- Performance indexes for order queries
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_food_item_id ON order_items(food_item_id);
CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_fcm_tokens_owner_id ON fcm_tokens(owner_id);
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register new owner |
| POST | `/api/auth/login` | — | Login (returns JWT) |

### Owner Routes (require JWT + role:owner)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/owner/restaurant` | Get restaurant profile |
| POST | `/api/owner/restaurant` | Create restaurant |
| PUT | `/api/owner/restaurant` | Update restaurant |
| POST | `/api/owner/restaurant/images` | Upload logo/cover |
| GET | `/api/owner/categories` | List categories |
| POST | `/api/owner/categories` | Create category |
| PATCH | `/api/owner/categories/:id` | Update category |
| DELETE | `/api/owner/categories/:id` | Delete category |
| GET | `/api/owner/items/:categoryId` | List items |
| POST | `/api/owner/items` | Create item |
| PATCH | `/api/owner/items/:id` | Update item |
| DELETE | `/api/owner/items/:id` | Delete item |
| PATCH | `/api/owner/settings/qr-mode` | Toggle QR mode |
| POST | `/api/owner/tables` | Create table |
| GET | `/api/owner/tables` | List tables |
| PATCH | `/api/owner/tables/:id` | Update table name |
| DELETE | `/api/owner/tables/:id` | Delete table |
| GET | `/api/owner/tables/:id/qr` | Download QR PNG |
| GET | `/api/owner/orders` | List orders (paginated) |
| PATCH | `/api/owner/orders/:id/status` | Update order status |
| POST | `/api/owner/orders/:id/cancel` | Cancel order |
| GET | `/api/owner/earnings/summary` | Monthly summary |
| GET | `/api/owner/earnings/breakdown` | Period breakdown |
| GET | `/api/owner/earnings/history` | Order history |
| GET | `/api/owner/analytics/items` | Item analytics |
| POST | `/api/owner/notifications/register` | Register FCM token |
| DELETE | `/api/owner/notifications/unregister` | Unregister FCM token |

### Public Routes (no auth, rate limited)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/menu/:token` | Get restaurant menu |
| POST | `/api/public/orders` | Place order from table |

### Admin Routes (require JWT + role:admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/owners` | List owners |
| GET | `/api/admin/restaurants` | List restaurants |
| PATCH | `/api/admin/restaurants/:id/status` | Enable/disable restaurant |

---

## Order Lifecycle

### State Machine

```
                    ┌─────────────┐
                    │   pending   │ ← Order placed by customer
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │ accept     │            │ cancel
              ▼            │            ▼
      ┌──────────────┐    │    ┌──────────────┐
      │   accepted   │    │    │  cancelled   │ (terminal)
      └──────┬───────┘    │    └──────────────┘
             │             │            ▲
             │ complete    │            │ cancel
             ▼             │            │
      ┌──────────────┐    │    ┌───────┘
      │  completed   │────┘    │
      └──────┬───────┘─────────┘
             │
             │ mark paid
             ▼
      ┌──────────────────────┐
      │  payment_received    │ (terminal)
      └──────────────────────┘
```

### Valid Transitions

| From | To | Action |
|------|-----|--------|
| `pending` | `accepted` | Owner accepts order |
| `pending` | `cancelled` | Owner cancels |
| `accepted` | `completed` | Kitchen done |
| `accepted` | `cancelled` | Owner cancels |
| `completed` | `payment_received` | Customer pays at counter |
| `completed` | `cancelled` | Owner cancels |

### Timestamps

Each transition sets its corresponding column:
- `accepted_at` — when accepted
- `completed_at` — when completed
- `payment_received_at` — when paid
- `cancelled_at` — when cancelled

---

## Security

### Authentication
- **JWT tokens** with HS256 signing
- Tokens include: `sub` (user ID), `role` (owner/admin), `iat`, `exp`
- 24-hour expiration
- Passwords hashed with **bcrypt** (12 rounds)

### Table Token Encryption
- **AES-256-GCM** encryption for table identifiers
- Prevents enumeration of table URLs
- Format: `base64url(iv[12] + authTag[16] + ciphertext)`
- Key loaded from `TABLE_TOKEN_SECRET` env variable
- Invalid tokens return generic 404 (no information leakage)

### Rate Limiting
- Public routes: 100 requests/15 minutes per IP
- Auth routes: 10 requests/15 minutes per IP
- Prevents brute force and abuse

### Other
- Helmet.js for security headers
- CORS configured for allowed origins
- Parameterized SQL queries (no SQL injection)
- Input validation on all endpoints
- Owner isolation (can only access own restaurant data)

---

## Folder Structure

```
RestroQr/
│
├── backend/                          # Node.js/Express/TypeScript API
│   ├── migrations/                   # Database migrations (001-012)
│   │   ├── 001_create-enums.js
│   │   ├── 002_create-admins-table.js
│   │   ├── 003_create-owners-table.js
│   │   ├── 004_create-restaurants-table.js
│   │   ├── 005_create-categories-table.js
│   │   ├── 006_create-food-items-table.js
│   │   ├── 007_add-qr-mode-to-restaurants.js     # V2
│   │   ├── 008_create-order-status-enum.js       # V2
│   │   ├── 009_create-tables-table.js            # V2
│   │   ├── 010_create-orders-table.js            # V2
│   │   ├── 011_create-order-items-table.js       # V2
│   │   └── 012_create-fcm-tokens-table.js        # V2
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts                       # PostgreSQL pool
│   │   ├── errors/                               # Custom error hierarchy
│   │   │   ├── AppError.ts
│   │   │   ├── ValidationError.ts
│   │   │   ├── NotFoundError.ts
│   │   │   ├── AuthenticationError.ts
│   │   │   ├── ForbiddenError.ts
│   │   │   └── ConflictError.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts                           # JWT verification
│   │   │   ├── errorHandler.ts                   # Global error handler
│   │   │   ├── rateLimiter.ts                    # Rate limiting
│   │   │   └── notFound.ts                       # 404 handler
│   │   ├── routes/
│   │   │   ├── auth.ts                           # Login/Register
│   │   │   ├── admin/                            # Admin panel routes
│   │   │   ├── owner/                            # Owner app routes
│   │   │   │   ├── restaurant.ts
│   │   │   │   ├── categories.ts
│   │   │   │   ├── items.ts
│   │   │   │   ├── qr.ts
│   │   │   │   ├── tables.ts                     # V2
│   │   │   │   ├── orders.ts                     # V2
│   │   │   │   ├── earnings.ts                   # V2
│   │   │   │   ├── notifications.ts              # V2
│   │   │   │   └── settings.ts                   # V2
│   │   │   └── public/
│   │   │       ├── menu.ts
│   │   │       └── orders.ts                     # V2
│   │   ├── services/                             # Business logic
│   │   │   ├── authService.ts
│   │   │   ├── ownerRestaurantService.ts
│   │   │   ├── categoryService.ts
│   │   │   ├── foodItemService.ts
│   │   │   ├── publicMenuService.ts
│   │   │   ├── tableService.ts                   # V2 - Token encryption
│   │   │   ├── orderService.ts                   # V2 - Order CRUD
│   │   │   ├── earningsService.ts                # V2 - Analytics
│   │   │   ├── notificationService.ts            # V2 - FCM
│   │   │   └── settingsService.ts                # V2 - QR mode
│   │   ├── tests/
│   │   │   ├── helpers/                          # Test utilities
│   │   │   ├── integration/                      # HTTP integration tests
│   │   │   └── properties/                       # Property-based tests
│   │   └── index.ts                              # App entry point
│   ├── database.json                             # Migration config
│   ├── jest.config.ts
│   ├── package.json
│   └── Dockerfile
│
├── customer-website/                 # Next.js 14 (App Router)
│   ├── app/
│   │   ├── layout.tsx                            # Root layout + SEO
│   │   ├── page.tsx                              # Landing page
│   │   ├── sitemap.ts                            # Dynamic sitemap
│   │   ├── privacy-policy/page.tsx               # Privacy policy
│   │   ├── error/page.tsx                        # Error page
│   │   └── r/[token]/                            # Restaurant menu
│   │       ├── page.tsx                          # V1 menu view
│   │       └── t/[tableToken]/                   # V2 table ordering
│   │           ├── page.tsx
│   │           ├── error.tsx
│   │           └── not-found.tsx
│   ├── components/
│   │   ├── MenuHeader.tsx
│   │   ├── MenuContent.tsx
│   │   ├── TableMenuContent.tsx                  # V2
│   │   ├── OrderCartBar.tsx                      # V2
│   │   ├── CartContext.tsx                       # V2
│   │   ├── CategorySection.tsx
│   │   ├── SearchBar.tsx
│   │   └── FilterToggle.tsx
│   ├── lib/
│   │   ├── api.ts                                # Backend API client
│   │   └── menuFilter.ts                         # Client-side filtering
│   ├── public/
│   │   ├── robots.txt
│   │   ├── favicon.png
│   │   └── logo.png
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── owner-app-flutter/                # Flutter Android App
│   ├── lib/
│   │   ├── main.dart                             # App entry + routing
│   │   ├── models/
│   │   │   ├── auth_models.dart
│   │   │   ├── restaurant_models.dart
│   │   │   ├── table_model.dart                  # V2
│   │   │   ├── order_model.dart                  # V2
│   │   │   ├── order_item_model.dart             # V2
│   │   │   └── earnings_model.dart               # V2
│   │   ├── screens/
│   │   │   ├── login_screen.dart
│   │   │   ├── register_screen.dart
│   │   │   ├── dashboard_screen.dart
│   │   │   ├── profile_setup_screen.dart
│   │   │   ├── categories_screen.dart
│   │   │   ├── food_items_screen.dart
│   │   │   ├── qr_code_screen.dart
│   │   │   ├── orders_screen.dart                # V2
│   │   │   ├── tables_screen.dart                # V2
│   │   │   ├── earnings_screen.dart              # V2
│   │   │   ├── order_history_screen.dart         # V2
│   │   │   ├── item_analytics_screen.dart        # V2
│   │   │   └── qr_mode_settings_screen.dart      # V2
│   │   └── services/
│   │       ├── api_service.dart                  # HTTP client (Dio)
│   │       ├── auth_service.dart                 # Auth state management
│   │       ├── owner_api_service.dart            # V2 API calls
│   │       └── notification_handler.dart         # V2 FCM handling
│   ├── android/
│   │   ├── app/
│   │   │   ├── build.gradle.kts                  # Signing config
│   │   │   └── src/main/AndroidManifest.xml
│   │   └── key.properties                        # (gitignored)
│   └── pubspec.yaml
│
├── admin-panel/                      # React Admin Dashboard
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   └── package.json
│
├── .kiro/specs/                      # Feature specifications
├── README.md
├── TECHNICAL.md
└── .gitignore
```

---

## Testing Strategy

### Property-Based Tests (fast-check)

17 correctness properties ensuring universal invariants:

| # | Property | Validates |
|---|----------|-----------|
| 1 | QR Mode Validation | Only 'single'/'multi' accepted |
| 2 | Mode Switch Preserves Data | Toggle doesn't delete data |
| 3 | Token Encryption Round-Trip | Encrypt→decrypt = original |
| 4 | Token Uniqueness | All tokens distinct |
| 5 | Invalid Token Handling | Generic error, no leakage |
| 6 | Order Item Validation | All-or-nothing rejection |
| 7 | Order Total Integrity | Total = Σ(price × qty) |
| 8 | Initial Order State | Always starts as 'pending' |
| 9 | Multiple Orders Per Table | N orders = N records |
| 10 | Status Transition Enforcement | Only valid pairs work |
| 11 | Cancellation Rules | Only from valid states |
| 12 | Transition Timestamps | Correct timestamp set |
| 13 | Notification Payload | Contains table + total |
| 14 | Earnings Filter | Only payment_received counted |
| 15 | Pagination Correctness | Correct page subset |
| 16 | Analytics Aggregation | Totals match records |
| 17 | Snapshot Preservation | Delete item preserves snapshot |

### Integration Tests

Full HTTP request-response cycle tests:
- Table CRUD flow + QR generation
- Order placement (valid + error cases)
- Order lifecycle transitions
- Earnings and pagination
- FCM registration and notification flow

---

## Deployment Architecture

```
GitHub (master branch)
       │
       ├──── Auto Deploy ────► Render (Backend API)
       │                        └── Port 3000
       │                        └── ENV: DATABASE_URL, JWT_SECRET, etc.
       │
       └──── Auto Deploy ────► Vercel (Customer Website)
                                └── Next.js serverless
                                └── ENV: NEXT_PUBLIC_API_URL

Database: Neon PostgreSQL (ap-southeast-1)
Push Notifications: Firebase Cloud Messaging
Images: Cloudinary CDN
```

### Scaling Considerations

- **Database**: Neon auto-scales, connection pooling via pg pool
- **Backend**: Render auto-restart, horizontal scaling available
- **Frontend**: Vercel edge network, ISR where applicable
- **Order polling**: 10-second interval (not WebSocket) — simpler, sufficient for current scale

---

## Workflow: Customer Places an Order

```
Customer                    Website                 Backend                    Owner App
   │                          │                       │                          │
   │  Scans table QR          │                       │                          │
   │─────────────────────────►│                       │                          │
   │                          │  GET /public/menu     │                          │
   │                          │──────────────────────►│                          │
   │                          │◄──────────────────────│  Menu data               │
   │  Browses menu            │                       │                          │
   │  Adds items to cart      │                       │                          │
   │  Taps "Place Order"      │                       │                          │
   │─────────────────────────►│                       │                          │
   │                          │  POST /public/orders  │                          │
   │                          │──────────────────────►│                          │
   │                          │                       │  Decrypt token           │
   │                          │                       │  Validate items          │
   │                          │                       │  Calculate total         │
   │                          │                       │  Insert order            │
   │                          │                       │  Send FCM push ─────────►│
   │                          │◄──────────────────────│                          │
   │  Order confirmation      │                       │               Push notif │
   │  (ref: ORD-ABC123)       │                       │                          │
   │                          │                       │                          │
   │                          │                       │  Owner opens app         │
   │                          │                       │◄─────────────────────────│
   │                          │                       │  GET /owner/orders       │
   │                          │                       │  Accepts order           │
   │                          │                       │  PATCH status=accepted   │
   │                          │                       │  ...                     │
   │                          │                       │  Marks paid              │
   │                          │                       │  PATCH status=payment_   │
   │                          │                       │       received           │
```

---

<p align="center">
  <em>RestroQR — Built by Kartik Sharma at CodeUpPath</em>
</p>
