# Requirements Document — RestroQR V2 (Premium Subscription Features)

## Note

These requirements were originally drafted for V1 but have been moved to V2 as premium subscription features. They will be added on top of V1 in a future release.

## Features for V2 Premium

### Table Management (Per-Table QR)
- Multiple tables per restaurant with individual QR codes
- Table enable/disable/delete with QR invalidation
- Table renaming while preserving QR
- QR regeneration per table

### QR Code Advanced Security
- Cryptographically random QR_Token (128-bit minimum)
- Server-side QR_Token verification
- Disabled table detection
- Rate limiting (20 req/min per IP)
- HTTPS enforcement with HTTP redirect

### QR Code Bulk Export
- Single QR download in PNG (300 DPI), SVG, PDF
- Bulk export ZIP with all formats
- Admin Panel bulk export within 30 seconds for 100 tables
- File naming by table name

### Owner Dashboard and Analytics
- Total QR scans, scans per table, scans per day
- Date range filtering (up to 90 days)
- CSV export from Admin Panel
- 15-minute refresh interval
- Empty state messaging

### Multi-language Support
- Owner-configurable display language
- System UI translation (English + Hindi minimum)
- Menu content displayed as-entered (no auto-translation)

### Admin Web Panel Advanced Features
- Bulk Food_Item upload (CSV/Excel, up to 500 items per file)
- Validation summary for failed rows
- User Management (up to 10 staff accounts)
- Staff permission restrictions
- Account revocation with session termination

### Online Ordering Toggle
- Dashboard toggle (OFF by default)
- View-only mode enforcement when OFF
- API-level enforcement preventing ON state in V1
- Future: Cart/Checkout/Place Order when ON

### Advanced Menu Publishing
- Publish failure error handling
- Customer_Website fetch failure graceful degradation
- Last-known-good menu fallback
