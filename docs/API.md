# Public API

Base path: `/api/public`. Public endpoints are rate limited and return JSON.
Owner/admin APIs require JWT authentication and role/resource ownership checks.

## Menu

`GET /menu/:restaurantToken`

Returns `{ success: true, data: { restaurant, categories } }`.
Categories contain dish identifiers, names, descriptions, prices, images, badges and availability.
Invalid/unavailable menus return a generic 404.

## Table Order

`POST /orders`

```json
{
  "tableToken": "<QR table token>",
  "items": [{ "itemId": "<dish UUID>", "quantity": 2 }],
  "customerName": "Example Customer"
}
```

Optional customer name is limited to 100 characters. Optional customer phone must
be a 10-digit string. Do not send phone information without a product need and suitable notice.
Public quantities must be safe integers from 1 to 100, with 1 to 50 item rows.
Duplicate item identifiers are rejected.
Prices are loaded by the server; clients cannot set trusted totals.

## Live Order Board

`GET /order-board/:restaurantToken`

```json
{
  "success": true,
  "data": [
    {
      "orderRef": "ORD-ABC123",
      "tableName": "Table 4",
      "customerName": "E. C.",
      "status": "accepted"
    }
  ]
}
```

This board is visible to everyone with the restaurant QR URL.
Customer names are converted to up to three initials on the server.
Phone numbers, internal identifiers, order items and totals are excluded.
Inactive owners/restaurants or invalid tokens return the same generic 404.
Response header: `Cache-Control: no-store`.

The endpoint returns up to 100 recent orders; see [architecture](../TECHNICAL.md)
for time windows. Client polling uses a 15-second delay between requests.

## Rewards

`GET /loyalty/:phone` currently returns 403 with code
`CUSTOMER_VERIFICATION_REQUIRED` and no customer data.
Do not treat phone possession or a printed QR as authentication.

## Errors

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "..." }
}
```

400 means invalid input, 401/403 indicates authentication/authorization failure,
404 means unavailable resource, 409 indicates a state conflict and 429 a rate limit.
Do not retry order creation blindly after a network failure: it is not an idempotent
request and may already have succeeded.
