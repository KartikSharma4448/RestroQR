# Order and Payment Emails

## Rollout

Apply migrations 019 and 020 before enabling customer-email checkout. Back up
production first; local verification does not authorize a production rollout.

For the current accepted/ready/paid flow, also apply migration 022 and enable
`ORDER_LIFECYCLE_EMAIL_ENABLED=true`. This replaces placement confirmation:
pending checkout queues no email; owner acceptance queues order/items/price and
preparation status; completion queues food-ready notification; marking paid
queues the payment receipt when its receipt flag is enabled. Each transition and
its immutable email are committed atomically and repeated status clicks are
no-ops. Customer email remains the one saved at checkout; no OTP is required.

- `CUSTOMER_EMAIL_ORDERING_ENABLED=true`: require and save customer email at
  checkout. Legacy mode queues a placement confirmation; lifecycle mode above
  waits for acceptance instead. No customer OTP or login.
- `PAYMENT_RECEIPT_EMAIL_ENABLED=true`: queue a paid receipt when the authenticated
  restaurant owner changes a completed order to `payment_received`.
- `ORDER_EMAIL_DELIVERY_ENABLED=true`: run the outbox worker with backend-only
  `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Keep disabled during mocked tests.

For controlled activation, set `ORDER_EMAIL_DELIVERY_NOT_BEFORE` to a valid UTC
timestamp. Only jobs created on/after that timestamp are eligible; invalid values
disable sending. Persist the timestamp across restarts. Lifecycle mode also
excludes legacy placement-confirmation jobs, so enabling it cannot flush that
old queue. Do not remove the cutoff without reviewing old recipients. Automatic
local phone-test sending was explicitly approved for new lifecycle actions;
production remains unapproved and unchanged.

The regular backend entrypoint starts the worker. Custom local launchers must
explicitly start it; importing the Express app alone does not start delivery.
Before enabling delivery, inspect pending recipients so old test orders do not
unexpectedly send real emails. Sending a test requires recipient approval.

## Receipt Behavior

- Recipient is the email saved on the order, never an address supplied to the
  owner payment-confirmation endpoint. Email format is validated, not ownership.
- Includes receipt reference (order reference), restaurant/address, customer name
  or Guest, paid timestamp in UTC, saved items/options, quantities and total.
- This is an emailed payment receipt, not a PDF or GST tax invoice. No invented
  GST details, tax amounts, payment method or transaction ID.
- Owner confirmation is manual; a screenshot, UTR or frontend callback is not
  independent bank verification. Automated payments need verified webhooks.
- Concurrent/repeated confirmation queues one receipt. Cross-restaurant attempts
  fail. Queue failure rolls back the paid transition, allowing the owner to retry.
- Older orders without email can still be marked paid but receive no email.
- Provider failure after queueing does not undo payment; delivery retries instead.

## Delivery and Recovery

Rows are unique per order and message kind. Order confirmations and receipts use
different provider idempotency keys. Recipient, sender and message content are
frozen; catalog edits do not change queued messages. Workers use expiring leases
and token-guarded acknowledgments. `sent` means provider accepted, not inbox read
or guaranteed inbox delivery.

Accepted, ready and receipt messages also use separate keys. An eligible earlier
pending/sending email blocks later events for that order until it is resolved.
Old jobs excluded by the activation cutoff do not block new events. Provider
delivery/inbox ordering is outside the application's guarantee. Migration 022
rollback deletes lifecycle outbox rows; back up and stop workers before rollback.

Transient failures retry with bounded exponential backoff (up to eight attempts).
Permanent failures become `failed`. Expired ambiguous deliveries become
`uncertain`; never blindly reset them, alter their payload or generate fresh keys.
Reconcile provider history before any manually approved resend. Automatic retries
stop after 23 hours from the first attempt, within the provider deduplication
window: https://resend.com/docs/dashboard/emails/idempotency-keys

Before production, define retention/deletion for private customer emails and
receipt bodies, restrict database access, configure bounce/complaint monitoring,
and establish an operator review process for failed/uncertain rows. Do not expose
outbox contents or provider responses in public endpoints or logs.

Migration 020 rollback deletes payment-receipt outbox rows; take a backup and
review pending delivery before rollback. Do not roll it back while delivery runs.
