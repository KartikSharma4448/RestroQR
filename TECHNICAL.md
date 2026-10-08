# Architecture

RestroQR is a multi-client restaurant application. PostgreSQL is the source of truth
for owners, restaurants, menus, tables, orders and order items.

## Components

| Component | Responsibility | API configuration |
| --- | --- | --- |
| customer-website | Public menu, table cart, live order board and introductory website | NEXT_PUBLIC_API_URL: origin only |
| owner-app-flutter | Restaurant owner operations on Android | API_BASE_URL: includes /api |
| admin-panel | Administrative owner / restaurant management | VITE_API_URL: includes /api |
| backend | Authentication, ownership checks, validation, persistence and notifications | DATABASE_URL and service credentials |

The legacy `owner-app/` folder is retained; active owner development is in
`owner-app-flutter/`.

## Customer Flow

1. A restaurant QR opens `/r/[token]` for menu browsing.
2. A table QR opens `/r/[token]/t/[tableToken]` for ordering.
3. Next.js fetches the public menu from the API. Cart state is maintained in memory.
4. The customer submits item identifiers and quantities.
5. The API decrypts the table token, verifies restaurant and owner status, validates
   dish ownership/availability, and calculates prices from database records.
6. An order and its items are inserted in a transaction; the API returns a reference.
7. Firebase delivery is attempted when a configured device token exists.
8. Owners advance order status. Customers' public boards poll every 15 seconds.

Refresh loses the in-memory cart. Notification failure does not roll back an order.

## Order States

| Database value | Customer board label | Next state |
| --- | --- | --- |
| pending | Pending | accepted |
| accepted | Preparing | completed |
| completed | Ready | payment_received |
| payment_received | Paid | Final |
| cancelled | Cancelled | Final |

Status transitions use conditional SQL updates against the previous status.
A competing transition returns a conflict rather than overwriting the new state.
No separate "served" status is implemented.

## Public Order Board

`GET /api/public/order-board/:token` validates token format and resolves only an
active restaurant with an active owner. SQL is scoped to that restaurant and table
ownership. The response contains only order reference, table label, masked customer
initials and status. It excludes internal IDs, phone numbers, monetary totals and items.

The result is capped at 100 rows, limited to orders created within 24 hours.
Pending/preparing/ready orders remain in that window; paid/cancelled rows expire
30 minutes after update. Responses are not cached. The client avoids overlapping
polls, aborts on unmount, times out requests and pauses polling while hidden.
Printed QR access is shareable and is not proof of a customer's identity.

## Security Boundaries

- JWT authentication and explicit owner/admin roles protect private routes.
- Resource ownership checks are required even after authentication.
- bcrypt hashes passwords. AES-GCM authenticates encrypted table tokens.
- SQL uses parameters; public order validation bounds quantities and cart size.
- CORS allowlists browser origins but is not authentication.
- Helmet and customer-site security headers provide baseline browser protections.
- Public rewards data returns 403 until verification is implemented.
- Process-local rate limits and login locks do not coordinate across instances.
- Next.js CSP currently permits inline scripts/styles; it is not a nonce-based strict CSP.

See [security policy](SECURITY.md) for reporting and deployment controls.

## Persistence and Migrations

SQL migrations live in `backend/migrations/`. `npm run migrate:up` applies them;
`npm start` runs migrations before starting the compiled API.
Migration completion is not a guarantee of zero downtime.
Back up the database and review compatibility before deployment.

## Build Outputs

TypeScript compiles the backend to `dist/`; Next.js builds to `.next/`;
Vite builds the admin to `dist/`; Flutter produces platform artifacts under `build/`.
Generated directories are ignored, although historical tracked backend index artifacts
remain in this repository. Rebuild from source before starting the API.

## References

[Setup](docs/SETUP.md) | [Public API](docs/API.md) | [Deployment](DEPLOYMENT.md) |
[Verification](docs/VERIFICATION.md)
