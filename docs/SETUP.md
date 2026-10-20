# Setup and Configuration

## Requirements

Use Node.js 24 LTS, PostgreSQL 16+, npm and Git. Android work additionally requires
Flutter compatible with Dart 3.11.1, JDK 17 and the Android SDK.
Local validation used Node.js 26 / Flutter 3.41.4; container configuration targets Node.js 24.

Clone the repository and run each application's commands from its own directory.
Use `npm ci` with committed lockfiles. Do not commit local configuration.

## Backend Environment

Copy `backend/.env.example` to `backend/.env`.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Dedicated development PostgreSQL connection URI |
| TEST_DATABASE_URL | Optional disposable test database; never a production database |
| JWT_SECRET | Independent random authentication secret, at least 32 characters |
| TABLE_TOKEN_SECRET | Independent random 32-byte hex key; retain to keep printed QRs valid |
| CUSTOMER_BASE_URL | Customer website origin used to generate QR URLs |
| CORS_ORIGINS | Comma-separated exact customer/admin browser origins |
| CLOUDINARY_URL | Private Cloudinary upload credentials |
| GOOGLE_APPLICATION_CREDENTIALS | Path to private Firebase service-account JSON when using file-based application credentials |
| NODE_ENV | development locally; production on hosting |
| PORT | API port, default 3000 |
| ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD | One-time administrator seed values; not frontend variables |

Generate each secret separately:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run migrations only after confirming the connection's database name and host.
`npm run migrate:up` updates schema. `npm run seed` creates an admin using configured
seed values and requires a password of at least 12 characters.
Remove seed credentials from routine runtime configuration after provisioning.

Uploads need Cloudinary. Push delivery needs Firebase application credentials and
Android client configuration. Do not fabricate credentials to make these flows appear ready.

## Frontend Variables

Customer `NEXT_PUBLIC_API_URL=http://127.0.0.1:3000` excludes `/api`.
Admin `VITE_API_URL=http://127.0.0.1:3000/api` includes `/api`.
These variables are public build settings, never a place for passwords or keys.
Restart local servers or rebuild after changing them.

## Android Connectivity

The development API binds to host loopback. For a USB-connected device or emulator,
forward its loopback port:

```powershell
adb reverse tcp:3000 tcp:3000
cd owner-app-flutter
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3000/api
```

Alternatively the standard Android emulator exposes its host through `10.0.2.2`,
but that requires the backend to be reachable on that interface. Do not change to a
public bind or production mode just to work around local networking.
Use a staging HTTPS API for device checks that cannot use port forwarding.

## Signing

Place signing settings in `owner-app-flutter/android/key.properties` locally and
reference your private keystore. Required properties are `storeFile`, `storePassword`,
`keyAlias` and `keyPassword`. Keep them and Firebase service-account keys outside Git.
Debug builds do not require a release key; release signing must be configured and verified.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Menu unavailable | API origin, restaurant QR token, restaurant status and database reachability |
| Order rejected | Table token, restaurant/owner status, item availability and quantity limits |
| Board reconnecting | Frontend/backend version alignment, CORS and public order-board endpoint |
| Images fail to upload | Cloudinary configuration and allowed file type/size |
| No push notifications | Firebase credentials, device FCM token and Android notification permission |
| Printed QR stopped working | Changed encryption secret, deleted table or changed customer origin |
| /health succeeds but requests fail | Health checks do not probe PostgreSQL |

Local fixture servers used during UI review are not part of application deployment.
They do not persist orders. Use the real API and dedicated database for end-to-end validation.
