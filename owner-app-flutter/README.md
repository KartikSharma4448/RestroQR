# RestroQR Owner App

Flutter Android client for restaurant owners: menu editing, tables, QR codes, incoming
orders, earnings and history.

## Development

Requires Flutter compatible with Dart 3.11.1 and an Android SDK.

```powershell
flutter pub get
adb reverse tcp:3000 tcp:3000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3000/api
```

The device loopback address uses adb port forwarding; see
[setup](../docs/SETUP.md) for loopback binding and networking.
Production builds should target an HTTPS API and include `/api`.

## Checks

```powershell
flutter analyze
flutter test
flutter build apk --debug
```

Firebase configuration, release signing, legacy Android QR saving and real-device
notifications require separate validation.
Never commit `key.properties`, a signing keystore or private service credentials.

[Architecture](../TECHNICAL.md) | [Deployment](../DEPLOYMENT.md) |
[Verification](../docs/VERIFICATION.md)
