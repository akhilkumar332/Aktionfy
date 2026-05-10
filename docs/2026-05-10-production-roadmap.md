# Production Roadmap

Date: 2026-05-10

This roadmap translates the current repo state into a practical 30/60/90-day path toward production and enterprise readiness.

## 30 Days

Goal: make the system safe to run for real users.

1. Enforce startup-time production validation.
   - Require valid `ENCRYPTION_KEY`, `CSRF_KEY`, `DATABASE_URL`, `REDIS_URL`, and `BASE_URL` in production.
   - Remove insecure production fallbacks.

2. Replace ad hoc boot-time migrations with tracked migrations.
   - Introduce a `schema_migrations` table.
   - Apply migrations exactly once and fail fast on migration errors.
   - Preserve compatibility with already-initialized databases.

3. Add CI verification gates.
   - `go test ./...`
   - `go vet ./...`
   - frontend build and lint
   - container build

4. Expand test coverage for critical backend flows.
   - due-task claiming
   - worker crash recovery
   - approval pause/resume
   - billing webhook tier upgrades
   - secret resolution
   - session auth and RBAC

5. Clean deployment defaults.
   - remove dev/prod mixed envs
   - move secrets to external configuration only
   - document required environment variables

6. Improve operational logging.
   - request IDs
   - structured fields for `task_id`, `user_id`, `worker_id`, `execution_id`

## 60 Days

Goal: improve reliability and operability.

1. Harden scheduler durability.
   - per-task retry policy
   - per-task timeout policy
   - better stuck-task recovery visibility
   - explicit dead-letter handling in UI

2. Expand observability.
   - queue depth
   - claim latency
   - execution latency
   - success/failure/missed counters by tenant
   - dependency health metrics and alerts

3. Add retention and redaction controls.
   - configurable response retention
   - prompt/response redaction
   - disable-response-persistence mode

4. Formalize backup and restore.
   - documented restore path
   - restore drill procedure
   - recovery objectives

5. Improve operational UX in the dashboard.
   - failed schedules
   - quarantined tasks
   - approval backlog
   - next-run drift and worker health indicators

6. Automate release workflow.
   - versioning
   - artifacts
   - signed releases
   - post-release verification

## 90 Days

Goal: move from production-capable to early enterprise readiness.

1. Add org/workspace tenancy.
2. Add enterprise auth.
   - OIDC first
   - SAML and SCIM next
3. Add audit trails.
   - admin changes
   - secret changes
   - approval actions
   - billing events
4. Upgrade secret handling.
   - KMS or managed secret backend integration
5. Add a real deployment target.
   - Helm or Terraform
   - TLS and ingress guidance
   - managed Postgres and Redis guidance
6. Expand platform surface.
   - webhook triggers
   - outbound webhooks
   - templates
   - import/export
   - integration connectors
   - usage APIs

## Recommended Execution Order

1. Production validation
2. Migration tracking
3. Critical-path tests
4. Observability and alerts
5. Backup/restore discipline
6. Org, SSO, and audit features

## Implementation Status

- [x] Roadmap captured in repo
- [x] Phase 1: production validation
- [x] Phase 1: migration tracking
- [x] Phase 1: critical-path tests
- [ ] Phase 2: reliability and observability upgrades
- [ ] Phase 3: enterprise platform upgrades
