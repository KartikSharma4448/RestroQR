# Implementation Plan: RestroQR V1 Digital Menu

## Overview

This plan implements the RestroQR V1 digital QR menu platform as a monorepo with four workspaces: a Node.js/Express backend API with PostgreSQL, a React SPA admin panel, an Android/Kotlin owner app, and a Next.js customer website. Tasks are ordered so that foundational infrastructure and shared interfaces come first, followed by backend logic, then client applications that consume the API.

## Tasks

- [x] 1. Project setup and infrastructure
  - [x] 1.1 Initialize monorepo structure and backend project
    - Create root monorepo structure with directories: `backend/`, `admin-panel/`, `customer-website/`
    - Initialize `backend/` as a Node.js/TypeScript project with Express, dotenv, cors, helmet
    - Add dev dependencies: typescript, ts-node-dev, eslint, prettier
    - Configure `tsconfig.json` with strict mode
    - Create `.env.example` with placeholders for DATABASE_URL, JWT_SECRET, CLOUDINARY_URL, PORT
    - _Requirements: All (infrastructure foundation)_

  - [x] 1.2 Set up PostgreSQL database schema and migrations
    - Install and configure a migration tool (e.g., `node-pg-migrate` or `knex`)
    - Create migration for `admins` table (uuid PK, email unique, password_hash, created_at)
    - Create migration for `owners` table (uuid PK, email unique nullable, phone unique nullable, password_hash, name, status enum, created_at, updated_at) with CHECK constraint (email IS NOT NULL OR phone IS NOT NULL)
    - Create migration for `restaurants` table (uuid PK, owner_id FK unique, name, address, phone, logo_url, cover_image_url, restaurant_token unique, status enum, created_at, updated_at)
    - Create migration for `categories` table (uuid PK, restaurant_id FK cascade, name, display_order, created_at, updated_at) with UNIQUE(restaurant_id, LOWER(name))
    - Create migration for `food_items` table (uuid PK, category_id FK cascade, restaurant_id FK cascade, name, description, price decimal(8,2) with CHECK, image_url, badge enum, is_available boolean, created_at, updated_at)
    - Create a seed script to insert a default admin account
    - _Requirements: 1.1–1.6, 2.1–2.4, 3.1, 4.1–4.2, 5.1–5.6, 6.1–6.6_

  - [x] 1.3 Set up testing framework for backend
    - Install Jest, ts-jest, supertest, fast-check
    - Configure `jest.config.ts` with TypeScript support
    - Create test utility helpers (DB setup/teardown, test fixtures, auth token generator)
    - _Requirements: All (testing infrastructure)_

- [x] 2. Backend API — Authentication and middleware
  - [x] 2.1 Implement JWT authentication middleware and role-based access control
    - Create `src/middleware/auth.ts` with JWT verification and role extraction (admin | owner)
    - Implement `requireRole('admin')` and `requireRole('owner')` guard middleware
    - Implement token generation utility (sign JWT with id, role, expiry)
    - Disabled account check: reject requests from disabled owners at middleware level
    - _Requirements: 3.2, 3.5, 2.3_

  - [x] 2.2 Implement owner registration endpoint (POST /api/auth/register)
    - Validate input: at least one of email/phone, valid email format, 10-digit phone, password ≥8 chars
    - Hash password with bcrypt (cost factor 12)
    - Check for existing email/phone (return CONFLICT if duplicate)
    - Insert owner record, return JWT token
    - _Requirements: 3.1, 3.4, 3.6_

  - [x] 2.3 Implement login endpoint (POST /api/auth/login)
    - Accept email/phone + password
    - Lookup owner or admin by identifier
    - Verify password hash; on failure return uniform AUTHENTICATION_FAILED error
    - Check account status; if disabled return ACCOUNT_DISABLED error
    - On success return JWT token with role
    - _Requirements: 3.2, 3.3, 3.5_

  - [x] 2.4 Write property tests for authentication (Properties 5, 6, 7, 8)
    - **Property 5: Disabled owner account blocks authentication**
    - **Property 6: Re-enabling an owner account restores authentication**
    - **Property 7: Registration input validation**
    - **Property 8: Authentication error uniformity**
    - **Validates: Requirements 2.3, 2.4, 3.1, 3.3, 3.4, 3.5, 3.6**

  - [x] 2.5 Implement global error handling middleware
    - Create `src/middleware/errorHandler.ts` with consistent JSON error response format
    - Map known error types (ValidationError, AuthError, ConflictError, NotFoundError) to appropriate HTTP codes
    - Strip stack traces in production; log full error internally
    - _Requirements: 12.6, 3.3_

  - [x] 2.6 Implement rate limiting middleware
    - Install and configure `express-rate-limit` (60 requests/minute/IP for public routes)
    - Return RATE_LIMITED (429) error when exceeded
    - _Requirements: 12.3, 12.4_

