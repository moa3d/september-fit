# September Fit Backend MVP

أول Backend قابل للتشغيل لـSeptember Fit كخدمة SaaS مستقلة.

## المنجز في هذه المرحلة

- NestJS API
- PostgreSQL + Prisma
- Merchant isolation
- API Key Guard + scopes
- تخزين مفاتيح API كـ one-way `scrypt` hash
- Fit Engine V1 كحزمة مستقلة
- endpoint فعلي `POST /v1/fit/calculate`
- إنشاء FitSession داخليًا عند الحاجة
- حفظ `FitResult` في PostgreSQL
- تسجيل `fit.calculated` داخل AnalyticsEvent
- Demo seed جاهز

## التشغيل

### 1) PostgreSQL

```bash
docker compose up -d
```

### 2) Environment

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

### 3) Install

```bash
npm install
```

### 4) Prisma

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

الـseed يطبع لك:

```text
Product public id: ...
Profile public id: ...
TEST API KEY: sk_test_...
```

### 5) Start

```bash
npm run dev:api
```

Health:

```text
GET http://localhost:3000/v1/health
```

## تجربة Fit API

```bash
curl -X POST http://localhost:3000/v1/fit/calculate \
  -H "Authorization: Bearer YOUR_SK_TEST_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "PRODUCT_PUBLIC_ID",
    "profile_id": "PROFILE_PUBLIC_ID"
  }'
```

شكل النتيجة:

```json
{
  "id": "result-id",
  "session_id": "session-id",
  "product_id": "product-id",
  "profile_id": "profile-id",
  "fit_score": 100,
  "label": "EXCELLENT",
  "label_ar": "مناسبة لك جدًا",
  "confidence": "HIGH",
  "confidence_score": 100,
  "predicted_fit": "REGULAR",
  "engine_version": "rules-1.0.0",
  "coverage": 1,
  "details": {},
  "warnings": []
}
```

## الأمان الموجود فعليًا

- كل Product/Profile query مربوط بـ `merchantId` المستخرج من API Key.
- مفتاح API الخام لا يُخزن في DB.
- `POST /fit/calculate` يتطلب scope `fit:calculate`.
- جلسة Fit الداخلية تستخدم random token ثم تخزن SHA-256 منه فقط.

## ما لم ننفذه بعد

الـSchema يحوي Webhooks وIdempotency، لكن middleware/dispatcher لم يتم ربطهما بعد.

## الخطوة التالية

- Product API
- Profile API
- Hosted Fit Sessions API
- Idempotency middleware
- Webhook HMAC dispatcher
- ثم `fit.septemberfit.com`

---

## Milestone 2 — Hosted Fit Integration

This build additionally includes:

```text
POST /v1/products
GET  /v1/products/:productId
PUT  /v1/products/:productId/measurements

POST  /v1/profiles
GET   /v1/profiles/:profileId
PATCH /v1/profiles/:profileId

POST /v1/fit-sessions
GET  /v1/fit-sessions/:sessionId

GET  /v1/public/fit-sessions/:token
POST /v1/public/fit-sessions/:token/profile
POST /v1/public/fit-sessions/:token/calculate
```

See `MILESTONE_2.md` for the complete hosted-flow contract.

---

## Milestone 3 — Independent Customer Web

The monorepo now also contains:

```text
apps/customer-web
```

Start it:

```bash
npm run dev:web
```

Hosted customer route:

```text
http://localhost:3001/s/:token
```

See `MILESTONE_3.md` for the complete customer-flow instructions.

---

## Milestone 4 — Browser SDK

The monorepo now contains:

```text
packages/sdk-js
```

Usage:

```ts
SeptemberFit.init({
  sessionEndpoint: "/api/september-fit/session",
  fitOrigin: "https://fit.septemberfit.com",
});

await SeptemberFit.open({
  productId: "SEP-0491",
});
```

The SDK never contains a September Fit secret key.

See:

```text
MILESTONE_4_SDK.md
```

---

## Milestone 5 — Developer Dashboard

New app:

```text
apps/developer-dashboard
```

