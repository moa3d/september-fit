# September Fit — Milestone 2

This milestone turns the backend into an actual hosted-fit integration service.

## New merchant endpoints

### Products

```text
POST /v1/products
GET  /v1/products/:productId
PUT  /v1/products/:productId/measurements
```

Product creation is tenant-scoped.

Garment measurement updates are versioned:
- old active measurement is deactivated
- version increments
- new version becomes active

### Profiles

```text
POST  /v1/profiles
GET   /v1/profiles/:profileId
PATCH /v1/profiles/:profileId
```

Profiles can be associated with an external merchant customer ID.

### Hosted Fit Sessions

```text
POST /v1/fit-sessions
GET  /v1/fit-sessions/:sessionId
```

Create example:

```json
{
  "external_product_id": "SEP-0491",
  "external_customer_id": "customer_735",
  "return_url": "https://shop.example.com/products/SEP-0491",
  "locale": "ar"
}
```

Response:

```json
{
  "session_id": "...",
  "fit_url": "http://localhost:3001/s/fs_secret_token",
  "status": "PROFILE_REQUIRED",
  "expires_at": "..."
}
```

## Return URL security

`return_url` is not accepted blindly.

Its origin must exist in `AllowedOrigin` for the authenticated merchant.

Example:

```text
https://shop.example.com/products/123
```

is accepted only if:

```text
https://shop.example.com
```

is registered for that merchant.

This blocks using September Fit as an open redirect.

## Public hosted-flow API

The customer website does not receive the merchant secret API key.

It uses the high-entropy session token embedded in `fit_url`.

```text
GET  /v1/public/fit-sessions/:token
POST /v1/public/fit-sessions/:token/profile
POST /v1/public/fit-sessions/:token/calculate
```

The database stores only SHA-256(token).

### Hosted flow

```text
Merchant
  |
  | POST /fit-sessions
  v
fit_url
  |
  v
Customer Web
  |
  | GET public session
  v
Product summary
  |
  | POST profile
  v
READY
  |
  | POST calculate
  v
Fit Engine V1
  |
  v
Result + validated return_url
```

## Customer web contract

### Read hosted session

```http
GET /v1/public/fit-sessions/fs_xxx
```

### Add body profile

```http
POST /v1/public/fit-sessions/fs_xxx/profile
Content-Type: application/json
```

```json
{
  "profile_type": "MENS",
  "preferred_fit": "REGULAR",
  "height_cm": 178,
  "weight_kg": 68,
  "chest_cm": 98,
  "shoulder_cm": 44,
  "sleeve_cm": 62
}
```

### Calculate

```http
POST /v1/public/fit-sessions/fs_xxx/calculate
```

The response contains the Fit Engine result and the previously validated `return_url`.

## Security boundaries now present

- merchant secret API key never needs to reach the customer browser
- tenant checks on merchant endpoints
- public session token is high entropy
- only token hash is stored
- session expires after 30 minutes
- return URL origin allowlist
- profile/customer cross-link check
- hosted result is tied to the session's product and merchant
