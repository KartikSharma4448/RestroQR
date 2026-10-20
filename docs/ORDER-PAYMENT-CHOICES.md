# UPI, Cash and Payment Proof

## Local-first Rollout

Apply migration 021 only after a database backup and rollout approval. Enable
`ORDER_PAYMENTS_ENABLED=true` together with `CUSTOMER_EMAIL_ORDERING_ENABLED=true`.
The flag defaults off. No provider checkout credentials are needed for generic
UPI links, but a valid restaurant business VPA and phone-app acceptance must be
tested with the owner before production. VPA format validation is not ownership
verification or a guarantee that every UPI app will accept the intent.

Order creation returns a private payment capability only to that checkout. Its
24-hour access window is checked server-side. Keep it out of URL query strings,
logs, analytics and public order boards. Responses use `Cache-Control: no-store`.
The customer browser retains the latest checkout in session storage so refresh
and View last order & payment can reopen it; clearing browser storage loses that
access. This is not an account or cross-device order history.

## Customer and Owner Flow

1. After order creation, fetch payment details using `X-Order-Token`.
2. The server snapshots restaurant VPA/name and reads the saved order total.
   Generate a PNG QR and generic UPI intent containing INR amount and reference.
3. Customer chooses cash or submits an 8-64 character alphanumeric transaction
   reference together with one JPEG/PNG/WebP screenshot up to 2MB.
4. Owner orders show Cash selected or UPI proof submitted. Review payment opens
   the transaction reference and a private, short-lived screenshot download.
5. The owner verifies payment with their bank or collects cash, then uses the
   existing completed-order payment confirmation. Receipt email follows only
   when its separate receipt/delivery flags are enabled.

Neither a UPI link, client callback, cash choice, screenshot nor transaction ID
marks an order paid. Proof is an unverified customer claim; there is no automated
bank settlement verification. The existing cooking/order status flow is unchanged.
Customers do not need login or OTP. No actual payment was made during tests.

## Proof Privacy and Abuse Controls

- Check the capability before accepting multipart data; global API rate limits
  still apply. Check restaurant/owner active state and order expiry.
- Provider-decode/re-encode screenshots as JPG; use Cloudinary `authenticated`
  delivery, never the public menu-image upload path. Keep only the asset ID in DB.
- Owner access is authenticated and restaurant-scoped. Generated signed download
  links expire after 60 seconds. Public status responses contain no proof links.
- Three upload attempts per order, including failures; one immutable proof per
  order. A retry with the same reference is a no-op after submission. Corrections
  require contacting the restaurant; there is no automatic overwrite.
- A transaction reference cannot be reused across orders at the same restaurant.
  This prevents duplicate submission, not fabricated transaction IDs.
- Lock order state while committing choices/proof. Reject cancelled/paid orders;
  clean up a newly uploaded private orphan on database failure or a closing race.
- Existing legacy orders without a payment session remain usable. A restaurant
  without a configured VPA offers cash only.

Before production, decide proof/transaction retention, access logging and manual
correction procedures. Database deletion/migration rollback does not delete old
Cloudinary assets; inventory and remove those only under approved cleanup. Do not
reset production payment data or enable real email just to test this feature.

## References

- https://developers.google.com/pay/india/api/android/in-app-payments
- https://cloudinary.com/documentation/control_access_to_media
- https://cloudinary.com/documentation/image_upload_api_reference
