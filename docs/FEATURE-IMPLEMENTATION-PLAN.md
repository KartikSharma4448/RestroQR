# RestroQR feature implementation plan

Status: local implementation only. No production migration, push or deployment authorized.
Preserve the existing audit fixes and current owner/customer flows during rollout.

## Sequence and acceptance gates

1. Email and identity foundation: Resend transport, bounded requests, redacted
   failures, secure OTP generation and hashed storage. Next add transactional
   verification with expiry, attempt limits, resend cooldown and single use.
   Test provider failure, replay, concurrent verification and rate limits.
2. Owner signup/login: email and password, email OTP, mandatory matching verified
   Google identity. Verify Google tokens server-side using its supported library.
   Link only after proof of both identities; never merge by a client-supplied email.
   Keep admin authentication separate. Existing owners receive a setup flow.
3. Owner onboarding: owner image, restaurant cover, name/address and business UPI
   ID. Enforce completeness server-side before enabling new customer orders;
   continue allowing setup, existing-order management and invoices.
4. Menu: image or emoji, variants and add-ons. Validate uploads, ownership,
   option availability and prices on the server; test the Flutter editing flow.
5. Customer page: cover/owner image/name plus Order, Review and Pay actions.
   Required email; optional name/mobile; blank name becomes Guest. No customer
   OTP. Never expose order history or rewards through an email-only lookup.
6. Orders and receipts: durable email outbox for order confirmation and invoice
   on owner-confirmed payment. Retries and duplicate payment clicks must not
   produce duplicate receipts. Mail failure must not lose an accepted order.
7. Payments: amount-bound UPI QR/link or cash. Screenshot and transaction ID are
   claims, not bank verification. Owner verifies payment; keep food and payment
   statuses separate. Private proof uploads require authorized access.
8. Loyalty: owner enabled, per restaurant, seven distinct paid visit dates (not
   consecutive); multiple orders in a day count once. Owner selects reward.
   Secure emailed redemption link and owner confirmation, no customer OTP.
   Spend-based alternative and repeated cycles await the decisions below.
9. Notifications: FCM tokens, foreground/background handling, tap-to-order,
   logout cleanup and polling fallback. Test on an actual Android device;
   force-stop restrictions mean delivery cannot be guaranteed.
10. Regression/release: backend tests/build, Flutter tests/analyze, customer and
    admin builds, desktop/mobile checks, device and provider integration tests.
    Get explicit permission before live database changes, push and deployment.

## Integration checklist

