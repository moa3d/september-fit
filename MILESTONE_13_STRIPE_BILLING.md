# September Fit — Milestone 13: Stripe Billing

## Goal

Complete the real payment integration layer without coupling the core subscription model to a single provider forever.

Milestone 13 uses Stripe as the first real billing provider.

## Added

- Stripe Checkout
- Stripe Customer creation
- Stripe Billing Portal
- Stripe webhook signature verification
- subscription synchronization
- plan synchronization from Stripe Price IDs
- invoice history
- failed-payment state
- subscription cancellation fallback
- duplicate provider-event protection
- optional Stripe automatic tax
- dashboard checkout / billing-management actions

## Environment

Required:

```env
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_GROWTH="price_..."
STRIPE_PRICE_SCALE="price_..."
```

Optional:

```env
STRIPE_AUTOMATIC_TAX="true"
STRIPE_PORTAL_CONFIGURATION_ID="bpc_..."
```

Do not expose the Stripe secret key or webhook secret to the browser.

## Stripe product setup

Create recurring monthly prices for:

```text
STARTER
GROWTH
SCALE
```

Then place each Stripe Price ID in the corresponding environment variable.

The FREE plan does not require a Stripe Price.

## Checkout

Dashboard endpoint:

```text
POST /v1/billing/checkout
```

Body:

```json
{
  "plan_code": "GROWTH"
}
```

Response:

```json
{
  "provider": "stripe",
  "checkout_session_id": "cs_...",
  "checkout_url": "https://checkout.stripe.com/...",
  "plan_code": "GROWTH"
}
```

The dashboard redirects the merchant to Stripe Checkout.

## Existing paid subscription

If a merchant already has a Stripe subscription, September Fit does not create a second paid subscription.

It directs billing management through:

```text
POST /v1/billing/portal
```

The merchant is redirected to Stripe Customer Portal.

Configure subscription changes, cancellation behavior and payment methods in the Stripe Portal configuration.

## Webhook

Endpoint:

```text
POST /v1/billing/provider/stripe/webhook
```

Configure this URL in Stripe:

```text
https://api.septemberfit.com/v1/billing/provider/stripe/webhook
```

Relevant events:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_succeeded
invoice.payment_failed
```

Stripe signatures are verified using the exact raw HTTP body and:

```env
STRIPE_WEBHOOK_SECRET
```

## Idempotent provider events

Stripe may retry events.

September Fit stores:

```text
provider
providerEventId
eventType
processedAt
errorMessage
```

and processes a completed provider event only once.

## Subscription sync

Stripe subscription status is mapped to September Fit:

```text
trialing    -> TRIALING
active      -> ACTIVE
past_due    -> PAST_DUE
unpaid      -> PAST_DUE
incomplete  -> PAST_DUE
other ended -> CANCELED
```

The active Stripe Price ID is mapped back to a September Fit Plan.

When a subscription reaches the end and Stripe sends:

```text
customer.subscription.deleted
```

the merchant falls back to:

```text
FREE
```

instead of retaining a paid quota without payment.

## Failed payment

`invoice.payment_failed`:

```text
MerchantSubscription.status = PAST_DUE
```

The plan is not immediately destroyed; recovery is handled by Stripe dunning / portal policy.

## Invoices

September Fit stores merchant-visible invoice metadata:

```text
status
currency
amount due
amount paid
hosted invoice URL
invoice PDF URL
period
```

Dashboard/API endpoint:

```text
GET /v1/billing/invoices
```

Stripe remains the authoritative invoice document provider.

## Tax / VAT

If:

```env
STRIPE_AUTOMATIC_TAX="true"
```

Checkout enables Stripe automatic tax and requires billing address collection.

This does not by itself guarantee legal tax compliance.

Before production launch, configure:
- business legal entity
- tax registrations
- invoice requirements
- VAT IDs / reverse-charge behavior where applicable
- Stripe Tax settings or your chosen tax workflow
- accounting/export process

with appropriate professional advice for the jurisdictions in which September Fit sells.

## Raw body

NestJS is now started with:

```ts
{ rawBody: true }
```

so Stripe webhook signatures can be validated safely.

## Production activation checklist

1. Create Stripe account.
2. Complete business verification.
3. Create recurring products/prices.
4. Configure Price IDs in production secrets.
5. Configure Customer Portal.
6. Register webhook endpoint.
7. Copy webhook signing secret.
8. Test with Stripe test mode.
9. Test:
   - checkout success
   - checkout cancel
   - upgrade/change via portal
   - cancellation
   - failed payment
   - webhook retry
   - duplicate event
   - invoice URL
10. Only then switch to live keys.

## Migration

```bash
npm install
npm run db:generate
npm run db:migrate -- --name stripe_billing
npm run db:seed
```
