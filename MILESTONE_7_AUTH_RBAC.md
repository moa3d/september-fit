# September Fit — Milestone 7: Merchant Authentication + RBAC

## Goal

The Developer Dashboard no longer authenticates with:

```text
sk_test_...
sk_live_...
```

Those keys are for merchant-to-API integration only.

The dashboard now uses:

```text
email + password
→ server-side MerchantSession
→ HttpOnly cookie
```

## Login endpoints

```text
POST /v1/auth/login
GET  /v1/auth/me
POST /v1/auth/logout
```

## Session cookie

Name:

```text
september_fit_session
```

Properties:

```text
HttpOnly
SameSite=Lax
Secure in production
7-day expiration
```

The clear session token is stored only in the browser cookie.

Database stores:

```text
SHA-256(session_token)
```

## Password storage

Passwords are stored as:

```text
scrypt$salt$derived_hash
```

The clear password is never stored.

## Roles

### OWNER

Full merchant control:

- overview
- API keys
- origins
- webhooks
- webhook deliveries
- logs

### ADMIN

Operational control:

- overview
- API keys
- origins
- webhooks
- deliveries
- logs

### DEVELOPER

Integration control:

- overview
- API keys
- origins
- webhooks
- deliveries
- logs

### ANALYST

Read-only operational visibility:

- overview
- logs

### STAFF

No Developer Dashboard access in this milestone.

## Important separation

```text
Dashboard login
=
MerchantSession cookie

Store integration
=
sk_live_* API key
```

Never use merchant secret API keys as dashboard login credentials.

## Seed development account

Default local development credentials:

```text
owner@septemberfit.local
ChangeMe123!
```

Override with:

```env
SEED_OWNER_EMAIL=...
SEED_OWNER_PASSWORD=...
```

Do not use default seed credentials in production.

## Dashboard CORS

Development:

```env
DASHBOARD_ORIGINS="http://localhost:3001,http://localhost:3002"
```

Production example:

```env
DASHBOARD_ORIGINS="https://fit.septemberfit.com,https://dashboard.septemberfit.com"
DASHBOARD_COOKIE_DOMAIN=".septemberfit.com"
```

## Database migration

Run:

```bash
npm install
npm run db:generate
npm run db:migrate -- --name merchant_auth_sessions
npm run db:seed
```

## Run

API:

```bash
npm run dev:api
```

Dashboard:

```bash
npm run dev:dashboard
```

Open:

```text
http://localhost:3002
```

## Production improvements still required

Before public production:

- email verification flow
- forgot-password / reset-password flow
- password rate limiting
- login attempt throttling
- optional MFA for OWNER
- session list/revoke-all UI
- user invitations
- role management screen
- CSRF hardening review for state-changing dashboard operations
- dedicated security event log