- [x] 3. Checkpoint - Backend auth and middleware
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend API — Admin endpoints
  - [x] 4.1 Implement admin restaurant management endpoints
    - GET /api/admin/restaurants — paginated list (name, owner name, status), accept `page` and `pageSize` query params
    - GET /api/admin/restaurants/:id — full restaurant profile with owner details and creation date
    - PUT /api/admin/restaurants/:id — edit restaurant details
    - PATCH /api/admin/restaurants/:id/status — enable/disable restaurant
    - DELETE /api/admin/restaurants/:id — cascade delete (restaurant, categories, food items, Cloudinary images)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.2 Write property tests for admin restaurant management (Properties 1, 2, 3, 4)
    - **Property 1: Pagination returns correct subset**
    - **Property 2: Disabled restaurant blocks public menu access**
    - **Property 3: Restaurant deletion cascades to all associated data**
    - **Property 4: Re-enabling a restaurant restores public menu access**
    - **Validates: Requirements 1.1, 1.4, 1.5, 1.6, 9.2, 12.5**

  - [x] 4.3 Implement admin owner account management endpoints
    - GET /api/admin/owners — list all owners (name, email/phone, status)
    - GET /api/admin/owners/:id — full owner details with associated restaurant
    - PATCH /api/admin/owners/:id/status — enable/disable owner account
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Backend API — Owner endpoints
  - [x] 5.1 Implement restaurant profile CRUD endpoints
    - POST /api/owner/restaurant — create profile (validate required fields: name, address, phone), generate restaurant_token using nanoid (10 chars, alphanumeric), generate QR code PNG
    - GET /api/owner/restaurant — get own restaurant profile
    - PUT /api/owner/restaurant — update profile (prevent token modification)
    - POST /api/owner/restaurant/images — upload logo/cover via multipart, validate type (JPEG/PNG/WebP) and size (≤5MB), upload to Cloudinary, store URL
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2_

  - [x] 5.2 Write property tests for restaurant profile (Properties 9, 10, 11, 12)
    - **Property 9: Restaurant token generation correctness**
    - **Property 10: Entity update round-trip**
    - **Property 11: Restaurant profile field validation**
    - **Property 12: Image upload validation**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 7.1, 7.2**

  - [x] 5.3 Implement category management endpoints
    - POST /api/owner/categories — create category (validate name 1-50 chars, case-insensitive unique per restaurant)
    - GET /api/owner/categories — list categories ordered by display_order
    - PUT /api/owner/categories/:id — update category name (validate uniqueness)
    - DELETE /api/owner/categories/:id — delete category and cascade to food items
    - PUT /api/owner/categories/reorder — accept array of category IDs, update display_order accordingly
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 5.4 Write property tests for category management (Properties 13, 14, 15)
    - **Property 13: Category name uniqueness (case-insensitive)**
    - **Property 14: Category deletion cascades to food items**
    - **Property 15: Category reorder persistence**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.5**

  - [x] 5.5 Implement food item CRUD endpoints
    - POST /api/owner/items — create food item (validate name 1-100 chars, price 0.01-999999.99, badge required, optional image via Cloudinary)
    - GET /api/owner/categories/:id/items — list items in category
    - PUT /api/owner/items/:id — update food item fields
    - DELETE /api/owner/items/:id — delete food item (also delete Cloudinary asset if image exists)
    - PATCH /api/owner/items/:id/availability — toggle is_available
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.6 Write property tests for food items (Properties 16, 17)
    - **Property 16: Food item creation validation**
    - **Property 17: Token immutability across menu changes**
    - **Validates: Requirements 6.1, 6.5, 7.4**

  - [x] 5.7 Implement QR code generation and download endpoint
    - GET /api/owner/qr — generate QR code PNG (min 300x300px) encoding `restroqr.com/r/{restaurant_token}`
    - Use a library like `qrcode` to generate PNG buffer
    - Return as image/png content-type for direct download
    - Handle case where profile not yet complete (return error)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Checkpoint - Backend owner endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend API — Public menu endpoint
  - [x] 7.1 Implement public menu endpoint (GET /api/public/menu/:token)
    - Lookup restaurant by token; if not found or disabled, return NOT_FOUND with generic error (no internal info leakage)
    - Return restaurant info (name, logo_url, cover_image_url) + categories ordered by display_order + food items per category
    - Ensure error response is uniform for invalid format vs non-existent token
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 12.1, 12.5, 12.6_

  - [x] 7.2 Write property tests for public menu (Properties 18, 19, 20)
    - **Property 18: Menu items grouped by category in display order**
    - **Property 19: Search and filter composition**
    - **Property 20: Error pages do not leak internal information**
    - **Validates: Requirements 9.4, 10.1–10.5, 12.1, 12.6**

