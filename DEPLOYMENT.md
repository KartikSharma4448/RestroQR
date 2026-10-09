# Deployment

Deploy backend and customer site together when public API contracts change.
A Git push may trigger an existing hosting integration; this guide does not certify
that any such deployment completed.

## Before Deploying

- Review [verification limits](docs/VERIFICATION.md) and [release checks](TESTING-AND-DEPLOYMENT-GUIDE.md).
- Back up PostgreSQL and confirm a restore procedure.
- Run local builds/tests and scan dependencies.
- Configure hosting secrets outside Git; never publish a service-account JSON or signing key.
- Use separate staging and production databases.
- Keep customer and API URLs consistent across QR generation and all clients.

## Backend on Render

Create or use a Node web service with root directory `backend`.

| Setting | Value |
| --- | --- |
| Runtime | Node.js 24 LTS |
| Build command | npm ci --include=dev && npm run build |
| Start command | npm start |
| Health path | /health |
| Environment | NODE_ENV=production |

Set `DATABASE_URL`, `JWT_SECRET`, `TABLE_TOKEN_SECRET`, `CUSTOMER_BASE_URL`
and `CORS_ORIGINS`. Configure `CLOUDINARY_URL` for uploads and Firebase application
credentials for notifications. Render supplies `PORT`.

The build uses TypeScript and its declaration packages from `devDependencies`.
`--include=dev` keeps those available during the build even when `NODE_ENV=production`.

Generate independent random secrets. JWT requires at least 32 characters;
table encryption supports a random 32-byte hexadecimal key.
Keep the table-token key stable or existing printed table QR codes will stop working.
Rotating the JWT secret invalidates sessions.

The health endpoint indicates a running API process, not database connectivity.
Verify a scoped menu/order workflow after deployment.
The start command applies SQL migrations; review them and take a backup first.

## Customer Site on Vercel

| Setting | Value |
| --- | --- |
| Root directory | customer-website |
| Framework | Next.js |
| Install | npm ci |
| Build | npm run build |
| Environment | NEXT_PUBLIC_API_URL=https://your-api-host |

The API value must not end in `/api`. Redeploy after changing it: public environment
values are bundled at build time. Add the exact website origin to backend CORS and
set `CUSTOMER_BASE_URL` to the customer site's public origin.
Verify menu, table ordering, board updates and privacy page.
The public customer website is `https://restroqr.thekartiksharma.in`.
Availability and deployed release version must be checked independently.

### Customer Custom Domain Checklist

1. Add `restroqr.thekartiksharma.in` to the customer site's Vercel domain settings.
2. Configure the DNS record requested by Vercel and verify domain ownership and HTTPS.
3. Set backend `CUSTOMER_BASE_URL=https://restroqr.thekartiksharma.in` so newly
   generated restaurant/table QR URLs use the custom domain. The backend still has
   a legacy Vercel hostname fallback, so configure this value explicitly.
4. Add `https://restroqr.thekartiksharma.in` to `CORS_ORIGINS`, preserving any
   intended admin origins. Use comma-separated exact origins, not a wildcard.
5. Restart/redeploy the backend after environment changes. If the API origin changed,
   update customer `NEXT_PUBLIC_API_URL` and rebuild/redeploy the customer site too.
6. Verify browser API requests, restaurant menus, table ordering and order-board updates
   on the custom domain. `/health` alone does not verify this flow or database access.

Existing printed QR codes keep their original hostname. Preserve access through the
old hostname or verify a redirect that retains the complete path and query string.
Test representative existing restaurant and table QR URLs before retiring that hostname.
Do not rotate `TABLE_TOKEN_SECRET` as part of this domain change.

## Admin Dashboard

Build `admin-panel` with `VITE_API_URL=https://your-api-host/api`.
Deploy `dist/` to a static host with SPA fallback to `index.html`.
Allow the admin origin in backend CORS. The included Nginx configuration has an API
origin in CSP: update it when changing API hosts.
Never place administrator credentials in public build variables.

## Android Release

1. Configure Firebase client files privately for the intended Android package.
2. Supply `owner-app-flutter/android/key.properties` and your signing keystore locally.
3. Run:
   ```powershell
   flutter build appbundle --release --dart-define=API_BASE_URL=https://your-api-host/api
   ```
4. Verify signature, installation, notification permission, authentication and QR saving.
5. Publish only a reviewed signed release.

The APK currently under `customer-website/public/download/` is a pre-existing artifact;
it has not been replaced by the local debug build during this refresh.
A successful debug build is not Play Store release verification.

## Docker

The backend Dockerfile uses Node.js 24 and a non-root runtime user.
The Compose configuration is a development starting point, not a production security
baseline. Its database password and encryption secret must be supplied through environment
variables. Use a hexadecimal password in this example, or URL-encode special characters
before placing the password in DATABASE_URL. Database credentials must match on both sides.
PostgreSQL is not exposed to the host by default.
Its backend consumes a private `backend/.env.docker` file.
Copy `backend/.env.docker.example` to that file and replace the JWT placeholder.
Set POSTGRES_PASSWORD and TABLE_TOKEN_SECRET in the shell before running Compose.

```powershell
docker compose config --quiet
docker compose up --build
```

Do not share rendered Compose configuration containing secrets.
Docker daemon/container builds were not validated in the current refresh.
Use private networks, managed secrets and a backed-up persistent volume for deployment.
Never use `docker compose down -v` against a database you need to retain.

## Database Operations

Verify the provider, TLS mode, firewall/network restrictions, least-privilege role,
backups and actual migration state on the intended deployment.
Do not disable certificate validation or clear a live database as part of an upgrade.
No database deletion was performed in this refresh.

## Post-Deployment and Rollback

- Verify login and cross-owner authorization using designated staging accounts.
- Check scan -> menu -> order -> owner transition -> customer status update.
- Test Cloudinary upload and real-device notifications.
- Confirm customer headers, API rate limits and no public phone/full-name exposure.
- Review application errors and database readiness.
- Retain the previous release; roll back application code only after checking schema
  backward compatibility. Restore data from a verified backup if a migration is destructive.


## Environment Configuration Notes

In hosting dashboards, enter each  environment variable name and value in separate
fields; do not paste `NAME=value` into the value field. Replace `your-api-host`
with the actual HTTPS API hostname before building the clients.

Client API URLs are public configuration, not a place for secrets. Keep
`DATABASE_URL`, `JWT_SECRET`, `TABLE_TOKEN_SECRET` and service-account credentials
on the backend only; never copy them into client environment variables.
