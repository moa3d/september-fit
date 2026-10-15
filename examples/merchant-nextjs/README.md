# Merchant Next.js integration example

The browser SDK must call a merchant-owned endpoint:

```text
POST /api/september-fit/session
```

That endpoint uses:

```text
SEPTEMBER_FIT_SECRET_KEY=sk_live_...
```

server-side.

The secret key must never be emitted into:
- browser JavaScript
- HTML
- mobile bundles
- `NEXT_PUBLIC_*` environment variables