- [x] 8. Checkpoint - Full backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Admin Panel (React SPA)
  - [x] 9.1 Initialize React admin panel project
    - Create React project (Vite + TypeScript) in `admin-panel/`
    - Install dependencies: react-router-dom, axios, tailwindcss (or preferred UI library)
    - Set up routing structure (LoginPage, DashboardPage, RestaurantsPage, RestaurantDetailPage, OwnersPage)
    - Create `services/api.ts` with axios instance configured for base URL and JWT auth interceptor
    - Create `services/auth.ts` for login/logout/token storage
    - _Requirements: 1.1–1.6, 2.1–2.4_

  - [x] 9.2 Implement admin login page
    - Build login form with email/password fields
    - Call POST /api/auth/login with role=admin
    - Store JWT in localStorage, redirect to dashboard on success
    - Display error messages on failure
    - _Requirements: 3.2, 3.3_

  - [x] 9.3 Implement restaurant management pages
    - RestaurantsPage: paginated table of restaurants (name, owner, status) with enable/disable/delete actions
    - RestaurantDetailPage: full restaurant profile view with edit form
    - ConfirmDialog component for delete confirmation
    - StatusBadge component for active/disabled visual indicator
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 9.4 Implement owner account management page
    - OwnersPage: list of owners (name, email/phone, status) with enable/disable actions
    - Owner detail view showing associated restaurant and registration date
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 10. Customer Website (Next.js)
  - [x] 10.1 Initialize Next.js customer website project
    - Create Next.js project (App Router, TypeScript) in `customer-website/`
    - Install dependencies: tailwindcss, next/image optimization config
    - Configure `next.config.js` for Cloudinary image domains
    - Create `lib/api.ts` with fetch wrapper for backend API calls
    - Set up layout.tsx with meta tags, viewport configuration for mobile-first
    - _Requirements: 11.1, 11.2_

  - [x] 10.2 Implement menu page (app/r/[token]/page.tsx) with SSR
    - Server-side fetch: call GET /api/public/menu/{token}
    - If error (not found / disabled), redirect to error page
    - Render MenuHeader component (restaurant name, logo, cover image with placeholder fallbacks)
    - Render CategorySection components with FoodItemCard components
    - Display items grouped by category in owner-defined display order
    - Show UnavailableBadge on unavailable items
    - Implement responsive layout (mobile-first, 320px–1440px, no horizontal scroll)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 11.1_

  - [x] 10.3 Implement search and filter functionality
    - SearchBar component with real-time text input (case-insensitive substring match on name + description)
    - FilterToggle component for Veg/Non-Veg filter buttons
    - Client-side filtering logic: combine search term AND badge filter
    - Display "no items match" message when filters yield zero results
    - Clear all filters restores full menu
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 10.4 Implement error page and image optimization
    - Error page at app/error/page.tsx — generic "menu unavailable" message, no internal info leakage
    - Configure Next.js Image component for Cloudinary CDN images (≤200KB compressed)
    - Ensure all images have alt text and loading states
    - _Requirements: 9.2, 11.2, 11.3, 12.1, 12.5, 12.6_

  - [x] 10.5 Write E2E tests for customer website (Playwright)
    - Test QR URL navigation renders correct menu
    - Test search filtering updates in real-time
    - Test Veg/Non-Veg filter toggles
    - Test responsive layout at breakpoints (320px, 375px, 768px, 1440px)
    - Test error page for invalid tokens
    - Test unavailable item visual indicator
    - _Requirements: 9.1–9.7, 10.1–10.6, 11.1, 12.1_

