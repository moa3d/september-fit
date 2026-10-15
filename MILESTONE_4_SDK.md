# September Fit — Milestone 4: Browser SDK / Widget

## Goal

A merchant should be able to add:

```ts
SeptemberFit.open({
  productId: "SEP-0491"
});
```

without exposing a September Fit secret key in the browser.

## Secure architecture

```text
Merchant Browser
     |
     | @september-fit/sdk
     v
Merchant Backend
/api/september-fit/session
     |
     | Authorization: Bearer sk_live_...
     v
September Fit API
POST /v1/fit-sessions
     |
     v
fit_url
     |
     v
SDK Modal / iframe
     |
     v
fit.septemberfit.com/s/fs_...
```

The secret API key exists only on the merchant server.

## SDK initialization

```ts
import { SeptemberFit } from "@september-fit/sdk";

SeptemberFit.init({
  sessionEndpoint: "/api/september-fit/session",
  fitOrigin: "https://fit.septemberfit.com",
  mode: "modal",

  onComplete(event) {
    console.log(event.fitScore);
  },

  onError(error) {
    console.error(error);
  },
});
```

## Open

```ts
await SeptemberFit.open({
  productId: "SEP-0491",
  externalCustomerId: "customer_735"
});
```

## Open modes

### Modal

```ts
mode: "modal"
```

The SDK creates a modal + iframe.

### New tab

```ts
mode: "new-tab"
```

The hosted flow is opened in a new tab.

## Merchant endpoint contract

The SDK sends:

```json
{
  "product_id": "SEP-0491",
  "external_customer_id": "customer_735",
  "profile_id": null,
  "locale": "ar",
  "return_url": "https://merchant.example/product/SEP-0491"
}
```

The merchant endpoint returns:

```json
{
  "session_id": "...",
  "fit_url": "https://fit.septemberfit.com/s/fs_...",
  "status": "PROFILE_REQUIRED",
  "expires_at": "..."
}
```

An example Next.js merchant route is included:

```text
examples/merchant-nextjs/app/api/september-fit/session/route.ts
```

## postMessage completion contract

When hosted September Fit runs inside the SDK iframe, it sends:

```json
{
  "type": "september-fit:complete",
  "sessionId": "...",
  "returnUrl": "https://merchant.example/product/...",
  "fitScore": 91,
  "label": "EXCELLENT",
  "confidence": "HIGH"
}
```

The SDK:
1. validates message origin,
2. validates the active session ID,
3. calls `onComplete`,
4. closes the modal.

## Important iframe policy

The hosted Fit site needs a `frame-ancestors` CSP that permits registered merchant origins.

The development build currently permits:

```text
https:
http://localhost:*
```

This is intentionally a development-friendly policy.

### Production requirement

Do not leave this broad in production.

Recommended production approaches:

1. Edge proxy reads registered merchant origin and emits a matching CSP.
2. Or maintain a generated allowlist from `AllowedOrigin`.
3. Reject embedding from any origin not registered to a merchant.

## Security rules

- `sk_live_*` never enters the browser.
- SDK talks only to merchant backend.
- iframe completion uses `postMessage`.
- SDK validates `event.origin`.
- SDK validates `sessionId`.
- hosted session token remains short-lived.
- merchant `return_url` remains origin-validated by the backend.
- no `allow-top-navigation` is granted to the iframe sandbox.

## Package

```text
packages/sdk-js
```

Build:

```bash
npm run build:sdk
```

## Next milestone

Production integration layer:

- idempotency middleware
- webhook dispatcher + HMAC signing
- merchant developer dashboard:
  - API keys
  - allowed origins
  - webhooks
  - API logs
- publishable SDK bundle/CDN loader
