# September Fit — Milestone 12: Production Infrastructure

This milestone adds the first real pilot deployment stack.

## Production domains

- api.septemberfit.com
- fit.septemberfit.com
- dashboard.septemberfit.com

## Stack

Internet -> Caddy -> API / Customer Web / Dashboard

API -> PostgreSQL
API -> Redis
Redis -> shared rate limits + BullMQ webhook jobs

## Redis

Milestone 9 used in-process rate-limit state.

Milestone 12 moves it to Redis so limits survive process restarts and can be shared by multiple API instances later.

## Webhooks

Webhook jobs now use BullMQ + Redis.

The PostgreSQL `WebhookDelivery` row remains the audit record while BullMQ handles execution and retry scheduling.

## TLS

Caddy terminates HTTPS and automatically obtains certificates after DNS points to the production server and ports 80/443 are reachable.

## Production compose

Use:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Production environment

Copy:

```bash
cp .env.production.example .env.production
```

Replace every placeholder.

Never commit `.env.production`.

## PostgreSQL secret

Create:

```text
secrets/postgres_password.txt
```

## Health checks

- https://api.septemberfit.com/v1/health/live
- https://api.septemberfit.com/v1/health/ready

## Backups

Backup:

```bash
sh ops/backup-postgres.sh
```

Restore:

```bash
sh ops/restore-postgres.sh backups/<file>.dump
```

For a real pilot, schedule daily encrypted off-server backups and periodically test restore.

## Structured logs

API HTTP logs use Pino. Production logs are JSON and can later be shipped to Loki, Datadog, Elastic, or another monitoring backend.

## Production boundary

This is a strong single-node pilot stack.

For larger traffic, move toward managed PostgreSQL, managed Redis, multiple API/worker replicas, centralized monitoring, and a managed secret store.

## External decisions still required

The repository cannot independently complete:
- payment provider account
- transactional email provider account
- production server/cloud account
- real DNS records
- monitoring account
- real customer calibration data


## Dashboard session cookie

Production should leave `DASHBOARD_COOKIE_DOMAIN` empty. The session cookie is then host-only for `api.septemberfit.com`, reducing exposure to sibling subdomains while still working with credentialed requests from `dashboard.septemberfit.com`.
