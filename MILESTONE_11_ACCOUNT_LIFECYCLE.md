# September Fit — Milestone 11: Account Lifecycle & Team Management

## Added

### Team management

```text
GET    /v1/team/members
GET    /v1/team/invitations
POST   /v1/team/invitations
DELETE /v1/team/invitations/:id

PATCH  /v1/team/members/:id/role
DELETE /v1/team/members/:id
```

Rules:
- OWNER and ADMIN can invite members.
- OWNER controls role changes.
- OWNER cannot be disabled through the normal team endpoint.
- Users cannot change their own role.
- Users cannot disable themselves.
- Disabling a user immediately revokes their dashboard sessions.

## Team invitations

Invitation token:

```text
inv_<random>
```

Database stores only:

```text
SHA-256(invitation_token)
```

Default expiry:

```text
7 days
```

Public accept endpoint:

```text
POST /v1/auth/accept-invite
```

Dashboard page:

```text
/accept-invite?token=...
```

## Team-member quotas

Team invitations now use the commercial plan quota:

```text
teamMembersLimit
```

A merchant cannot exceed the team size of the current plan.

## Email verification

Authenticated user:

```text
POST /v1/account/send-verification
```

Public confirmation:

```text
POST /v1/auth/verify-email
```

Verification token:
- high entropy
- SHA-256 hash at rest
- 24-hour expiry
- one-time use

## Password reset

Request:

```text
POST /v1/auth/request-password-reset
```

The endpoint always returns a generic accepted response to avoid email enumeration.

Reset:

```text
POST /v1/auth/reset-password
```

Reset token:
- high entropy
- SHA-256 hash at rest
- 1-hour expiry
- one-time use

A successful password reset:

```text
changes password
+
revokes every active dashboard session
```

## Session management

Authenticated endpoints:

```text
GET  /v1/account/sessions
POST /v1/account/sessions/revoke-all
```

This allows users to invalidate old sessions.

## Email provider

Milestone 11 introduces a Mailer abstraction.

Development:

```env
EMAIL_PROVIDER=console
```

Emails are logged to the server console.

Production should plug in an actual provider such as:
- Resend
- Postmark
- Amazon SES
- Brevo
- another supported transactional provider

The domain logic does not depend on one provider.

## Dashboard

New section:

```text
Team
```

OWNER / ADMIN can:
- see members
- invite members
- disable members

OWNER can also change roles.

Public pages added:

```text
/accept-invite
/reset-password
/verify-email
```

## Environment

```env
DASHBOARD_PUBLIC_URL="https://dashboard.septemberfit.com"
EMAIL_PROVIDER="console"
```

## Migration

```bash
npm run db:generate
npm run db:migrate -- --name account_lifecycle_team
npm run db:seed
```

## Still remaining

This milestone closes the account-lifecycle gap.

The remaining major launch work is:
1. real payment provider
2. production deployment / DNS / TLS
3. Redis/shared rate limiting
4. durable distributed queue
5. monitoring / error tracking
6. backup / restore
7. secret manager
8. final security review
9. real Fit feedback calibration
