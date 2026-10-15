# September Fit — Milestone 5: Developer Dashboard

## What was added

### Developer backend endpoints

```text
GET    /v1/developer/overview

GET    /v1/developer/api-keys
POST   /v1/developer/api-keys
DELETE /v1/developer/api-keys/:id

GET    /v1/developer/origins
POST   /v1/developer/origins
DELETE /v1/developer/origins/:id

GET    /v1/developer/webhooks
POST   /v1/developer/webhooks
DELETE /v1/developer/webhooks/:id

GET    /v1/developer/logs
```

### Dashboard app

```text
apps/developer-dashboard
```

Local URL:

```text
http://localhost:3002
```

## Run

API:

```bash
npm run dev:api
```

Customer web:

```bash
npm run dev:web
```

Developer dashboard:

```bash
npm run dev:dashboard
```

## Current dashboard authentication

Milestone 5 intentionally uses a TEST API key entered into the dashboard and stored in browser localStorage.

This is ONLY a development/prototype authentication mechanism.

### Production requirement

Before commercial launch, replace this with:

- merchant email/password or passwordless auth
- secure server-side session cookie
- role-based access:
  - OWNER
  - ADMIN
  - DEVELOPER
  - ANALYST
- no merchant secret key stored in browser localStorage

## API Key creation

Secret keys are returned once.

Database keeps only a one-way `scrypt` hash.

Example:

```text
sk_test_...
sk_live_...
```

## Allowed Origins

Used to validate:

- merchant return URLs
- future production iframe embedding policy
- browser-facing integrations

Store exact origins:

```text
https://shop.example.com
https://www.shop.example.com
```

not arbitrary page URLs.

## Webhook configuration

Merchant can register:

```text
fit.session.created
fit.completed
fit.high_confidence
profile.updated
feedback.received
```

The signing secret is returned once.

Important:
Milestone 5 manages webhook configuration, but the asynchronous delivery worker is still a future milestone.

## Logs

The first log view uses `AnalyticsEvent`.

Future production version should add a separate request log with:

- request_id
- route
- HTTP method
- status
- duration
- environment
- API key id
- response error code
- timestamp

Do not log:
- raw API secrets
- raw hosted session tokens
- unnecessary body measurements
