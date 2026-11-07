# Changelog

## Unreleased

### Added

- Restaurant-wide public order board with order reference, table label, masked
  customer initials and automatic refresh.
- Responsive customer/menu experience and refreshed Android owner screens.
- Native Android QR gallery saving and older-platform document-picker fallback.
- Public order validation, privacy and concurrent status-update regression tests.
- Setup, API, security, contribution, deployment and verification documentation.
- Monthly investment tracking (topic, price, date) with automatic totals and net
  profit against paid-order revenue (`/api/owner/investments`, migration 026).
- Optional Google Maps review link in the owner profile and a Review on Google
  button on the customer menu (migration 025; https Google hosts only).
- Background waiter-call alarm in the Android owner app: native foreground service
  with looping alarm tone, vibration and full-screen alert.

### Changed

- Waiter-call push is now data-only with high priority and a two-minute TTL.
  Owner app builds without the new service will not show it in the background.
- Investment and Revenue screens show plain messages instead of raw server errors.

- Customer framework upgraded to Next.js 15 / React 19.
- Backend development runner moved to tsx; Docker runtime moved to Node.js 24.
- Public order quantities, customer-field validation and server-side totals hardened.
- Status updates now reject stale concurrent transitions.
- Owner/restaurant disabled states block public ordering.
- Production dependency fixes applied where compatible.

### Security

- Public loyalty data lookup disabled pending identity verification.
- Browser security headers added; customer data omitted from public board payloads.
- Signing/private credential files excluded from source control.

### Release Notes

This entry describes source changes, not a numbered released artifact.
See the verification record for remaining production and device checks.
