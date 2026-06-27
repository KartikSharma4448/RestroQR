# RestroQR Deployment Guide

This guide covers deploying all components of the RestroQR platform:

- **Backend API** — Node.js/Express + PostgreSQL
- **Admin Panel** — React SPA (static build)
- **Customer Website** — Next.js (SSR)
- **Owner App** — Android (Kotlin)

---

## Table of Contents

1. [Local Development with Docker Compose](#local-development-with-docker-compose)
2. [Backend Deployment](#backend-deployment)
3. [Admin Panel Deployment](#admin-panel-deployment)
4. [Customer Website Deployment](#customer-website-deployment)
5. [Owner App Deployment](#owner-app-deployment)
6. [HTTPS Configuration](#https-configuration)
7. [Environment Variables Reference](#environment-variables-reference)
8. [Secrets Management](#secrets-management)

---

## Local Development with Docker Compose

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Git

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd RestroQr

# Copy environment file and configure
cp backend/.env.example backend/.env.docker
# Edit backend/.env.docker with your Cloudinary and JWT settings

# Start all services
docker compose up --build

# Run database migrations
docker compose exec backend node -e "require('child_process').execSync('npx node-pg-migrate up --migrations-dir migrations --migration-file-language js', {stdio: 'inherit'})"

# Seed admin account
docker compose exec backend node dist/seeds/admin.seed.js
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Backend API | http://localhost:3000 | REST API |
| Admin Panel | http://localhost:8080 | Admin dashboard |
| PostgreSQL | localhost:5432 | Database |

### Useful Commands

```bash
# Start services in background
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f postgres

# Stop all services
docker compose down

# Stop and remove volumes (deletes database data)
docker compose down -v

# Rebuild after code changes
docker compose up --build backend
```

---

## Backend Deployment

### Option A: Docker (Recommended)

Build and run the backend Docker image independently:

```bash
cd backend

# Build the image
docker build -t restroqr-backend .

# Run the container
docker run -d \
  --name restroqr-backend \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/restroqr" \
  -e JWT_SECRET="your-secure-secret" \
  -e CLOUDINARY_URL="cloudinary://key:secret@cloud" \
  -e NODE_ENV="production" \
  restroqr-backend
```

### Option B: Railway

1. Connect your GitHub repository to [Railway](https://railway.app).
2. Create a new project and add a **PostgreSQL** plugin.
3. Add a **service** pointing to the `backend/` directory.
4. Set the root directory to `backend`.
5. Configure environment variables in the Railway dashboard:
   - `DATABASE_URL` — auto-populated by the PostgreSQL plugin
   - `JWT_SECRET` — generate a secure random string
   - `CLOUDINARY_URL` — your Cloudinary credentials
   - `PORT` — Railway sets this automatically
   - `NODE_ENV` — `production`
6. Set build command: `npm ci && npm run build`
7. Set start command: `npm run migrate:up && node dist/index.js`
8. Deploy. Railway will provide a public URL with HTTPS.

### Option C: Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your repository, set root directory to `backend`.
3. Set build command: `npm ci && npm run build`
4. Set start command: `npm run migrate:up && node dist/index.js`
5. Add a **PostgreSQL** database from the Render dashboard.
6. Configure environment variables:
   - `DATABASE_URL` — from Render PostgreSQL (Internal URL for same-region)
   - `JWT_SECRET`, `CLOUDINARY_URL`, `NODE_ENV=production`
7. Deploy. Render provides HTTPS by default.

### Database Migrations

Always run migrations before or during deployment:

```bash
# Run pending migrations
npm run migrate:up

# Rollback last migration (if needed)
npm run migrate:down
```

---

## Admin Panel Deployment

The admin panel is a React SPA that builds to static files.

### Option A: Netlify

1. Connect your repository to [Netlify](https://netlify.com).
2. Set base directory: `admin-panel`
3. Set build command: `npm ci && npm run build`
4. Set publish directory: `admin-panel/dist`
5. Add environment variable:
   - `VITE_API_URL` — your backend API URL (e.g., `https://api.restroqr.com`)
6. Deploy. Netlify provides HTTPS and a CDN automatically.

### Option B: Vercel

1. Import your repository on [Vercel](https://vercel.com).
2. Set root directory: `admin-panel`
3. Framework preset: Vite
4. Add environment variable:
   - `VITE_API_URL` — backend API URL
5. Deploy.

### Option C: Docker (Nginx)

```bash
cd admin-panel
docker build -t restroqr-admin .
docker run -d --name restroqr-admin -p 8080:80 restroqr-admin
```

---

## Customer Website Deployment

The customer website is a Next.js app with SSR for fast, SEO-friendly menu rendering.

### Vercel (Recommended for Next.js)

1. Import your repository on [Vercel](https://vercel.com).
2. Set root directory: `customer-website`
3. Framework preset: Next.js (auto-detected)
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL` — backend API URL (e.g., `https://api.restroqr.com`)
   - `API_URL` — server-side API URL (can be internal if same network)
5. Deploy. Vercel handles SSR, edge caching, and HTTPS.

### Custom Domain Setup

1. Add your domain (e.g., `restroqr.com`) in Vercel's domain settings.
2. Configure DNS:
   - A record: `76.76.21.21`
   - Or CNAME: `cname.vercel-dns.com`
3. Vercel auto-provisions SSL certificates.

---

## Owner App Deployment

### Google Play Store

#### Prerequisites

- Google Play Developer Account ($25 one-time fee)
- Android Studio for building release APK/AAB
- App signing key (keystore file)

#### Build Release

```bash
cd owner-app

# Generate a signing key (one-time)
keytool -genkey -v -keystore restroqr-release.keystore \
  -alias restroqr -keyalg RSA -keysize 2048 -validity 10000

# Build release AAB (Android App Bundle)
./gradlew bundleRelease
```

#### Configure Signing

In `app/build.gradle.kts`:

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("../restroqr-release.keystore")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = "restroqr"
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
```

#### Play Store Submission

1. Go to [Google Play Console](https://play.google.com/console).
2. Create a new application.
3. Fill in store listing:
   - App name: RestroQR Owner
   - Short description, full description
   - Screenshots (phone, tablet)
   - Feature graphic (1024x500)
   - App icon (512x512)
4. Upload the release AAB from `app/build/outputs/bundle/release/`.
5. Set content rating (complete the questionnaire).
6. Set pricing and distribution (free).
7. Configure app signing (let Google manage signing key is recommended).
8. Submit for review.

#### Updating the App

1. Increment `versionCode` and `versionName` in `app/build.gradle.kts`.
2. Build new AAB.
3. Create a new release in Play Console → Production track.
4. Upload the new AAB, add release notes.
5. Submit for review.

---

## HTTPS Configuration

All production traffic MUST use HTTPS. Here's how it's enforced:

### Backend API

The Express backend enforces HTTPS via Helmet and a redirect middleware:

```typescript
// In production, trust proxy and redirect HTTP → HTTPS
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

### Platform-Level HTTPS

| Platform | HTTPS Handling |
|----------|---------------|
| Railway | Auto-provisioned SSL on all custom domains |
| Render | Free TLS for all services |
| Vercel | Automatic SSL for all deployments |
| Netlify | Free SSL with Let's Encrypt |
| Docker (self-hosted) | Use a reverse proxy (Nginx/Caddy/Traefik) with Let's Encrypt |

### Self-Hosted HTTPS with Caddy

If deploying on a VPS, use Caddy as a reverse proxy (automatic HTTPS):

```Caddyfile
api.restroqr.com {
    reverse_proxy backend:3000
}

admin.restroqr.com {
    reverse_proxy admin-panel:80
}

restroqr.com {
    reverse_proxy customer-website:3000
}
```

### Security Headers

The backend uses Helmet to set security headers:

- `Strict-Transport-Security` (HSTS) — enforces HTTPS for future requests
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`

---

## Environment Variables Reference

### Backend API

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/restroqr` |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens | Random 64+ char string |
| `CLOUDINARY_URL` | Yes | Cloudinary credentials URL | `cloudinary://key:secret@cloud_name` |
| `PORT` | No | Server port (default: 3000) | `3000` |
| `NODE_ENV` | No | Environment mode | `production` |

### Admin Panel

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | Backend API base URL | `https://api.restroqr.com` |

### Customer Website

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (client-side) | `https://api.restroqr.com` |
| `API_URL` | No | Backend API URL (server-side, internal) | `http://backend:3000` |

### Owner App

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `API_BASE_URL` | Yes | Backend API URL (build-time) | `https://api.restroqr.com` |

---

## Secrets Management

### Best Practices

1. **Never commit secrets to Git.** All `.env` files are in `.gitignore`.
2. **Use platform-provided secret managers:**
   - Railway: Environment variables in dashboard (encrypted at rest)
   - Render: Environment groups
   - Vercel: Environment variables with production/preview/dev scopes
   - Netlify: Environment variables in site settings
3. **Rotate secrets regularly:**
   - `JWT_SECRET` — rotate every 90 days; existing tokens will expire naturally
   - `CLOUDINARY_URL` — rotate API keys via Cloudinary dashboard
   - Database passwords — rotate with zero-downtime by updating connection strings
4. **Use strong secrets:**
   ```bash
   # Generate a secure random JWT secret
   openssl rand -base64 64
   ```
5. **Scope access narrowly:**
   - Production secrets should only be accessible to production deployments
   - Use separate Cloudinary API keys for dev vs production
   - Use separate database instances for dev, staging, and production
6. **Audit access:**
   - Review who has access to production environment variables
   - Use platform audit logs to track changes to secrets
7. **Keystore security (Android):**
   - Never commit the `.keystore` file to Git
   - Store keystore passwords in CI/CD secrets (e.g., GitHub Actions secrets)
   - Keep a secure backup of the keystore — losing it means you cannot update the app

### CI/CD Integration

For GitHub Actions, store secrets in repository or organization settings:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  CLOUDINARY_URL: ${{ secrets.CLOUDINARY_URL }}
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  restroqr.com (Vercel)    admin.restroqr.com (Netlify) │
│  ┌───────────────┐        ┌───────────────┐            │
│  │ Customer Site │        │  Admin Panel  │            │
│  │  (Next.js)    │        │  (React SPA)  │            │
│  └───────┬───────┘        └───────┬───────┘            │
│          │                        │                     │
│          └────────┬───────────────┘                     │
│                   │ HTTPS                               │
│          ┌────────▼────────┐                            │
│          │  Backend API    │  api.restroqr.com          │
│          │  (Railway/Render)│                           │
│          └────────┬────────┘                            │
│                   │                                     │
│          ┌────────▼────────┐     ┌──────────────┐      │
│          │   PostgreSQL    │     │  Cloudinary  │      │
│          │   (Managed)     │     │  (Image CDN) │      │
│          └─────────────────┘     └──────────────┘      │
│                                                         │
│  Owner App (Google Play Store)                          │
│  ┌───────────────┐                                      │
│  │ Android/Kotlin│ ──── HTTPS ──── Backend API          │
│  └───────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```
