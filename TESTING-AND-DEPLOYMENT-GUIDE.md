# Testing and Release Checklist

## Automated Checks

Run commands inside the specified directory:

| Directory | Commands |
| --- | --- |
| backend | npm ci; npm test -- --runInBand; npm run build |
| customer-website | npm ci; npm run build |
| admin-panel | npm ci; npm run build |
| owner-app-flutter | flutter pub get; flutter analyze; flutter test |

Shell commands in the table are separate steps. See [setup](docs/SETUP.md) for initial configuration.

Backend tests include route, service, validation, authentication and property-based suites.
The repository also contains legacy test-database helpers.
Use only a disposable database explicitly named with a `test` component if adding/running
database-backed tests. Helpers can clear records; never supply production credentials.
Many current suites mock database operations, so their names do not imply real database testing.

The customer `e2e/` directory contains Playwright suites. They require configured data
and a browser installation. They were not certified as a full deployment regression
suite during this refresh. Local UI checks used sample menus and browser inspection.

## Owner Checks

```powershell
flutter analyze
flutter test
flutter build apk --debug
```

QR gallery integration:
```powershell
flutter test integration_test/qr_gallery_test.dart -d YOUR_DEVICE_ID
```

Use a disposable emulator/device. Verify the actual test filename in
`integration_test/` before running. Android 10+ MediaStore saving was previously checked
on an API 36.1 emulator; the older Android document-picker path remains unverified.
Release signing and physical-device notification delivery are separate checks.

## Manual Staging Workflow

- Create two designated owners/restaurants to test isolation.
- Create categories, available/unavailable dishes and tables.
- Save a restaurant/table QR and scan it on a second device.
- Verify menu-only and table-ordering modes.
- Check cart quantities, final server prices and confirmation reference.
- Reject tampered table tokens, invalid quantities and cross-restaurant item IDs.
- Disable the restaurant/owner and confirm orders are blocked.
- Advance pending -> accepted -> completed -> payment_received.
- Check customer board labels Pending -> Preparing -> Ready -> Paid.
- Verify other restaurants' orders, private phone numbers and full names do not appear.
- Test cancellation/state conflicts with a real PostgreSQL instance.
- Verify cancelled/paid board rows expire after the configured window.
- Test empty board, API outage/retry and mobile layout.
- Check login, uploads, earnings, history and notifications independently.

## Dependency Audit

Run `npm audit --omit=dev` in each JavaScript application.
Also inspect the full audit for build/test dependencies.
An advisory count is not proof of a demonstrated exploit, and an empty audit is not
a complete security certification. Do not force breaking dependency upgrades without testing.

## Release Gate

- [ ] All builds and automated checks pass.
- [ ] Real PostgreSQL workflow and ownership boundaries verified.
- [ ] TLS, private access, backups and migration plan reviewed.
- [ ] Production origins and client API variables match.
- [ ] Signed Android release verified on a physical device.
- [ ] Current APK download matches the reviewed release.
- [ ] Privacy notice reflects current data handling.
- [ ] Remaining dependency/security warnings reviewed.
- [ ] Hosting deployment logs and live behavior checked after push.
- [ ] Rollback procedure and previous release retained.

See [verification](docs/VERIFICATION.md) for completed versus outstanding checks.
