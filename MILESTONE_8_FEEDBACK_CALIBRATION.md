# September Fit — Milestone 8: Feedback & Calibration

## Goal

Close the loop between:

```text
Fit prediction
→ purchase
→ real wear experience
→ calibration data
```

This milestone does not automatically retrain or alter rules.

It collects clean, structured outcome data first.

## Merchant creates a post-delivery feedback request

```http
POST /v1/feedback-requests
Authorization: Bearer sk_live_...
Idempotency-Key: order-1007-fit-feedback
```

Example:

```json
{
  "session_id": "fit-session-public-id",
  "external_order_id": "ORDER-1007",
  "return_url": "https://shop.example.com/orders/1007"
}
```

Response:

```json
{
  "request_id": "...",
  "feedback_url": "https://fit.septemberfit.com/f/fb_secret_token",
  "status": "CREATED",
  "expires_at": "..."
}
```

Suggested timing:

```text
order delivered
+ 1 to 3 days
→ send feedback link
```

## Public feedback flow

```text
GET  /v1/public/feedback/:token
POST /v1/public/feedback/:token
```

Customer chooses:

```text
TOO_SMALL
PERFECT
TOO_LARGE
```

If not perfect, optionally:

```text
CHEST
SHOULDER
WAIST
HIPS
LENGTH
SLEEVE
THIGH
INSEAM
```

## Customer page

Route:

```text
/f/:token
```

The customer sees:

- product
- previous Fit Score
- previous prediction
- actual fit choices
- problem areas
- optional note
- success state
- return to merchant

## Security / privacy

The merchant analytics receives:

- predicted score
- predicted label
- actual outcome
- problem area
- product/category aggregates

It does not receive raw body measurements from FitProfile.

## Webhook

Completed feedback emits:

```text
feedback.received
```

Payload includes:

```json
{
  "feedback_id": "...",
  "feedback_request_id": "...",
  "session_id": "...",
  "result_id": "...",
  "product_id": "...",
  "external_order_id": "ORDER-1007",
  "predicted_fit_score": 91,
  "predicted_label": "EXCELLENT",
  "overall": "PERFECT",
  "problem_areas": []
}
```

No raw body measurements are included.

## Feedback analytics

Dashboard endpoint:

```text
GET /v1/developer/feedback-analytics
```

Reports:

- total feedback
- PERFECT rate
- TOO_SMALL rate
- TOO_LARGE rate
- problem-area frequency
- category outcome rates
- Fit Score bucket vs PERFECT rate

The important calibration table is:

```text
Fit Score 90–100 → how often PERFECT?
Fit Score 80–89  → how often PERFECT?
Fit Score 70–79  → how often PERFECT?
...
```

This is how the Fit Score starts becoming empirically calibrated.

## Calibration rule

Do not change Fit Engine ranges from a handful of feedback entries.

Recommended process:

1. collect outcomes
2. segment by garment category
3. check sample size
4. inspect bias:
   - too many TOO_SMALL?
   - too many TOO_LARGE?
5. adjust one category/version at a time
6. release a new engine version
7. compare outcome rates

Example:

```text
rules-1.0.0
→ enough jacket feedback
→ tune jacket chest ease
→ rules-1.1.0
```

Never silently mutate old results.

## Database additions

New:

```text
FeedbackRequest
FeedbackRequestStatus
FitFeedback.feedbackRequestId
```

Feedback request tokens:
- high entropy
- only SHA-256 hash stored
- 30-day expiry
- one completed feedback per request

## Migration

```bash
npm run db:generate
npm run db:migrate -- --name feedback_requests
```

## Important schema consolidation

This milestone also consolidates the Merchant Authentication schema fields from Milestone 7:

```text
passwordHash
emailVerifiedAt
disabledAt
lastLoginAt
MerchantSession relations
```

Run the migration before starting the updated API.
