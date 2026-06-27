# 🍽️ RestroQR — Digital QR Menu Platform

RestroQR is a complete digital QR menu platform that enables restaurant owners to create and manage a digital menu accessible via a single QR code. Customers scan the QR code and instantly view the restaurant's menu on their phone — no app download required.

> **V1 is strictly view-only** — no ordering, cart, or payment functionality.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Running with Docker](#-running-with-docker)
- [Running Individually](#-running-individually)
- [API Endpoints](#-api-endpoints)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [Screenshots](#-screenshots)
- [License](#-license)

---

## ✨ Features

### For Platform Admin
- View and manage all registered restaurants (paginated list)
- View full restaurant profiles with owner details
- Enable/disable restaurants (disabled = menu hidden from customers)
- Delete restaurants with cascade (all data removed)
- Manage owner accounts (enable/disable)

### For Restaurant Owners (Android App)
- Register with email or phone number
- Set up restaurant profile (name, address, phone, logo, cover image)
- Create and manage menu categories (drag-to-reorder)
- Add food items with name, description, price, image, veg/non-veg badge
- Toggle item availability (unavailable items still show but greyed out)
- Auto-generated permanent QR code (never changes even when menu updates)
- Download QR code as PNG for printing

### For Customers (Web)
- Scan QR code → instant menu in browser
- Mobile-first responsive design (320px to 1440px)
- Search menu items in real-time (name + description)
- Filter by Veg / Non-Veg
- Fast loading (< 3 seconds on 4G)
- No app download needed

### Security
- JWT authentication with role-based access (admin/owner)
- Rate limiting (60 req/min public, 10 req/min auth)
- HTTPS enforcement
- Disabled accounts blocked at middleware level
- Error pages never leak internal info (UUIDs, DB fields, stack traces)
- Uniform error responses for security (can't tell if token is invalid vs non-existent)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Internet                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  restroqr.com (Vercel)     admin.restroqr.com (Netlify)│
│  ┌───────────────┐         ┌───────────────┐           │
│  │ Customer Site │         │  Admin Panel  │           │
│  │  (Next.js)    │         │  (React SPA)  │           │
│  └───────┬───────┘         └───────┬───────┘           │
│          │                         │                    │
│          └─────────┬───────────────┘                    │
│                    │ HTTPS                              │
│           ┌────────▼────────┐                           │
│           │  Backend API    │  api.restroqr.com         │
│           │  (Node/Express) │                           │
│           └────────┬────────┘                           │
│                    │                                    │
│           ┌────────▼────────┐    ┌──────────────┐      │
│           │   PostgreSQL    │    │  Cloudinary  │      │
│           │   (Database)    │    │  (Image CDN) │      │
│           └─────────────────┘    └──────────────┘      │
│                                                         │
│  Owner App (Google Play Store)                          │
│  ┌───────────────┐                                     │
│  │ Android/Kotlin│ ──── HTTPS ──── Backend API         │
│  └───────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend API | Node.js, Express, TypeScript |
| Database | PostgreSQL with node-pg-migrate |
| Admin Panel | React, Vite, TypeScript, Tailwind CSS |
| Customer Website | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Owner App | Android, Kotlin, Jetpack Compose, Hilt, Retrofit |
| Image Storage | Cloudinary (CDN, compression, format conversion) |
| Authentication | JWT (jsonwebtoken), bcrypt |
| Testing | Jest, fast-check (property-based), Supertest, Playwright |
| Deployment | Docker, Docker Compose |

---

## 📁 Project Structure

```
RestroQr/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── config/            # Database pool configuration
│   │   ├── errors/            # Custom error classes (AppError, ValidationError, etc.)
│   │   ├── middleware/        # Auth, rate limiting, error handler
│   │   ├── routes/            # Express route handlers
│   │   │   ├── auth.ts        # Register & login
│   │   │   ├── admin/         # Admin endpoints
│   │   │   ├── owner/         # Owner endpoints
│   │   │   └── public/        # Public menu endpoint
│   │   ├── services/          # Business logic layer
│   │   ├── utils/             # Token utility, menu filter
│   │   ├── seeds/             # Admin account seed script
│   │   └── tests/             # Unit, property, integration tests
│   ├── migrations/            # PostgreSQL schema migrations
│   ├── Dockerfile
│   └── package.json
│
├── admin-panel/                # React SPA for platform admin
│   ├── src/
│   │   ├── pages/             # Login, Dashboard, Restaurants, Owners
│   │   ├── components/        # StatusBadge, ConfirmDialog
│   │   └── services/          # API client with JWT interceptor
│   ├── Dockerfile
│   └── package.json
│
├── customer-website/           # Next.js SSR website for customers
│   ├── app/
│   │   ├── r/[token]/         # Dynamic menu page (SSR)
│   │   └── error/             # Error page
│   ├── components/            # MenuHeader, FoodItemCard, SearchBar, FilterToggle
│   ├── lib/                   # API client, menu filter utility
│   ├── e2e/                   # Playwright E2E tests
│   └── package.json
│
├── owner-app/                  # Android Kotlin app for owners
│   └── app/src/main/java/com/restroqr/owner/
│       ├── ui/                # Compose screens (auth, dashboard, menu, QR)
│       ├── data/              # API interface, models, repositories
│       └── di/                # Hilt dependency injection
│
├── docker-compose.yml          # Local development (Postgres + Backend + Admin)
├── DEPLOYMENT.md               # Full deployment guide
└── README.md                   # This file
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16+ (or use Docker)
- **npm** 9+
- **Android Studio** (for owner app only)

### Clone the repo

```bash
git clone https://github.com/your-username/RestroQr.git
cd RestroQr
```

---

## 🐳 Running with Docker (Recommended)

The fastest way to get everything running:

```bash
# Start PostgreSQL + Backend + Admin Panel
docker compose up --build

# In another terminal, run database migrations
docker compose exec backend npx node-pg-migrate up --migrations-dir migrations --migration-file-language js

# Seed the default admin account
docker compose exec backend node dist/seeds/admin.seed.js
```

**Services will be available at:**

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Admin Panel | http://localhost:8080 |
| PostgreSQL | localhost:5432 |

**Default Admin Login:**
- Email: `admin@restroqr.com`
- Password: `Admin@123`

---

## 💻 Running Individually

### 1. Backend API

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your PostgreSQL URL, JWT_SECRET, etc.

# Run migrations
npm run migrate:up

# Seed admin account
npm run seed

# Start development server
npm run dev
```

API runs at `http://localhost:3000`

### 2. Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

Opens at `http://localhost:5173`

### 3. Customer Website

```bash
cd customer-website
npm install
npm run dev
```

Opens at `http://localhost:3001`

Visit `http://localhost:3001/r/{restaurant_token}` to view a menu.

### 4. Owner App (Android)

Open `owner-app/` in Android Studio and run on an emulator or device.

The app connects to `http://10.0.2.2:3000/api/` in debug mode (Android emulator localhost mapping).

---

## 📡 API Endpoints

### Authentication (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new owner |
| POST | `/api/auth/login` | Login (owner or admin) |

### Admin (Requires admin JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/restaurants` | List restaurants (paginated) |
| GET | `/api/admin/restaurants/:id` | Get restaurant details |
| PUT | `/api/admin/restaurants/:id` | Edit restaurant |
| PATCH | `/api/admin/restaurants/:id/status` | Enable/disable restaurant |
| DELETE | `/api/admin/restaurants/:id` | Delete restaurant (cascade) |
| GET | `/api/admin/owners` | List all owners |
| GET | `/api/admin/owners/:id` | Get owner details |
| PATCH | `/api/admin/owners/:id/status` | Enable/disable owner |

### Owner (Requires owner JWT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/owner/restaurant` | Create restaurant profile |
| GET | `/api/owner/restaurant` | Get own restaurant |
| PUT | `/api/owner/restaurant` | Update restaurant |
| POST | `/api/owner/restaurant/images` | Upload logo/cover |
| GET | `/api/owner/categories` | List categories |
| POST | `/api/owner/categories` | Create category |
| PUT | `/api/owner/categories/:id` | Update category |
| DELETE | `/api/owner/categories/:id` | Delete category |
| PUT | `/api/owner/categories/reorder` | Reorder categories |
| GET | `/api/owner/categories/:id/items` | List items in category |
| POST | `/api/owner/items` | Create food item |
| PUT | `/api/owner/items/:id` | Update food item |
| DELETE | `/api/owner/items/:id` | Delete food item |
| PATCH | `/api/owner/items/:id/availability` | Toggle availability |
| GET | `/api/owner/qr` | Download QR code (PNG) |

### Public (No auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/menu/:token` | Get full menu for customers |

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

**Test suite includes:**
- 20 property-based tests (fast-check, 100+ iterations each)
- Unit tests for services, middleware, validators
- Integration tests (full HTTP request-response cycles)
- ~150+ total test cases

### Customer Website E2E Tests

```bash
cd customer-website

# Install Playwright browsers (first time)
npx playwright install chromium

# Run E2E tests (starts dev server automatically)
npm run test:e2e
```

**37 E2E test specifications** covering menu rendering, search/filter, responsive layout, and error handling.

### Owner App UI Tests

Open in Android Studio and run `androidTest` suite — **56 Compose UI tests**.

---

## 🌐 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions covering:

- Docker self-hosted deployment
- Railway / Render (backend)
- Vercel (customer website)
- Netlify (admin panel)
- Google Play Store (owner app)
- HTTPS configuration
- Secrets management

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/restroqr
JWT_SECRET=your-secure-random-secret-64-chars-minimum
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
PORT=3000
NODE_ENV=development
```

### Admin Panel (build-time)
```env
VITE_API_URL=http://localhost:3000/api
```

### Customer Website
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 📸 Screenshots

> Screenshots coming soon. The platform includes:
> - Admin Panel with restaurant/owner management tables
> - Customer menu page with search, veg/non-veg filter, responsive design
> - Android Owner App with profile setup, category/item management, QR download

---

## 📊 Database Schema

```
admins (id, email, password_hash, created_at)
    │
owners (id, email, phone, password_hash, name, status, created_at, updated_at)
    │  CHECK: email IS NOT NULL OR phone IS NOT NULL
    │
    └── restaurants (id, owner_id UNIQUE, name, address, phone, logo_url,
    │               cover_image_url, restaurant_token UNIQUE, status, created_at, updated_at)
    │
    ├── categories (id, restaurant_id, name, display_order, created_at, updated_at)
    │               UNIQUE: (restaurant_id, LOWER(name))
    │
    └── food_items (id, category_id, restaurant_id, name, description,
                    price, image_url, badge, is_available, created_at, updated_at)
                    CHECK: price >= 0.01 AND price <= 999999.99
```

---

## 🔑 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single REST API | Simplifies deployment, auth, and data consistency across all 3 clients |
| PostgreSQL | Relational data with strong integrity constraints (FKs, CHECKs, unique indexes) |
| JWT authentication | Stateless auth suitable for mobile + web; role-based (admin vs owner) |
| Single permanent QR per restaurant | Token is immutable — menu updates at same URL forever |
| Next.js for Customer Website | SSR for fast initial load, SEO-friendly, mobile-first |
| Cloudinary for images | Upload, compression (≤200KB), CDN delivery, format conversion |
| Property-based testing | Formal correctness guarantees across 20 properties |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the ISC License.

---

## 👨‍💻 Author

Built with ❤️ for restaurant owners who want a simple, permanent digital menu.
