# September Fit — Milestone 10: Commercial SaaS Layer

## Scope

Milestone 10 adds:

- plans
- subscriptions
- trial state
- monthly usage periods
- usage metering
- plan quotas
- quota enforcement
- plan-change requests
- merchant onboarding checklist
- Plan & Usage dashboard

## Important pricing note

The seeded prices are **DRAFT technical defaults**.

They are not a final commercial recommendation.

Seeded defaults:

```text
FREE
STARTER
GROWTH
SCALE
```

Before public launch, validate:
- willingness to pay
- merchant order volume
- return-rate value
- support cost
- infrastructure cost
- competitor positioning

## Plan limits

Each plan can independently limit:

```text
fit calculations
fit sessions
products
webhooks
API keys
team members
retention days
```

`null` means unlimited.

## Metered usage

V1 metered metrics:

```text
FIT_CALCULATION
FIT_SESSION
```

Stored in:

```text
UsageCounter
```

with:

```text
merchant
metric
periodStart
periodEnd
quantity
```

## Quota behavior

Before a new metered operation:

```text
QuotaService.assertMetricAvailable()
```

After a successful operation:

```text
MeteringService.record()
```

If the limit is reached:

```http
HTTP 402
```

Example:

```json
{
  "code": "PLAN_LIMIT_REACHED",
  "plan": "STARTER",
  "metric": "FIT_CALCULATION",
  "used": 1500,
  "limit": 1500,
  "upgrade_required": true
}
```

## Resource quotas

Also enforced for:

```text
products
webhooks
API keys
```

Team-member quota is modeled and ready for the future team-management UI.

## Billing endpoints

Public plan catalog:

```text
GET /v1/plans
```

Dashboard:

```text
GET  /v1/billing/overview
GET  /v1/billing/subscription
GET  /v1/billing/usage

GET  /v1/billing/plan-change-requests
POST /v1/billing/plan-change-requests

GET  /v1/billing/onboarding
POST /v1/billing/onboarding/complete
```

## Provider-agnostic billing

Milestone 10 intentionally does **not** directly activate a paid plan from the browser.

A paid plan request becomes:

```text
PENDING
```

The future payment provider will convert this into:

```text
checkout
→ payment confirmed
→ webhook
→ subscription plan/status update
```

This keeps the September Fit domain model independent from Stripe, Paddle, Mollie, or another provider.

## Dashboard

New sections:

```text
Plan & Usage
Onboarding
```

Plan & Usage shows:
- current plan
- subscription status
- billing period
- Fit calculation usage
- Fit session usage
- products
- webhooks
- API keys
- team members

## Onboarding checklist

Required:

```text
subscription
allowed origin
API key
first product
garment measurements
```

Optional:

```text
first test Fit
```

When required steps are complete:

```text
ready_for_live = true
```

## Seed

The September demo merchant receives:

```text
STARTER
TRIALING
14-day trial
```

No real charge is created.

## Remaining payment work

A real payment provider still needs:

```text
checkout session
payment method
invoice lifecycle
provider webhooks
failed-payment handling
tax/VAT handling
billing portal
refund/cancellation rules
```

Those provider-specific workflows should sit on top of the subscription model created here.

## Migration

```bash
npm run db:generate
npm run db:migrate -- --name commercial_plans_usage
npm run db:seed
```
