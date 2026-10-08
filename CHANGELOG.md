# Changelog

## Unreleased

### Added

- Restaurant-wide public order board with order reference, table label, masked
  customer initials and automatic refresh.
- Responsive customer/menu experience and refreshed Android owner screens.
- Native Android QR gallery saving and older-platform document-picker fallback.
- Public order validation, privacy and concurrent status-update regression tests.
- Setup, API, security, contribution, deployment and verification documentation.

### Changed

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
