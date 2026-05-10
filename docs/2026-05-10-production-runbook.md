# Production Runbook

Date: 2026-05-10

## Required Environment Variables

- `DATABASE_URL`
- `REDIS_URL`
- `BASE_URL`
- `CSRF_KEY`
- `ENCRYPTION_KEY`

Optional:

- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `SENDGRID_API_KEY`
- `STORE_LLM_RESPONSES`
- `MAX_LLM_RESPONSE_CHARS`

## Startup Rules

- Production mode is `ENV=production` with `LOCAL_DEV=false`.
- Production startup fails if required security settings are missing or invalid.
- If any Stripe setting is supplied in production, all Stripe settings must be supplied.

## Backups

Minimum recommendation:

1. Daily PostgreSQL logical backup.
2. Retain at least 7 daily backups and 4 weekly backups.
3. Verify restore into a non-production environment regularly.

Redis is used for coordination and rate limiting, not long-term system-of-record storage.

## Restore Drill

1. Restore PostgreSQL to a clean environment.
2. Point application at restored `DATABASE_URL`.
3. Verify:
   - `/api/healthz`
   - admin audit logs endpoint
   - dashboard login
   - task listing
4. Confirm scheduler can claim and run a test task.

## Audit and Privacy

- Audit records are stored in `audit_logs`.
- Task outputs are sanitized before storage.
- Set `STORE_LLM_RESPONSES=false` to omit LLM output persistence entirely.
- Use `MAX_LLM_RESPONSE_CHARS` to cap stored response size.
