# September Fit — Milestone 6: Reliability Layer

## Scope

Milestone 6 adds:

- idempotency for merchant mutation requests
- outbound webhook event queue
- encrypted webhook signing secrets
- HMAC-SHA256 webhook signatures
- automatic retry schedule
- webhook delivery history
- webhook emission from key product events

## Important architecture correction

A webhook signing secret cannot be stored only as a one-way hash.

September Fit is the sender and needs the original secret later to sign payloads.

Therefore:

### API keys
Remain one-way hashed.

```text
sk_live_* -> scrypt hash only
```

### Webhook signing secrets
Are encrypted at rest.

```text
whsec_live_* -> AES-256-GCM ciphertext
```

Environment variable:

```env
WEBHOOK_SECRET_MASTER_KEY=<base64 32-byte key>
```

Generate a local value with Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Never commit this key.

## Idempotency

Merchant mutation requests can send:

```http
Idempotency-Key: order-583-fit-session-1
```

The server hashes:

```text
HTTP method
+
request path
+
stable request body
```

Behavior:

### First request
Runs normally and stores response.

### Exact retry
Returns stored response.

### Same key, different request
Returns HTTP 409.

### Same request currently in progress
Returns HTTP 409.

Idempotency records expire after 24 hours.

## Webhook event flow

```text
Fit completed
     |
     v
WebhookEventsService.emit()
     |
     v
WebhookDelivery(PENDING)
     |
     v
WebhookWorker
     |
     +--> sign payload
     |
     +--> HTTP POST merchant endpoint
     |
     +--> 2xx -> DELIVERED
     |
     +--> failure -> retry
```

## Events wired in this milestone

```text
fit.session.created
fit.completed
fit.high_confidence
profile.updated
```

`feedback.received` remains ready in webhook configuration and should be wired when the feedback HTTP flow is completed.

## Signature

Headers:

```text
September-Fit-Event-Id
September-Fit-Timestamp
September-Fit-Signature
```

Signed material:

```text
timestamp + "." + raw_json_body
```

Algorithm:

```text
HMAC-SHA256
```

## Merchant verification example

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

const signed = `${timestamp}.${rawBody}`;

const expected = createHmac("sha256", secret)
  .update(signed)
  .digest("hex");

const valid =
  expected.length === signature.length &&
  timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
```

Also verify timestamp freshness and deduplicate by event ID.

## Retry schedule

```text
attempt 1: immediate
attempt 2: +1 minute
attempt 3: +5 minutes
attempt 4: +30 minutes
attempt 5: +2 hours
attempt 6: +8 hours
```

After the final failed attempt:

```text
status = FAILED
```

## Worker

The MVP worker runs inside the NestJS API process.

Environment:

```env
WEBHOOK_WORKER_INTERVAL_MS=30000
```

This is acceptable for an MVP.

### Production recommendation

Move deliveries to a durable queue such as:

```text
Redis + BullMQ
```

or a managed queue before high volume.

## Delivery history

New endpoint:

```text
GET /v1/developer/webhook-deliveries
```

Returns:

- event type
- destination URL
- status
- attempts
- response code
- next retry
- delivered timestamp

## Database migration

After pulling Milestone 6:

```bash
npm run db:generate
npm run db:migrate -- --name webhook_encrypted_secret
```

## Current limitations

- global idempotency stores successful responses as HTTP 200 metadata internally even if controller semantics would normally be 201
- public hosted routes do not use merchant idempotency because they do not carry a merchant API principal
- worker is in-process, not a durable distributed queue
- production request logging still needs a dedicated table/middleware
