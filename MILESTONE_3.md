# September Fit — Milestone 3: Customer Web

This milestone adds the independent customer-facing website:

```text
fit.septemberfit.com
```

The merchant store does not contain the Fit UI.

## Route

```text
/s/:token
```

Example:

```text
http://localhost:3001/s/fs_abc123...
```

The token comes from:

```text
POST /v1/fit-sessions
```

## Customer flow

```text
Merchant Product Page
      |
      | "هل تناسبني؟"
      v
POST /v1/fit-sessions
      |
      v
fit_url
      |
      v
September Fit Customer Web
      |
      +-- Load session/product
      +-- Basic profile
      +-- Fit preference
      +-- Precise measurements
      +-- Calculate
      +-- Show explainable Fit Score
      |
      v
Validated return_url
      |
      v
Merchant Store
```

## Browser security boundary

The customer web app only calls:

```text
GET  /v1/public/fit-sessions/:token
POST /v1/public/fit-sessions/:token/profile
POST /v1/public/fit-sessions/:token/calculate
```

It never receives or embeds:

```text
sk_test_...
sk_live_...
```

Merchant secret keys stay server-side.

## V1 precision behavior

The UI deliberately does not claim that height + weight can reliably determine clothing fit.

Upper-body categories require:

```text
chest_cm
```

Lower-body categories require:

```text
waist_cm
```

Additional measurements increase the engine coverage/confidence.

## Run locally

Start PostgreSQL:

```bash
docker compose up -d
```

Install:

```bash
npm install
```

Prepare DB:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

Start API:

```bash
npm run dev:api
```

Start customer web in another terminal:

```bash
npm run dev:web
```

URLs:

```text
API:          http://localhost:3000/v1
Customer web: http://localhost:3001
```

## Create a hosted session

Use the TEST API key printed by the seed:

```http
POST http://localhost:3000/v1/fit-sessions
Authorization: Bearer sk_test_...
Content-Type: application/json
```

```json
{
  "external_product_id": "SEP-0491",
  "external_customer_id": "customer_web_demo",
  "return_url": "https://shop.example.com/products/SEP-0491",
  "locale": "ar"
}
```

Open the returned `fit_url`.

## Production domains

Recommended:

```text
api.septemberfit.com
fit.septemberfit.com
dashboard.septemberfit.com
```

Customer web environment:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.septemberfit.com/v1
```

Backend environment:

```env
FIT_WEB_BASE_URL=https://fit.septemberfit.com
```

## UX states implemented

- loading
- invalid/expired session
- product intro
- basic profile
- profile type
- Slim / Regular / Loose preference
- precise measurements
- category-aware required measurement
- calculation loading
- result
- metric-by-metric explanation
- confidence
- engine version
- warnings
- return to merchant
- edit and recalculate

## Next milestone

Merchant-side integration SDK / widget:

```text
@september-fit/sdk
```

Goal:

```js
SeptemberFit.open({
  productId: "SEP-0491"
});
```

The SDK should call the merchant backend, not use a secret key in the browser.
