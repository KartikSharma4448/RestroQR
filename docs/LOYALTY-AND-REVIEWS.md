# Loyalty and guest reviews

Local implementation. Production enablement requires separate approval.

## Configuration

Apply migration 024 using the established deployment process. Set
`LOYALTY_ENABLED=true` and/or `CUSTOMER_REVIEWS_ENABLED=true`. Both require
`CUSTOMER_EMAIL_ORDERING_ENABLED=true` and `PAYMENT_RECEIPT_EMAIL_ENABLED=true`.
Keep the existing Resend sender, durable outbox delivery settings and activation
cutoff. Never reset the cutoff just to send older queued mail.

Build the owner app with `--dart-define=CUSTOMER_ENGAGEMENT_ENABLED=true` to
show Dashboard > Guests & rewards. The backend flags remain authoritative.
Use the real HTTPS customer origin for `CUSTOMER_BASE_URL` in production.
Only localhost HTTP is accepted for development reward/review links.

## Owner controls

- Loyalty is OFF for each restaurant until its owner saves an enabled program.
- Schemes: seven paid visit dates, daily spend, or both.
- The owner sets reward descriptions, daily threshold and expiry (1-365 days,
  default 30). Existing rewards retain their earned descriptions and thresholds.
- Restaurant timezone defaults to Asia/Kolkata. It cannot change after the first
  loyalty payment, so earlier dates are not reinterpreted.
- Disabling the program stops new accrual; already-earned rewards remain usable.
- No automatic backfill of previous payments. This avoids mailing old customers
  or awarding historical activity without an explicit rollout decision.

## Qualification and privacy

Only an authenticated owner's new `completed -> payment_received` transition
records a qualifying payment. Pending, accepted, completed-but-unpaid, cancelled,
screenshots, transaction IDs and frontend success do not qualify.

One date counts once regardless of order count. The seven dates do NOT need to
be consecutive. The next visit cycle includes dates strictly after redemption's
restaurant-local date, not previous visits or more orders on redemption day.
An unredeemed active visit reward blocks another. After expiry a later payment
may issue a replacement if the seven-date qualification still holds.

Daily spend combines server-priced paid order totals minus recorded refunds on
the same local date. No separate taxes/fees are invented: the existing stored
order total is the qualifying basis. At most one spend reward is issued per
customer/restaurant/date, even if that reward is later revoked or expires.

Customer email is required but unverified; no customer login or OTP is added.
Normalized email is the loyalty identity, not verified proof of a real-world
person. Ledger/reward records store its SHA-256 hash. There is no public
phone/email lookup, customer history endpoint or exposed recipient address.

## Reward delivery and redemption

Progress, newly earned reward links and paid-visit review invitations are
appended to the existing payment receipt in the same database transaction.
They use the existing durable email worker, sender, retries and idempotency key.
No extra email is sent at order placement. Accept and Ready messages are unchanged.

Reward URLs use fragments: `/reward#<view-secret>.<claim-secret>`. Both are random
256-bit capabilities; only hashes live in loyalty tables. The receipt outbox
necessarily contains the private emailed URL: restrict database/log access and
do not enable third-party email click tracking on these links.

The browser sends secrets in POST bodies, never query strings. The private page
is noindex/no-follow and no-referrer. A customer copies the claim code to staff;
the scoped owner API previews the reward, then an explicit confirmation redeems
it. Customer advisory locks serialize earning, redemption and refunds; repeat
redemption is idempotent. Expired/revoked/wrong-restaurant claims are rejected.

If a receipt fails, use existing outbox operations; do not regenerate a different
claim secret or replay uncertain messages beyond the provider idempotency window.

## Refund accounting

Guests & rewards > Rewards > Refund accounting records an ALREADY completed
refund by order reference/ID and amount. It does not send money, call a payment
provider, change order status or reduce revenue reports. Record actual external
refunds through the restaurant's payment process first.

Amounts are bounded by remaining paid value and request IDs prevent double
recording after retries. Refunds revoke unredeemed rewards that no longer qualify.
If food was already redeemed, it is not clawed back: the reward is flagged
`refund_review` for manual restaurant review. Refund events remain auditable.

## Reviews and public payment

Each newly paid order gets one private `/visit#<secret>` invitation, valid 30 days.
One submission per order; rating 1-5 and up to 1000 plain-text characters.
Reviews are pending until the restaurant publishes them. Owners can hide them.
Public results contain rating, body and submission date, never customer email,
phone, order ID or name. Ratings explicitly describe published reviews, not all
submitted feedback. The public list shows the latest 30; owner management shows
the latest 100 submissions/rewards.

The customer header has Order/Menu, Reviews and Pay. Pay shows the restaurant's
configured UPI QR with no amount. Existing order checkout retains its separate
server-calculated amount-bound UPI link and cash/proof flow. The generic QR does
not associate a payment with an order or mark any bill paid.

## Verification boundaries

Automated tests use a separate disposable local PostgreSQL container and mocked
providers. Never point the destructive acceptance runner at the phone-test or
production database. Phone testing, real email delivery of new reward links,
production migration/deployment and Play Store publication remain separate gates.
