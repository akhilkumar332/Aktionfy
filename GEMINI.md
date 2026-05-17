# Actionfy Engineering Standards & Project Instructions

This document defines the foundational architectural rules, security patterns, and engineering conventions for the Actionfy platform. All future development MUST adhere to these standards.

## 🏛 Architecture Rules

- **Durable Orchestration**: Use the `FOR UPDATE SKIP LOCKED` pattern in PLpgSQL for all task fetching to handle high concurrency across workers without race conditions.
- **Stateless Backend**: The Go server must remain stateless regarding task state; PostgreSQL is the single source of truth. Use Redis Pub/Sub only for real-time signaling.
- **SSE Bridge Stability**: Utilize `http.Flush()` and set explicit `Keep-Alive` headers to prevent connection timeouts. Always use an `isMounted` ref in React components consuming SSE to prevent memory leaks.
- **Trace Continuity**: Background workers (triggered via Redis) must use `context.Background()` for longevity but **MUST** propagate the original OpenTelemetry Trace ID from the message payload.
- **Leaderless Maintenance**: Background tasks like the `Reaper` or `Pruning` process must be designed to run safely on all nodes. Use singleton tables (`system_settings`) to coordinate shared configuration.

## 🔒 Security & Reliability

- **CSRF & Local Development**: To ensure reliability in Docker and across local networks, utilize an `e.Pre` middleware to align the request's internal `r.URL` with the `Origin` header when they match the expected `Host`. 
- **Zero-Trust Data Storage**: Never store raw AI prompts or LLM responses in `JSONB` columns unless strictly structured. Use `TEXT` to prevent silent database insertion failures due to escape characters or invalid JSON syntax.
- **Centralized Quotas**: Task creation quotas MUST be enforced in a shared `CheckUserQuota` helper, utilized by both the MCP Tool handlers and the REST API endpoints to prevent limit bypasses.
- **Strict RBAC**: Every mutation endpoint must explicitly verify resource ownership. Admin endpoints must use the `EchoRequireRole("admin")` middleware and include audit logs for all destructive actions.
- **Self-Demotion Prevention**: Systems managing user roles must include logic to prevent administrators from accidentally removing their own admin status.

## 🤖 Agentic Orchestration Patterns

- **Decision Routing**: Specialized `decision_router` nodes must perform zero-shot LLM classification. Reasoning behind the chosen path MUST be recorded in the `execution_traces` table.
- **Human-in-the-Loop**: Implement a `halted` status with a `needs_routing` approval state for ambiguous AI decisions. The UI must provide a dedicated manual resolution interface.
- **Immutable Versioning**: Any change to a task's prompt or core logic should trigger the creation of a new `task_versions` entry to allow for one-click rollbacks.

## 📜 Conventions

- **Identity**: The brand name is **Actionfy**. Internal identifiers should use `actionfy` (snake_case) or `Actionfy` (PascalCase) consistently.
- **Tool Naming**: Tool names MUST exactly match the industry-standard MCP reference:
  - `create_task`, `list_tasks`, `delete_task`, `pause_task`, `resume_task`.
- **Data Types**: `trigger_config` is stored as JSONB. `input_data` and `output_data` in traces are stored as TEXT.
- **Commits**: Use the **Conventional Commits** specification for all PRs and commits.

## 🛠 Build and Deployment

- **Containerization**: Multi-stage Docker builds targeting a minimal footprint.
- **Production Audit**: Before release, always run the Go **Race Detector** (`go test -race`) and a full **Frontend Production Build** to verify asset integrity.
- **Binary Distribution**: Distributed binaries should be built with `-ldflags="-s -w"` to optimize for size.
