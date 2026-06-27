# RestroQR — Testing, Free Deployment & Play Store Guide

Yeh complete step-by-step guide hai — local testing se lekar free cloud deployment aur Google Play Store tak.

---

## 📋 Table of Contents

1. [Local Testing (Apne Computer pe)](#1-local-testing-apne-computer-pe)
2. [Free Backend Deployment (Render.com)](#2-free-backend-deployment-rendercom)
3. [Free Database (Neon PostgreSQL)](#3-free-database-neon-postgresql)
4. [Free Customer Website Deployment (Vercel)](#4-free-customer-website-deployment-vercel)
5. [Free Admin Panel Deployment (Netlify)](#5-free-admin-panel-deployment-netlify)
6. [Free Image Storage (Cloudinary)](#6-free-image-storage-cloudinary)
7. [Owner App — Play Store Submission](#7-owner-app--play-store-submission)
8. [Final Checklist](#8-final-checklist)

---

## 1. Local Testing (Apne Computer pe)

### Prerequisites Install karo

```bash
# Node.js 20+ install karo (https://nodejs.org)
node --version   # v20+ hona chahiye

# Docker install karo (https://docker.com/products/docker-desktop)
docker --version

# Android Studio install karo (owner app ke liye)
# https://developer.android.com/studio
```

### Step 1: Backend Test karo

```bash
cd d:\RestroQr\backend
npm install

# Tests run karo (database nahi chahiye, mocked hai)
npm test
```

Expected output: **150+ tests passing** ✅

### Step 2: Docker se full stack run karo

```bash
cd d:\RestroQr

# Sab kuch start karo (Postgres + Backend + Admin Panel)
docker compose up --build

# Naya terminal kholo — database migrations run karo
docker compose exec backend npx node-pg-migrate up --migrations-dir migrations --migration-file-language js

# Admin account create karo
docker compose exec backend node dist/seeds/admin.seed.js
```

### Step 3: Test karo browser me

| Service | URL | Login |
|---------|-----|-------|
| Backend API | http://localhost:3000/health | - |
| Admin Panel | http://localhost:8080 | admin@restroqr.com / Admin@123 |

### Step 4: Customer Website test karo

```bash
# Naya terminal
cd d:\RestroQr\customer-website
npm install
npm run dev
```

Browser me kholo: `http://localhost:3001`

### Step 5: Owner App test karo

1. Android Studio me `owner-app/` folder open karo
2. Gradle sync hone do
3. Emulator select karo (Pixel 6, API 34)
4. ▶️ Run button press karo
5. App emulator me open hoga → Register → Profile Setup → Menu banao → QR dekho

### Step 6: E2E tests run karo

```bash
cd d:\RestroQr\customer-website
npx playwright install chromium
npm run test:e2e
```

---

## 2. Free Backend Deployment (Render.com)

**Render.com** free tier pe Node.js apps host kar sakte ho.

### Step 1: GitHub pe push karo

```bash
cd d:\RestroQr
git init
git add .
git commit -m "RestroQR V1 - Complete platform"
git remote add origin https://github.com/YOUR_USERNAME/RestroQr.git
git push -u origin main
```

### Step 2: Render account banao

1. Jao: https://render.com
2. **Sign up with GitHub** karo
3. Free account select karo

### Step 3: Web Service create karo

1. Dashboard → **New** → **Web Service**
2. GitHub repo connect karo: `RestroQr`
3. Settings:

| Setting | Value |
|---------|-------|
| Name | `restroqr-api` |
| Region | Singapore (ya nearest) |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run migrate:up && node dist/index.js` |
| Instance Type | **Free** |

4. Environment Variables add karo (Step 3 ke baad):

```
NODE_ENV=production
JWT_SECRET=<generate: openssl rand -base64 64>
PORT=3000
DATABASE_URL=<Neon se milega — next step>
CLOUDINARY_URL=<Cloudinary se milega — step 6>
```

5. **Create Web Service** click karo

> ⚠️ Free tier pe server 15 min inactivity ke baad sleep hota hai. Pehli request me 30-50 sec lagega.

---

## 3. Free Database (Neon PostgreSQL)

**Neon** free tier pe PostgreSQL milta hai (0.5 GB storage, unlimited).

### Step 1: Account banao

1. Jao: https://neon.tech
2. **Sign up with GitHub**
3. Free plan select karo

### Step 2: Database create karo

1. **Create Project** click karo
2. Project name: `restroqr`
3. Database name: `restroqr`
4. Region: **Asia (Singapore)** ya nearest

### Step 3: Connection string copy karo

Dashboard pe Connection Details section me milega:

```
postgresql://username:password@ep-xxxx.ap-southeast-1.aws.neon.tech/restroqr?sslmode=require
```

### Step 4: Render me add karo

Render Dashboard → `restroqr-api` → Environment → `DATABASE_URL` me yeh paste karo.

### Step 5: Migrations run karo

Render deploy hone ke baad automatic chalegi (start command me hai). Ya manually:

1. Render Dashboard → `restroqr-api` → **Shell** tab
2. Run:
```bash
npx node-pg-migrate up --migrations-dir migrations --migration-file-language js
node dist/seeds/admin.seed.js
```

---

## 4. Free Customer Website Deployment (Vercel)

**Vercel** Next.js ke liye best hai — free tier pe unlimited deploys.

### Step 1: Vercel account banao

1. Jao: https://vercel.com
2. **Sign up with GitHub**

### Step 2: Import project

1. Dashboard → **Add New** → **Project**
2. GitHub repo select karo: `RestroQr`
3. Settings:

| Setting | Value |
|---------|-------|
| Root Directory | `customer-website` |
| Framework | Next.js (auto-detect) |
| Build Command | `npm run build` |
| Output Directory | `.next` |

4. Environment Variables:

```
NEXT_PUBLIC_API_URL=https://restroqr-api.onrender.com
```

5. **Deploy** click karo

### Step 3: Custom domain (optional)

1. Settings → Domains
2. Add: `restroqr.com` (ya koi bhi domain)
3. DNS update karo apne domain provider me

**Free URL milega:** `https://restroqr-customer.vercel.app`

QR code URL format: `https://restroqr-customer.vercel.app/r/{restaurant_token}`

---

## 5. Free Admin Panel Deployment (Netlify)

**Netlify** static sites ke liye free hai.

### Step 1: Netlify account banao

1. Jao: https://netlify.com
2. **Sign up with GitHub**

### Step 2: Site create karo

1. Dashboard → **Add new site** → **Import an existing project**
2. GitHub connect karo → `RestroQr` repo select karo
3. Settings:

| Setting | Value |
|---------|-------|
| Base directory | `admin-panel` |
| Build command | `npm ci && npm run build` |
| Publish directory | `admin-panel/dist` |

4. Environment Variables → **Add variable**:

```
VITE_API_URL=https://restroqr-api.onrender.com/api
```

5. **Deploy site** click karo

**Free URL milega:** `https://restroqr-admin.netlify.app`

**Login:** admin@restroqr.com / Admin@123

---

## 6. Free Image Storage (Cloudinary)

**Cloudinary** free tier: 25 GB storage, 25 GB bandwidth/month.

### Step 1: Account banao

1. Jao: https://cloudinary.com
2. **Sign up for free**

### Step 2: Credentials lo

Dashboard pe milega:
- Cloud Name: `your_cloud_name`
- API Key: `123456789`
- API Secret: `abc-xyz-secret`

### Step 3: CLOUDINARY_URL banao

Format:
```
cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Example:
```
cloudinary://123456789:abc-xyz-secret@your_cloud_name
```

### Step 4: Render me add karo

Render Dashboard → `restroqr-api` → Environment → `CLOUDINARY_URL` me paste karo.

Redeploy karo.

---

## 7. Owner App — Play Store Submission

### Step 1: Google Play Developer Account

1. Jao: https://play.google.com/console
2. **Create account** ($25 one-time fee — credit/debit card chahiye)
3. Identity verification complete karo (2-3 din lagta hai)

### Step 2: App me production URL set karo

`owner-app/app/build.gradle.kts` me:

```kotlin
buildTypes {
    release {
        buildConfigField("String", "BASE_URL", "\"https://restroqr-api.onrender.com/api/\"")
    }
}
```

### Step 3: Signing Key generate karo

Android Studio me Terminal kholo:

```bash
keytool -genkey -v -keystore restroqr-release.keystore -alias restroqr -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ **Keystore file aur password safely save karo. Kho gaya toh app update nahi kar paoge!**

### Step 4: app/build.gradle.kts me signing add karo

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("../restroqr-release.keystore")
            storePassword = "YOUR_STORE_PASSWORD"
            keyAlias = "restroqr"
            keyPassword = "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}
```

### Step 5: Release AAB build karo

Android Studio me:
1. **Build** → **Generate Signed Bundle / APK**
2. **Android App Bundle** select karo
3. Keystore path, passwords daalo
4. **Release** build variant select karo
5. **Create** karo

Output: `app/build/outputs/bundle/release/app-release.aab`

### Step 6: Play Console me App create karo

1. Play Console → **Create app**
2. Fill karo:

| Field | Value |
|-------|-------|
| App name | RestroQR Owner |
| Default language | English (India) |
| App type | App |
| Free or Paid | Free |

3. **Create** karo

### Step 7: Store Listing complete karo

**Main Store Listing:**
- Short description (80 chars): "Create your restaurant's digital QR menu in minutes"
- Full description (4000 chars): App ke features describe karo
- App icon: 512x512 PNG
- Feature graphic: 1024x500 PNG
- Screenshots: Minimum 2 phone screenshots (1080x1920 recommended)

**Kaise banaye screenshots:**
1. Android Studio emulator me app run karo
2. Important screens pe screenshot lo (Ctrl+S emulator me)
3. Login, Dashboard, Menu, QR Code — 4-5 screenshots

### Step 8: Content Rating complete karo

1. Dashboard → **Policy** → **App content** → **Content rating**
2. Questionnaire fill karo (sab "No" hoga — no violence, no gambling, etc.)
3. Rating milega: **Everyone**

### Step 9: App Release upload karo

1. **Release** → **Production** → **Create new release**
2. **Upload** → `app-release.aab` file select karo
3. Release name: `1.0.0`
4. Release notes: "Initial release - Digital QR menu for restaurant owners"
5. **Review release** → **Start rollout to Production**

### Step 10: Review wait karo

- Google review me **3-7 din** lagta hai
- Email aayega jab approve ho jayega
- Reject hone pe reason batayega — fix karo aur resubmit

---

## 8. Final Checklist

### ✅ Before Going Live

- [ ] Backend deployed on Render ✅
- [ ] Database on Neon PostgreSQL ✅
- [ ] Admin seed run ho gaya (admin@restroqr.com account exists)
- [ ] Customer website on Vercel ✅
- [ ] Admin panel on Netlify ✅
- [ ] Cloudinary configured ✅
- [ ] HTTPS working on all URLs ✅
- [ ] Admin login working on deployed admin panel
- [ ] Owner registration working via API
- [ ] QR code generates correct URL (Vercel URL + /r/token)
- [ ] Customer menu page loads via QR URL
- [ ] Images upload and display correctly
- [ ] Owner app connects to production backend
- [ ] App signed and uploaded to Play Console
- [ ] Play Store listing complete (screenshots, description, icon)

### 💰 Total Cost

| Item | Cost |
|------|------|
| Render (Backend) | **FREE** (750 hrs/month) |
| Neon (PostgreSQL) | **FREE** (0.5 GB) |
| Vercel (Customer Website) | **FREE** (100 GB bandwidth) |
| Netlify (Admin Panel) | **FREE** (100 GB bandwidth) |
| Cloudinary (Images) | **FREE** (25 GB) |
| Google Play Console | **₹2,100** (one-time, $25) |
| **Total** | **₹2,100 one-time** |

### 🔗 Final URLs (Example)

| Component | URL |
|-----------|-----|
| Backend API | https://restroqr-api.onrender.com |
| Customer Website | https://restroqr.vercel.app |
| Admin Panel | https://restroqr-admin.netlify.app |
| QR Menu | https://restroqr.vercel.app/r/{token} |
| Play Store | https://play.google.com/store/apps/details?id=com.restroqr.owner |

---

## 🔧 Troubleshooting

### Backend deploy fail ho raha hai
- Check: `DATABASE_URL` sahi hai?
- Check: `JWT_SECRET` set hai?
- Render logs dekho: Dashboard → Logs

### Database connect nahi ho raha
- Neon me check karo: IP allow list me `0.0.0.0/0` add karo (ya Render ka IP)
- `?sslmode=require` URL me hona chahiye

### Admin panel login fail
- Seed script run hua? `node dist/seeds/admin.seed.js`
- VITE_API_URL sahi set hai? (with `/api` at end)
- CORS issue? Backend me Render URL allow karo

### Customer website "Menu not found" dikha raha
- Backend running hai?
- NEXT_PUBLIC_API_URL sahi hai?
- Restaurant active hai? (admin se check karo)

### Owner App "Network Error"
- Emulator me `10.0.2.2:3000` use ho raha hai (debug)
- Release build me production URL set hai?
- Internet permission AndroidManifest me hai? ✅ (already added)

### Play Store reject ho gaya
- Privacy Policy missing? (ek simple privacy policy page banao)
- Screenshots missing/wrong size?
- Data Safety form incomplete?

---

## 📝 Quick Reference Commands

```bash
# Backend tests
cd backend && npm test

# Backend start (local)
cd backend && npm run dev

# Customer website (local)
cd customer-website && npm run dev

# Admin panel (local)
cd admin-panel && npm run dev

# Docker full stack
docker compose up --build

# Docker stop
docker compose down

# Database migrations
cd backend && npm run migrate:up

# Seed admin
cd backend && npm run seed

# Build admin panel for deploy
cd admin-panel && npm run build

# Build customer website for deploy
cd customer-website && npm run build

# E2E tests
cd customer-website && npm run test:e2e

# Generate signed APK
# Android Studio → Build → Generate Signed Bundle/APK
```

---

**Done! 🎉 Ab tumhara RestroQR platform live hai — free me hosted, tested, aur Play Store pe!**
