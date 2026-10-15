# September Fit — Milestone 9: Production Readiness

## Scope

This milestone adds:

- API request logs
- global rate limiting
- login brute-force throttling
- security headers
- liveness/readiness endpoints
- dynamic iframe CSP from merchant allowlist
- basic E2E tests
- CI workflow
- production Dockerfiles

## API request logs

Stored fields:

```text
request_id
merchant_id
api_key_id
dashboard_user_id
auth_kind
method
route
status_code
duration_ms
error_code
ip_hash
user_agent
created_at
```

We deliberately do NOT store:
- API secrets
- raw session tokens
- raw request bodies
- raw body measurements

Dashboard endpoint:

```text
GET /v1/developer/request-logs
```

## Health

Liveness:

```text
GET /v1/health/live
```

Readiness:

```text
GET /v1/health/ready
```

Readiness verifies PostgreSQL.

Load balancers should:
- use `/live` to know the process is alive
- use `/ready` before routing traffic

## Rate limiting

Current MVP implementation is in-memory per API process.

Defaults:

```text
general merchant API:
300/minute/merchant

fit/calculate and fit-sessions:
120/minute/merchant

public APIs:
120/minute/IP
```

Response includes:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
Retry-After
```

### Important production note

For multi-instance production, move rate-limit state to Redis or another shared store.

## Login throttling

15-minute window:

```text
8 failed attempts / email
20 failed attempts / IP
```

Attempts are stored hashed:

```text
emailHash
ipHash
success
timestamp
```

This means no raw IP or login password is stored.

## Security headers

NestJS API uses Helmet.

Customer web sets:
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy`
- dynamic `Content-Security-Policy`

## Dynamic iframe CSP

Previous development builds had a broad frame policy.

Milestone 9 changes this.

The customer Fit page:

```text
/s/:token?embed=1&parent_origin=https://merchant.example
```

checks:

```text
GET /v1/public/fit-sessions/:token/embed-policy
```

against the merchant's `AllowedOrigin`.

If allowed:

```text
frame-ancestors 'self' https://merchant.example
```

If not:

```text
frame-ancestors 'self'
```

This means September Fit cannot be embedded by arbitrary sites.

## E2E tests

Initial E2E coverage:

- API liveness
- unauthenticated Developer Dashboard rejection

Folder:

```text
apps/api/test
```

This is a starting baseline, not complete production coverage.

## CI

Workflow:

```text
.github/workflows/ci.yml
```

It:
1. starts PostgreSQL
2. installs dependencies
3. generates Prisma
4. migrates database
5. seeds
6. tests Fit Engine
7. tests SDK
8. builds API
9. builds customer web
10. builds dashboard

## Docker

Added:

```text
apps/api/Dockerfile
apps/customer-web/Dockerfile
apps/developer-dashboard/Dockerfile
```

## Migration

Run:

```bash
npm install
npm run db:generate
npm run db:migrate -- --name production_readiness_logs
npm run db:seed
```

## Production gaps still remaining

This milestone moves us close to deployment, but these still matter:

- Redis-backed rate limiting
- durable distributed webhook queue
- deeper E2E coverage
- error tracking provider
- metrics dashboard
- backup/restore runbook
- deployment environment + DNS/TLS
- secret manager
- security review