Run:

```bash
npm run dev:dashboard
```

Local:

```text
http://localhost:3002
```

Current project estimate:

```text
68 / 100
```

See:
- `MILESTONE_5_DEVELOPER_DASHBOARD.md`
- `PROJECT_PROGRESS.md`

---

## Milestone 6 — Reliability

Added:

```text
Idempotency
Encrypted webhook secrets
HMAC-SHA256 signing
Webhook delivery worker
Retry schedule
Delivery history
```

Current project estimate:

```text
76 / 100
```

See:

```text
MILESTONE_6_RELIABILITY.md
PROJECT_PROGRESS.md
```

---

## Milestone 7 — Merchant Authentication + RBAC

The Developer Dashboard now uses:

```text
email + password
→ HttpOnly MerchantSession cookie
```

instead of entering an API key in the browser.

Roles:

```text
OWNER
ADMIN
DEVELOPER
ANALYST
```

Current project estimate:

```text
82 / 100
```

See:

```text
MILESTONE_7_AUTH_RBAC.md
PROJECT_PROGRESS.md
```

---

## Milestone 8 — Feedback & Calibration

Added:

```text
POST /v1/feedback-requests
GET  /v1/feedback-requests/:id

GET  /v1/public/feedback/:token
POST /v1/public/feedback/:token

GET /v1/developer/feedback-analytics
```

Customer feedback route:

```text
http://localhost:3001/f/:token
```

Current project estimate:

```text
87 / 100
```

See:

```text
MILESTONE_8_FEEDBACK_CALIBRATION.md
PROJECT_PROGRESS.md
```

---

## Milestone 9 — Production Readiness

Added:

```text
Request logs
Rate limiting
Login throttling
Helmet/security headers
Dynamic iframe CSP
Health / readiness
E2E test baseline
GitHub Actions CI
Dockerfiles
```

Current project estimate:

```text
93 / 100
```

See:

```text
MILESTONE_9_PRODUCTION_READINESS.md
PROJECT_PROGRESS.md
```

---

## Milestone 10 — Commercial SaaS

Added:

```text
Plans
Subscriptions
Trials
Usage metering
Quotas
Quota enforcement
Plan-change requests
Onboarding checklist
Plan & Usage dashboard
```

Current product implementation estimate:

```text
96 / 100
```

This percentage is implementation progress, **not Fit prediction accuracy**.

See:

```text
MILESTONE_10_COMMERCIAL_SAAS.md
PROJECT_PROGRESS.md
```

---

## Milestone 11 — Account Lifecycle & Team

Added:

```text
Team invitations
Team roles
Member disable + session revocation
Email verification
Password reset
Session management
Mailer abstraction
```

Current product implementation estimate:

```text
98 / 100
```

See:

```text
MILESTONE_11_ACCOUNT_LIFECYCLE.md
PROJECT_PROGRESS.md
```

---

## Milestone 12 — Production Infrastructure

Added:
- Redis-backed rate limiting
- BullMQ webhook queue
- structured logging
- production Docker Compose
- Caddy reverse proxy and TLS
- backup/restore scripts
- production secret separation

Current repository implementation estimate: 99 / 100

See `MILESTONE_12_PRODUCTION_INFRA.md`.

---

## Milestone 13 — Stripe Billing

Added:

```text
Stripe Checkout
Stripe Customer Portal
Stripe webhook verification
Subscription synchronization
Failed-payment state
Cancellation fallback to FREE
Invoice metadata/history
Optional automatic tax
```

Repository implementation estimate:

```text
100 / 100
```

This is repository implementation completion, not Fit prediction accuracy or market validation.

See:

```text
MILESTONE_13_STRIPE_BILLING.md
PROJECT_PROGRESS.md
```

---

## Milestone 14 — Validation & Hardening

The feature roadmap is complete, but Milestone 14 separates **feature completion** from **build validation**. Several security/integration issues were corrected.

The current environment could not reach the npm registry, so the final dependency-resolved CI build remains the launch gate.

See `MILESTONE_14_VALIDATION_HARDENING.md`.


