# September Fit — Milestone 14 Validation & Hardening Report

## Status

Feature roadmap implementation remains **100% complete for the planned pilot scope**.

Validation status is different: this repository passed the static/runtime checks that can be executed in the current environment, but it is **not yet dependency-resolved production validated** because the npm registry is unreachable from this environment.

A successful online CI run is the remaining build-validation gate.

## Checks that passed here

- Fit Engine TypeScript production compilation: PASS.
- Fit Engine smoke scenario: PASS (`100 / EXCELLENT / HIGH / REGULAR`).
- Browser SDK TypeScript production compilation: PASS.
- Browser SDK Node ESM import smoke test: PASS.
- 143 TypeScript/TSX source files parsed with the TypeScript compiler API: 0 syntax diagnostics.
- 283 relative TypeScript imports checked: 0 unresolved local imports.
- 14 JSON files parsed: PASS.
- `docker-compose.yml`, `docker-compose.prod.yml`, and GitHub Actions CI YAML parsed: PASS.
- Docker Compose named-volume references checked: PASS.
- Prisma schema light structural validation: 29 models, 17 enums, no unknown model field types, no missing reverse relations detected.
- Prisma delegate names referenced by application code were compared with schema models: no unknown delegates.
- Product category allowlist matches the Fit Engine exactly: `JACKET`, `HOODIE`, `SHIRT`, `TSHIRT`, `PANTS`, `JEANS`.
- API `tsc --noResolve` scan produced only dependency/generated-client knock-on diagnostics; no additional diagnostic class was found.

## Dependency/network blocker

Attempts to reach npm (`npm install` / `npm view`) timed out because this execution environment cannot resolve/reach the npm registry.

Therefore these checks still need a networked environment:

```text
npm install
Prisma generate / validate / format
NestJS dependency-resolved build
Next.js customer-web production build
Next.js dashboard production build
Vitest suites through installed dependencies
API E2E suite against PostgreSQL + Redis
Docker image builds
```

The included CI workflow is the intended next gate.

## Material defects found and fixed during Milestone 14

### SDK package runtime

The ESM SDK emitted `export * from "./types"`, which Node/browser ESM package resolution can reject. Source imports/exports now use `.js`, the SDK was rebuilt, and a real ESM import smoke test passes.

The SDK also now:
- opens a blank new tab synchronously before the async session request, avoiding popup blockers;
- validates `postMessage` against the active iframe window in addition to origin/session ID.

### Fit-result response consistency

Fresh calculations and stored/replayed Fit results previously had different response shapes. Stored JSON wrapped `metrics` under an internal `details` envelope, which could break the hosted result UI after refresh or retry.

Stored results are now normalized to the same public structure as fresh results, including:
- metric details;
- coverage;
- confidence score;
- warnings;
- engine version;
- Arabic label.

### Hosted recalculate flow

Editing measurements after a completed hosted calculation previously returned the old Fit result because each session allowed one result. Updating an uncommitted hosted profile now invalidates the prior result so recalculation produces a new result. Recalculation is blocked once post-purchase feedback is linked.

Concurrent duplicate calculations on the same session now recover from the unique-result race by returning the already-created result rather than surfacing a database conflict.

### Category drift

Customer UI had category branches for categories not implemented by the Fit Engine (`COAT`, `SWEATER`, `SHORTS`, `SKIRT`). The API and UI now expose only the six rule-tested V1 categories. Product creation validates the same allowlist, and core garment measurements are required by category.

### Privacy/data minimization

- Hosted customer measurements are stored in merchant-private profiles and are redacted from the merchant profile API.
- Merchant-readable profiles are not overwritten by hosted measurements.
- Height and weight are optional in V1 because the current deterministic rules do not require them.
- Public fit/feedback tokens are redacted from API structured/request logs.
- Token-bearing web pages use `no-referrer` policies.
- Customer-data erasure and retention maintenance are included.

### Webhook reliability

Webhook queueing now leaves a durable PostgreSQL delivery row if Redis enqueue fails. A recovery loop re-enqueues due `PENDING` deliveries. Worker shutdown and Redis shutdown are handled explicitly.

### Idempotency

Idempotency now:
- replays the original HTTP status;
- rejects key reuse with different payloads;
- handles concurrent unique-key races;
- avoids unhandled persistence rejections;
- expires records through maintenance.

### Rate limiting / authentication security

- Redis-backed shared rate limits are used.
- IP ceilings remain in force even when a caller invents API credentials.
- Tokenized hosted flows have per-token limits plus a shared-IP ceiling.
- Dashboard sessions have per-session limits plus an IP ceiling.
- Login and password-reset request limits are tighter.
- CORS preflight is not charged against request quotas.
- Login requests and authenticated unsafe dashboard requests enforce registered dashboard origins.
- TEST API keys are disabled in production by default.

### Billing hardening

- Stripe checkout creation uses a Redis lock to avoid duplicate subscriptions from double clicks/concurrent requests.
- An existing open Checkout Session is reused when possible.
- Paid invoice recovery moves a `PAST_DUE` subscription back to `ACTIVE`.
- terminal/canceled Stripe subscription states fall back to the `FREE` plan.
- Stripe-managed billing periods remain provider-authoritative instead of being silently reset to a calendar month.
- free-plan transitions are immediate only when no active paid provider subscription exists; otherwise the Billing Portal is required.

### Account lifecycle

- V1 enforces one merchant workspace per email at database/application level to avoid ambiguous login identities.
- team quota is rechecked when an invitation is accepted.
- failed invitation/verification email sends clean up unusable tokens/invitations.
- password-reset mail failures stay generic to avoid turning provider errors into an email-enumeration signal.

### Production infrastructure

- local Compose declares both PostgreSQL and Redis persistent volumes correctly;
- customer/dashboard production Next builds receive public API URL at build time;
- customer middleware uses an internal API URL in production;
- API database password is assembled from a Docker secret at runtime;
- readiness checks PostgreSQL and Redis;
- production config is validated at startup;
- demo seed data is disabled by default in production;
- initial pilot DB bootstrap is separated from the long-term migration strategy.

## Deployment gate

Before a real pilot release, the required gate is a green CI run with:

```text
npm install
npm run db:generate
npm run db:push          # ephemeral CI database only
npm run db:seed
npm run test:engine
npm run test:sdk
npm run build:sdk
npm run test:e2e
npm run build            # Fit Engine + API
npm run build:web
npm run build:dashboard
```

For production releases, generate and commit real Prisma migrations; do not use `db push` as the ongoing release migration mechanism.

## External activation still required

Code validation is separate from activation. A real launch still needs:
- production hosting/server account;
- owned DNS domain and records;
- Stripe test/live account, products, price IDs and webhook signing secret;
- transactional email provider;
- monitoring/error tracking;
- production secrets;
- real pilot merchants/customers and fit feedback.