- [x] 11. Checkpoint - Web clients complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Owner App (Android/Kotlin)
  - [x] 12.1 Initialize Android project with Hilt and Retrofit
    - Create Android project in `owner-app/` with Kotlin, Jetpack Compose or XML layouts
    - Configure Hilt for dependency injection (AppModule with Retrofit, OkHttp interceptor for JWT)
    - Define `RestroQrApi.kt` Retrofit interface with all owner and auth endpoints
    - Create data models matching API response/request DTOs
    - Set up repository pattern with `AuthRepository`, `RestaurantRepository`, `MenuRepository`
    - _Requirements: 3.1–3.6, 4.1–4.5, 5.1–5.6, 6.1–6.6, 7.1–7.5, 8.1–8.4_

  - [x] 12.2 Implement registration and login screens
    - RegisterFragment: form with email/phone, password fields; input validation (client-side before API call)
    - LoginFragment: email/phone + password form
    - Handle API errors: display inline validation errors, disabled account message, generic auth failure
    - Store JWT token securely (EncryptedSharedPreferences)
    - Navigate to dashboard on success, profile setup if new registration
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 12.3 Implement dashboard and restaurant profile screens
    - DashboardFragment: show restaurant name, logo, address, phone, QR code; navigation to menu/profile/QR
    - If profile not set up, show prompt to complete setup (omit QR code)
    - ProfileSetupFragment: form for name (max 100), address (max 250), phone (max 20), logo upload, cover upload
    - Image picker with validation (JPEG/PNG/WebP, ≤5MB)
    - On save, call POST/PUT /api/owner/restaurant + POST /api/owner/restaurant/images
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4_

  - [x] 12.4 Implement category management screens
    - CategoriesFragment: display categories in owner-defined order with drag-to-reorder
    - Add category dialog (name input, 1-50 chars, uniqueness validation)
    - Edit category name, delete with confirmation (warns about food item cascade)
    - Call reorder endpoint on drag completion
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 12.5 Implement food item management screens
    - FoodItemsFragment: list items in selected category
    - FoodItemFormFragment: add/edit form (name, description, price, image, veg/non-veg toggle, availability)
    - Client-side validation before API calls
    - Delete item with confirmation
    - Toggle availability via PATCH endpoint
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 12.6 Implement QR code display and download
    - QrCodeFragment: display QR code image from GET /api/owner/qr
    - Download button: save QR PNG to device gallery/downloads
    - Handle error (profile not complete, generation failure) with retry option
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 12.7 Write Android UI tests (Espresso/Compose testing)
    - Test registration and login flows
    - Test profile setup with image upload
    - Test category CRUD and reorder
    - Test food item CRUD
    - Test QR code download
    - Test offline error handling and retry
    - _Requirements: 3.1–3.6, 4.1–4.5, 5.1–5.6, 6.1–6.6, 7.1–7.5_

- [x] 13. Checkpoint - Owner app complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Integration tests and deployment configuration
  - [x] 14.1 Write backend integration tests
    - Full API request-response cycles with test PostgreSQL database
    - Auth flow: register → login → access protected route → disabled account rejection
    - Admin flow: list restaurants → disable → verify public menu blocked → re-enable → verify restored
    - Owner flow: create profile → create categories → create items → public menu serves data
    - Cascade deletion verification at DB level (delete restaurant → verify categories and items gone)
    - Rate limiting behavior (verify 429 after 60 requests)
    - Image upload to Cloudinary mock and URL storage
    - _Requirements: 1.1–1.6, 2.1–2.4, 3.1–3.6, 4.1–4.5, 5.1–5.6, 6.1–6.6, 7.1–7.5, 9.1–9.7, 12.1–12.6_

  - [x] 14.2 Configure deployment (Docker + environment setup)
    - Create `Dockerfile` for backend API (Node.js production build)
    - Create `docker-compose.yml` with PostgreSQL and backend services for local development
    - Create deployment configuration for admin panel (static build, serve via CDN/Nginx)
    - Create deployment notes for customer website (Vercel/Next.js deployment)
    - Configure HTTPS enforcement and HTTP→HTTPS redirect at reverse proxy level
    - Document environment variables and secrets management
    - _Requirements: 11.2, 12.2_

- [x] 15. Final checkpoint - All components integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major milestones
- Property tests validate universal correctness properties defined in the design (20 properties total)
- The backend is the foundation — all client apps depend on it being complete first
- The Android Owner App and web clients can be developed in parallel once the backend is stable
- All image handling goes through Cloudinary for compression, CDN delivery, and cleanup
- JWT tokens carry role information; middleware validates both token validity and account status

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["2.4"] },
    { "id": 5, "tasks": ["4.1", "4.3", "5.1"] },
    { "id": 6, "tasks": ["4.2", "5.2", "5.3", "5.7"] },
    { "id": 7, "tasks": ["5.4", "5.5"] },
    { "id": 8, "tasks": ["5.6"] },
    { "id": 9, "tasks": ["7.1"] },
    { "id": 10, "tasks": ["7.2"] },
    { "id": 11, "tasks": ["9.1", "10.1", "12.1"] },
    { "id": 12, "tasks": ["9.2", "10.2", "12.2"] },
    { "id": 13, "tasks": ["9.3", "9.4", "10.3", "10.4", "12.3"] },
    { "id": 14, "tasks": ["10.5", "12.4", "12.5"] },
    { "id": 15, "tasks": ["12.6", "12.7"] },
    { "id": 16, "tasks": ["14.1", "14.2"] }
  ]
}
```
