<p align="center">
  <img src="customer-website/public/logo.png" alt="RestroQR Logo" width="120" />
</p>

<h1 align="center">RestroQR</h1>

<p align="center">
  <strong>Free Digital QR Menu & Table Ordering System for Restaurants</strong>
</p>

<p align="center">
  <a href="https://restro-qr-peach.vercel.app">Website</a> •
  <a href="https://restro-qr-peach.vercel.app/privacy-policy">Privacy Policy</a> •
  <a href="./TECHNICAL.md">Technical Docs</a>
</p>

---

## Overview

RestroQR is a full-stack restaurant management platform that lets owners create digital menus, generate per-table QR codes, and receive real-time orders — all for free. Customers scan a table QR code, browse the menu, and place orders directly from their phone. No app download needed for customers.

## Key Features

### For Restaurant Owners (Android App)
- 📋 **Digital Menu** — Create categories, add food items with photos, veg/non-veg badges
- 🪑 **Multi-Table QR** — Generate unique QR codes per table for ordering
- 📱 **Real-Time Orders** — Receive and manage orders with push notifications
- 📊 **Earnings Dashboard** — Monthly revenue, daily/weekly breakdowns
- 📈 **Item Analytics** — See best-selling items and revenue per item
- 🔔 **Push Notifications** — Get notified instantly when customers place orders
- ⚡ **Order Lifecycle** — Accept → Complete → Mark Paid workflow

### For Customers (Web — No App Needed)
- 📷 Scan table QR code
- 🍽️ Browse full restaurant menu
- 🛒 Add items to cart and place orders
- ✅ Get order confirmation with reference number
- 🔄 Place multiple orders from the same table

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        RestroQR                              │
├─────────────────┬──────────────────┬────────────────────────┤
│  Owner App      │  Customer Site   │  Backend API           │
│  (Flutter)      │  (Next.js 14)    │  (Node.js/Express)     │
│                 │                  │                        │
│  • Android      │  • Vercel        │  • Render              │
│  • Material 3   │  • Tailwind CSS  │  • PostgreSQL (Neon)   │
│  • Provider     │  • Server Comp.  │  • Firebase FCM        │
└─────────────────┴──────────────────┴────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- Flutter 3.11+
- PostgreSQL 14+

### Backend
```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, TABLE_TOKEN_SECRET
npm install
npx node-pg-migrate up
npm run dev
```

### Customer Website
```bash
cd customer-website
npm install
npm run dev
```

### Owner App (Flutter)
```bash
cd owner-app-flutter
flutter pub get
flutter run
```

## Project Structure

```
RestroQr/
├── backend/                 # Node.js/Express REST API
│   ├── migrations/          # PostgreSQL migrations (001-012)
│   ├── src/
│   │   ├── config/          # Database connection
│   │   ├── errors/          # Custom error classes
│   │   ├── middleware/      # Auth, rate limiting, error handler
│   │   ├── routes/          # API route handlers
│   │   │   ├── admin/       # Admin panel routes
│   │   │   ├── owner/       # Owner app routes
│   │   │   └── public/      # Customer-facing routes
│   │   ├── services/        # Business logic layer
│   │   ├── seeds/           # Database seed data
│   │   └── tests/           # Unit, integration, property tests
│   └── package.json
│
├── customer-website/        # Next.js 14 customer web app
│   ├── app/                 # App Router pages
│   │   ├── r/[token]/       # Restaurant menu page
│   │   │   └── t/[tableToken]/ # Table ordering page
│   │   ├── privacy-policy/  # Privacy policy
│   │   └── sitemap.ts       # Dynamic sitemap
│   ├── components/          # React components
│   ├── lib/                 # API client, utilities
│   └── public/              # Static assets
│
├── owner-app-flutter/       # Flutter Android owner app
│   ├── lib/
│   │   ├── models/          # Dart data models
│   │   ├── screens/         # UI screens
│   │   └── services/        # API & notification services
│   └── android/             # Android native config
│
└── admin-panel/             # React admin dashboard
    └── src/                 # Admin panel source
```

## Environment Variables

### Backend (.env)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `TABLE_TOKEN_SECRET` | AES-256 key for table token encryption |
| `CLOUDINARY_URL` | Image upload service |
| `CUSTOMER_BASE_URL` | Customer website URL (for QR codes) |
| `PORT` | Server port (default: 3000) |

### Customer Website (.env.local)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Backend API | Render | `https://restroqr-api.onrender.com` |
| Customer Website | Vercel | `https://restro-qr-peach.vercel.app` |
| Database | Neon PostgreSQL | Managed |
| Owner App | Google Play Store | Coming soon |

## Testing

```bash
cd backend
npm test                    # Run all tests
npm run test:properties     # Property-based tests (fast-check)
npm run test:integration    # Integration tests (supertest)
```

The project uses:
- **Property-Based Testing** (fast-check) — 17 correctness properties
- **Integration Testing** (supertest) — Full HTTP request/response cycles
- **Unit Testing** (Jest) — Service layer logic

## License

This project is proprietary software by [CodeUpPath](https://github.com/KartikSharma4448).

---

<p align="center">
  Built with ❤️ by <strong>Kartik Sharma</strong> at CodeUpPath
</p>