- Resend: verified sending domain, approved sender address, sending-only API key
  stored in backend environment (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`).
- Google: project and OAuth consent configuration, server/web client ID,
  Android OAuth client for existing package and signing certificate fingerprints.
- Firebase: project, Android `google-services.json`, backend service-account
  credential through secure environment configuration. Never commit secrets.
- Cloudinary: verify existing server-side upload configuration and private
  payment-proof access strategy; never expose the API secret to the client.
- Isolated local/test database before running any migration; never use production
  DATABASE_URL for development or seed/test commands.

## Approved product defaults

- Spend scheme: combined daily paid spend, maximum one reward per customer per
  restaurant per day; owner selects threshold/reward (example INR 300).
- Visit scheme: start a new seven-date cycle after reward redemption.
- Use restaurant-local dates; unpaid/cancelled orders do not qualify.
- Refunds reduce qualifying spend; implement redemption/refund accounting tests.
- Reward expiry is owner-configurable, default 30 days.
- Owner can choose visits, spend or both; no requirement for consecutive dates.

## Remaining design safeguards

- Finalize qualifying spend exclusions and treatment of already-redeemed rewards
  when an earlier payment is refunded before implementing the loyalty ledger.
- Customer email is unverified: loyalty identity is not guaranteed, and reward
  redemption must require possession of the secure emailed link.

## Current remaining-feature implementation (2026-10-20)

### Owner app visual refresh

- Shared forest-green, white, coral and blue UI tokens; compact typography,
  navigation, forms, sign-in and empty states. No API/auth/payment logic changes.
- Dashboard now prioritizes Orders with direct profile editing and clearer
  restaurant/operations sections; no invented revenue or activity metrics.
- Menu categories have ordered indices, an explicit reorder handle and action
  menu. Deletion still requires confirmation. Dish rows separate photo/emoji,
  price and availability/edit/delete controls.
- Order tickets show their actual status and item quantity, with existing
  Accept/Complete/Mark Paid actions and private payment review preserved.
- Verified: Flutter analyzer clean; 135 tests passed with one existing skip,
  including golden screenshots and 320px enlarged-text checks. Updated screenshot
  baselines were visually inspected, then tested again without golden updates.
- Android local-test APK prepared with existing feature flags. Device installation
  remains pending while ADB reports no connected phone. No push/deploy performed.

### Customer cafe-menu refresh

- Scoped restaurant styling: owner cover/photo, prominent restaurant name/address,
  cafe typography, numbered menu sections and compact photo/emoji dish rows.
- Shared menu browser preserves browse/table carts, category navigation, search,
  diet filters, custom options and unavailable-item states. Empty categories are
  omitted from navigation. Reduced-motion preferences are respected.
- Order, Reviews, Pay and waiter assistance remain available. Menu content comes
  before the live order board; a header link jumps directly to the board.
- No invented restaurant photos, opening hours, ratings or popularity labels.
  Local screenshot fixtures use explicitly separate sample cafe data.
- Verified: customer production build and TypeScript check; 60 desktop/mobile
  browser tests passed, including 320px long-name and failed-cover checks.
- Existing local cafe page checked against the running local API. No order,
  email, production database or deployment changes were made for this refresh.

- Migration 024 adds owner-controlled seven-date/daily-spend/both loyalty,
  immutable payment-date accounting, private reward capabilities and refund audit.
- New paid transitions append progress/reward/review links to the durable receipt;
  there is no historical backfill or customer OTP/email-history lookup.
- Refund defaults: recorded external refunds reduce qualification; unredeemed
  rewards are revoked, redeemed rewards are flagged for manual review.
- Owner Guests & rewards screen provides opt-in settings, claim preview and
  confirmation, refund recording, reward history and review moderation.
- Customer header now offers Order/Menu, Reviews and Pay. Private reward and
  paid-visit review pages are noindex; public reviews require owner publication.
- Details and rollout flags: [Loyalty and reviews](LOYALTY-AND-REVIEWS.md).
- Release gates still require device verification and explicit approval for
  production migration, push/deployment and Play Store release.
- Verified this pass: 690 backend regression tests; 73 isolated PostgreSQL
  acceptance tests; 134 Flutter tests passed with one existing skipped test;
  56 desktop/mobile customer browser tests. Backend/customer production builds
  and debug Android APK build passed. Screenshots inspected at mobile size.
- Local phone-test database was backed up before migration 024. Local feature
  flags enabled without changing stable keys, QR tokens or email activation cutoff.
  Per-restaurant loyalty remains OFF until the owner enables it. No new live
  reward/review email was sent by automated tests. Device installation is pending
  because ADB currently reports no connected phone.

## Implementation record

- Started: Resend transport and OTP cryptographic primitives with isolated tests.
- Verified locally: 13 new foundation tests; full backend 50 suites / 532 tests
  passed; TypeScript build passed. Email calls are mocked, not live delivery.
- Google linking/login implementation added behind disabled rollout flags:
  `POST /api/auth/google/link` requires the existing owner JWT and a matching
  verified Google identity; `POST /api/auth/google/login` only accepts a previously
  linked Firebase UID and Google subject, never an email-only account lookup.
  Linking uses a row lock, transaction and unique identity constraints.
- Firebase token checks include project/issuer, Google provider, verified email,
  recent authentication and revoked/disabled-user checks. No token logging.
- Flutter Android Google proof exchange, cancellation handling, linking control
  and login control added. Enable only in a test build with
  `--dart-define=GOOGLE_OWNER_AUTH_ENABLED=true` after the backend is ready.
- Verification after Google changes: backend 52 suites / 562 tests passed;
  Flutter 95 tests passed; Flutter analysis clean; backend TypeScript build passed.
  Android `:app:processDebugGoogleServices` also passed; this verifies config
  processing, not a complete APK build or actual Google login on a device.
  Firebase/Google provider calls and database identity writes are mocked in tests.
- Pending: isolated database migration verification, backend service-account
  configuration, actual device Google login, signup email OTP lifecycle and
  onboarding activation gate. Existing owner access is not restricted yet.

## Google rollout prerequisites

1. Use a separate test database and review/apply migration 014 there, not on the
   production URL. Migration has not been applied by this implementation.
2. Set `FIREBASE_PROJECT_ID=restroqr2` and securely configure a matching Firebase
   Admin service account using `GOOGLE_APPLICATION_CREDENTIALS`. Never put the
   service-account file in Flutter assets, public folders or source control.
3. Enable `GOOGLE_OWNER_AUTH_ENABLED=true` in that test backend only, and enable
   the Flutter compile-time flag for a test Android build.
4. Verify password login -> Google linking -> logout -> Google login, mismatched
   Google account, cancellation, revoked Firebase user and disabled owner.
5. Add release/Play App Signing fingerprints separately before production testing.
6. Only after OTP/onboarding gates are complete and approved, enable mandatory
   owner setup with a migration path for existing users. No automatic rollout.

## Phase 1: Email OTP and Google onboarding

- Added migration 015: pending signup challenges, owner email verification date
  and per-owner Google-connection requirement. Existing owners default to false.
- New signup does not create an owner or issue an app session until OTP succeeds.
  Resend emails use a cryptographic six-digit OTP, keyed hash, 10-minute expiry,
  one-minute cooldown, five sends/hour/email and five guesses/hour/email.
- Resending does not reset failed guesses. Invalid guesses commit the attempt
  counter. Verification locks the row and consumes it in the owner-creation
  transaction. Actual PostgreSQL concurrency/migration validation remains pending.
- Added `/auth/register/verify`, `/auth/register/resend`, `/auth/onboarding` and
  disabled rollout flag `OWNER_EMAIL_SIGNUP_ENABLED`. Both signup and Google flags
  must be enabled with a separate `EMAIL_OTP_SECRET` of at least 32 bytes.
- Flutter handles pending verification without storing the password for resend,
  OTP validation/errors/cooldown, mandatory Google connection and session restore.
  New owners cannot use owner business routes before linking; profile setup and
  notifications remain accessible. Restaurant activation/profile completeness
  and customer public-menu enforcement belong to Phase 2 and remain pending.
- Email OTP and Google authentication tests use mocks. No live migration or real
  signup email was performed in this phase. Do not enable against production yet.
- Final local checks: 54 backend suites / 592 tests; 103 Flutter tests; clean
  Flutter analysis; TypeScript build; whitespace check. New screens have inspected
  390x844 screenshots and 320x640 enlarged-text layout coverage. Migration 014/015
  up/down SQL generation passed, but no PostgreSQL execution was performed.
- Before release, add scheduled deletion for stale pending signup records; they
  contain personal contact details and password hashes, not plaintext passwords.

## Phase 1 acceptance verification

- Android debug APK compiled successfully with both onboarding feature flags.
  This is not a signed Play release and does not prove Google login on a device.
- Opt-in real PostgreSQL tests: `npm run test:postgres`. Requires explicitly set
  `RESTROQR_ACCEPTANCE_DATABASE_URL` on `127.0.0.1` with database name starting
  `restroqr_auth_acceptance_`. Other targets are refused before migrations.
  The runner never falls back to the repository's `.env` database URL.
- The disposable database is migrated through current migrations. Acceptance
  tests truncate its owner/signup tables; never point it at valuable local data.
- Nine acceptance scenarios cover full signup/link/login, concurrent OTP replay,
  concurrent wrong guesses, resend serialization, mail-failure rollback, expiry,
  case-insensitive password login, mismatched Google email and disabled-owner login.
  Google/email providers are mocked; PostgreSQL operations are not mocked.
- Docker engine became available after the user's reset. All migrations applied
  successfully to a temporary localhost-only PostgreSQL 17 container. All nine
  real-database acceptance scenarios passed. Providers remained mocked.
- Migration 014/015 rollback succeeded in that disposable database, followed by
  reapplication and rerun. No production migration was performed.
- Actual database testing exposed case-sensitive/space-sensitive password login;
  owner/admin email lookup now ignores case and trims supplied email.
- Regression after this fix: 55 suites / 597 tests passed; backend build passed.
- No Android device is connected. Emulator profile `Medium_Phone_API_36.1` exists,
  but real Google account interaction still requires a controlled test session.
- No production database, deployment or real signup email was changed in this step.

## Phase 2: Owner identity and restaurant activation

- Migration 016 adds owner profile photo, restaurant business UPI ID and a
  per-restaurant onboarding requirement. Legacy restaurants default to exempt;
  new restaurants require setup when `OWNER_PROFILE_ACTIVATION_ENABLED=true`.
- Owner-only endpoints under `/api/owner/restaurant`: `GET /onboarding`,
  `PUT /business-upi`, `POST /profile-images` (ownerPhoto and/or cover).
- Seven server-calculated completion checks: verified email, Google connection,
  owner photo, cover, restaurant name, address and business UPI syntax.
- Completion does not override disabled owner/restaurant status. Existing orders
  remain available; new orders are rejected until required setup is complete.
  Activation is checked again inside the order transaction with profile/account
  row locks to avoid a concurrent setup/disable change bypass.
- UPI syntax validation does not verify VPA existence or bank account ownership.
  Actual payment intent/confirmation remains a later phase.
- New image path limits uploads to two files, 5MB each; JPEG/PNG/WebP signatures
  are checked before Cloudinary image decoding and JPEG re-encoding. No placeholder
  URL is used if storage is unconfigured. Provider failures leave stored URLs
  unchanged. Old provider assets and failed multi-file orphan cleanup need a
  separate retention policy before production growth.
- Flutter profile screen includes cover and owner-photo pickers, business UPI
  editing, live server completion and checklist, retry/error/cancellation states.
  Unsaved UPI input survives an image upload. All new UI is behind the compile-time
  `OWNER_PROFILE_ACTIVATION_ENABLED=true` flag.
- Incomplete restaurant table pages remain browseable but do not expose order
  checkout. Backend order gating remains authoritative.
- Verified: 623 backend tests; 112 Flutter tests; 28 browser tests across desktop
  and mobile; 13 real PostgreSQL acceptance tests. Backend/customer builds and
  Flutter analysis passed. Inspected owner/mobile customer screenshots.
  Android debug APK also compiled successfully with all three feature flags.
- Migration 016 applied, rolled back and reapplied only in a disposable local
  PostgreSQL 17 container. Test providers are mocked; media storage fixtures in
  database acceptance tests are synthetic, not real uploaded personal photos.
- Cloudinary is now configured locally. Seven live integration checks passed
  through the authenticated multipart HTTP route, real Cloudinary and disposable
  PostgreSQL: authentication/role rejection, invalid/oversized/unexpected files,
  two-image upload, delivered image bytes, persisted URLs after reload, owner
  isolation and completed-profile activation. Both synthetic images were deleted.
  Run `scripts/check-profile-upload.cjs` only with a fresh empty local acceptance
  database and explicit `RESTROQR_LIVE_UPLOAD_TEST=true`; this calls real storage.
- Actual Android gallery-picker and Google-login/device checks remain pending.
  No production migration, feature enablement, push or deployment was performed.

References: https://cloudinary.com/documentation/node_image_and_video_upload
and https://cloudinary.com/documentation/image_upload_api_reference

## Phase 3A: Dish photos and emoji

- Menu media endpoints are behind `MENU_MEDIA_ENABLED=true`; Flutter controls
  use the matching compile-time flag. Migration 017 adds an optional emoji column.
  Existing menus and prices remain unchanged while the flag is disabled.
- Owner editing offers Photo, Emoji or None. Gallery JPEG/PNG/WebP up to 5MB
  supports local preview; emoji needs no upload. Changing media mode clears the
  previous image URL/emoji in the database, without deleting old storage assets.
- Restaurant-scoped authenticated routes validate media and upload limits,
  re-encode through Cloudinary, bound provider requests and clean up a newly
  uploaded orphan if its database update fails. Secrets remain backend-only.
- Retry after partial save reuses the saved dish ID instead of creating duplicates.
  Partial media failure is visible. Owner lists and customer cards display media;
  failed customer images fall back to an illustration/icon.
- Verified: 57 backend suites / 644 tests; 118 Flutter regression tests plus
  the enabled-feature save-retry test; 30 desktop/mobile browser checks;
  16 isolated real PostgreSQL acceptance tests (external providers mocked).
  Backend/customer builds and Flutter analysis passed. Migration 017 rollback
  verified only on the disposable acceptance database.
- User reported the previous local phone flows passed; this is user-observed,
  not an independent automated device assertion.
- Variants/sizes and add-ons remain Phase 3B: server-authoritative option pricing,
  order snapshots, cart-line identity, owner editing and customer selection tests.
- No production migration, push or deployment performed.

## Phase 3B: Sizes, add-ons and configurable orders

- Implemented behind matching backend/Flutter `MENU_OPTIONS_ENABLED=true` flags.
  Migration 018 adds item catalog options and immutable order option snapshots.
  No production migration or rollout performed.
- Owner editing supports up to 12 sizes and 20 add-ons, with names, prices,
  availability and removal. Size price replaces the base price; add-ons add to it.
  Add-ons may be free. IDs remain stable when editing existing options.
- Customer menus show customization with radio sizes and checkbox add-ons.
  Identical combinations merge; different combinations remain separate cart lines.
  Both browse-only and table-order carts preserve selections when quantity changes.
- Backend validates IDs, availability, restaurant/item ownership, duplicates,
  exact decimal money and aggregate limits. The browser sends IDs, not prices.
  Current catalog rows are locked through order insertion, preventing concurrent
  catalog edits from racing the selected price snapshot. Customer-supplied prices
  are ignored. Changed/deleted options fail with a refreshable conflict.
- Owner orders/history and customer confirmation show saved option names; deletion
  or editing of the catalog does not rewrite old order prices or selected names.
- Fifty configured lines can exceed the old 10KB JSON cap. Only the public order
  endpoint accepts up to 64KB; larger payloads get a structured 413. Other routes
  retain their existing limits. A real 50-line/18-add-ons-per-line order is covered.
- Verification: 58 backend suites / 666 tests; 123 Flutter regression tests plus
  enabled-feature save-retry verification; 36 desktop/mobile browser checks;
  21 real PostgreSQL acceptance checks. Builds/analyzer passed. Migration 018
  rollback/reapplication verified only in a disposable database. Owner editor and
  mobile customer customization screenshots inspected.
- Updated debug APK built with media/options and existing onboarding flags for
  later manual phone testing. User approved the local setup update: the launcher
  now persists separate local test keys outside this repository, migration 018
  is applied only to the backed-up local phone-test database, and one local table
  QR was renewed. Repeating preparation renews zero QR tokens; data counts remain
  one owner/restaurant/table/item and two orders. Authenticated owner options,
  public menu, QR PNG and local customer page checks passed. The phone is currently
  disconnected, so the updated APK has not been installed on it yet. Old cached
  app sessions require one sign-in; use the renewed local table QR for testing.
- Separate upcoming work: customer welcome/review/payment actions, required
  customer email, order/invoice outbox, payment proof and loyalty ledger.

## Phase 4: Customer email checkout and order confirmations

- Customer welcome metadata includes owner photo and restaurant address. Checkout
  requires email; name/mobile remain optional and a blank name becomes Guest.
  No customer OTP/login is introduced. Email validation checks format only.
- Migration 019 persists customer email, request identity and a durable outbox.
  Repeated checkout requests reuse one order/confirmation; changed retry payloads
  conflict. Confirmation queues atomically with the order and never claims paid.
- Recipient rate limits: five orders per 15 minutes and 20 per day. Delivery uses
  bounded retries, stable provider keys and expiring worker leases.
- Previous-phase verification: 690 backend tests, 40 desktop/mobile browser
  checks, 30 isolated PostgreSQL acceptance checks and backend/customer builds.
- One explicitly approved dummy confirmation was accepted by Resend and the user
  confirmed receipt. This does not enable production or ongoing local delivery.
- Review actions, UPI checkout/proof and loyalty are separate upcoming phases.

## Phase 5A: Owner-confirmed payment receipt email

- Migration 020 adds a message kind and one unique outbox row per order/kind.
  `PAYMENT_RECEIPT_EMAIL_ENABLED` defaults false. Existing authenticated owner
  payment confirmation is reused; no new customer action or OTP is needed.
- A locked transaction updates completed orders to paid and queues the receipt.
  Duplicate confirmation is a no-op; queue errors roll back payment confirmation.
  Legacy orders without email remain payable without inventing a recipient.
- Receipt uses saved order prices/options, restaurant/address, receipt reference,
  paid time and Guest/name. It is a payment receipt, not a GST tax invoice or PDF.
  Manual owner confirmation does not independently verify UPI/bank settlement.
- Delivery failures do not undo payment; retry uses a separate stable receipt key
  and immutable content. No production migration, push/deploy or real receipt
  email authorized/performed in this phase.
- Operating flags, private-data retention prerequisites and recovery guidance:
  [Order email operations](ORDER-EMAIL-OPERATIONS.md).
- Verification: backend build and 690 regression tests passed; 37 isolated
  PostgreSQL checks passed, including seven receipt-flow checks. Migration 020
  rollback/reapplication passed only in the disposable database. No Flutter or
  customer UI changes were needed for the existing owner payment button.

## Phase 5B: UPI intent, cash and private payment proof

- Migration 021 and `ORDER_PAYMENTS_ENABLED` (default false) add private,
  order-bound payment access and snapshotted restaurant VPA/name. Amount is taken
  from the saved order, not customer input. Missing VPA falls back to cash only.
- Customer checkout offers UPI PNG QR/deep link, cash selection, transaction ID
  and bounded private screenshot upload. Latest checkout is recoverable within
  the browser session. Owner app shows payment choice and a scoped review dialog.
- All submissions remain unverified; only the existing owner payment-confirmation
  action changes the paid state. No gateway, callback-based confirmation or
  automated settlement is claimed. Cooking/order status progression is preserved.
- Capability expiry, no-store responses, authenticated Cloudinary media,
  short-lived owner downloads, upload-attempt caps, duplicate transaction IDs,
  order closing races and orphan cleanup are covered by isolated tests.
- See [Payment choices operations](ORDER-PAYMENT-CHOICES.md) for rollout flags,
  privacy, limits and remaining manual bank/phone acceptance checks. Production,
  actual payments and real screenshot-provider uploads are not part of automated
  verification. No push/deploy performed.
- Verified: 690 backend regression tests, 48 isolated PostgreSQL checks and 44
  desktop/mobile browser checks; latest payment recovery checks passed again
  after the final UI change. Flutter analysis and 125 tests passed (one existing
  test skipped). Backend/customer builds passed. Migration 021 rollback/reapply
  was verified only in the disposable acceptance database.
- A separate local preview database/server was started with a dummy VPA and
  automatic email delivery disabled. Actual local browser -> API -> database
  cash checkout passed. The existing phone-test and production databases were
  not migrated. New owner APK installation and real-device UPI/provider upload
  acceptance remain pending; automated Cloudinary tests used mocks.

## Updated Email Lifecycle: Accepted, Ready, Paid

- User clarified that order placement must not send a confirmation. With
  `ORDER_LIFECYCLE_EMAIL_ENABLED`, pending orders store customer email only.
  Owner Accept sends saved order details/prices and preparation status; Complete
  sends readiness; Payment Complete sends the receipt. No customer OTP or need
  to share the recipient with the developer.
- Migration 022 adds accepted/ready message kinds. Atomic locked transitions,
  unique per-event queues and provider keys prevent duplicate status emails.
  Earlier eligible pending/sending emails block later events for the same order.
- Verification: 690 backend tests, 54 isolated PostgreSQL checks (six lifecycle
  cases) and six desktop/mobile email-checkout checks passed; backend build passed.
  Tests use mocked provider delivery, including retry ordering and cutoff checks.
- User explicitly approved local automatic sending for new Accept/Ready/Paid
  actions. Phone-test DB was backed up, migration applied and worker started with
  a persistent activation cutoff. Old placement-confirmation jobs are excluded,
  no old queue is flushed. Production/push/deploy remain unchanged.

## Added Feature: Waiter Calling

- User approved table requests routed to owner app, without separate waiter login.
  Added migration 023 and matching disabled-by-default backend/Flutter flags.
- Table menu sends a durable request; owner Orders panel acknowledges/resolves.
  Best-effort FCM uses the existing owner token and Orders tap navigation; active
  polling preserves visibility if push fails. No order/payment status is changed.
- One active request per table, one-minute post-resolution cooldown, rotated-token
  rejection and restaurant-scoped authenticated owner updates prevent basic abuse.
- Verification: six real PostgreSQL waiter cases (60 acceptance checks total),
  four desktop/mobile waiter checks and two owner-panel tests passed. Backend
  regression suite remained 690 passing. Background device acceptance is pending.
- See [Waiter calling](WAITER-CALLING.md) for flags, limits and operations.
- Full Flutter regression: 127 passed, one existing test skipped; analysis clean.
  Backend/customer builds passed. Migration rollback/reapply checked only on the
  isolated acceptance DB. Backed-up phone DB enabled locally; existing data/QR
  and lifecycle-email cutoff preserved. Waiter-enabled debug APK installed on
  the connected Vivo. Real push/acknowledge/resolve device acceptance is pending.

## Waiter Alert Simplification

- User requested an app-wide full-screen bell with only OK, replacing separate
  acknowledgement/resolution steps. Foreground alert now sits above all owner
  routes and loops the system notification tone through an Android audio bridge.
- OK stops sound immediately and closes pending requests directly. Failed close
  stays visible for silent retry; duplicate polls/pushes do not restart the tone.
  Multiple calls advance one at a time. Logout/background/disposal stop audio.
- Background still uses ordinary FCM notification, respecting Android 14+
  restrictions and user notification volume/DND. No lock-screen takeover or
  guaranteed force-stopped-app delivery is claimed.
- APK compiled; Flutter analysis and 130 tests passed (one existing skip), 690
  backend regression tests passed. Focused alarm tests cover one OK, retries,
  lifecycle cleanup, no duplicate sound restart and small-phone layout. Device
  audio acceptance remains pending until wireless debugging reconnects.
- After Docker recovery: all 61 isolated PostgreSQL cases passed, including
  direct single-OK close and repeat safety. Four customer browser waiter checks
  passed. Preserved local DB and servers were restored with unchanged keys and
  email activation cutoff. Latest alarm APK is built but not installed: wireless
  debugging is disconnected and the advertised endpoint refused connection.

## Customer Menu Tabs

- Added Live orders beside Pay; opens one inline live board and stops its polling
  when closed. Legacy menus retain their existing board.
- Categories now filter dishes instead of scrolling. All restores every category;
  All / Veg / Non-Veg filters combine with category and search without losing cart.
- Desktop and mobile keyboard/tab navigation, empty results and narrow layouts
  covered. All 64 isolated customer browser checks and production build passed.
- Local website/backend health checked read-only. No production deployment or
  real customer email was triggered for this UI change.

## References

- https://resend.com/docs/api-reference/emails/send-email
- https://developers.google.com/identity/sign-in/web/backend-auth
