# Phase 4 Implementation Plan: Reliability & UI/UX Hardening

This document defines the phases for the Phase 4 reliability and user experience improvements of the Aktionfy platform.

## Implementation Phases

### Phase 1: Silent SSE Reconnects
*   **Goal:** Improve user experience by suppressing repetitive "connection interrupted" notification toasts on transient link disruptions.
*   **Location:** `frontend/src/hooks/useSSE.js`
*   **Action:** Change the `onerror` callback of `EventSource` to output warnings to the developer console rather than triggering visual warning toasts. Let the visual link indicators in the sidebar handle connection state status silently.

### Phase 2: Dynamic Trend Colors
*   **Goal:** Correct metric visualization accuracy on the insights dashboard.
*   **Location:** `frontend/src/pages/Insights.jsx`
*   **Action:** Modify the `MetricCard` trend parameter rendering. Dynamically assign green styling for positive values (prefixed with `+` or equal to `NEW`), red styling for negative values (prefixed with `-`), and neutral gray styling for stable or empty states, replacing the hardcoded green class.

### Phase 3: Fail-Open Rate Limiting
*   **Goal:** Prevent complete API outages during transient Redis infrastructure disruptions.
*   **Location:** `cmd/server/ratelimit.go`
*   **Action:** Modify the rate limiter's `Allow` checks. If Redis is down, uninitialized, or the Lua token-bucket check script times out, log a warning and return `true` to let the requests proceed ("fail-open"). Actual limit exhaustion will still fail closed.

### Phase 4: Trace ID Propagation in Webhooks
*   **Goal:** Maintain trace context continuity across async background processes.
*   **Location:** `cmd/server/webhooks.go`
*   **Action:** Ensure the webhook delivery worker receives and propagates the OTel span context (trace ID) into its background context (`deliverCtx`) when dispatching events.

### Phase 5: System Settings Extended Admin API & UI
*   **Goal:** Add dynamic control over core background and engine parameters.
*   **Locations:** `cmd/server/api_handlers.go`, `frontend/src/pages/AdminSettings.jsx`
*   **Action:** Extend settings schema and Admin settings page to configure `js_timeout_ms` (Sandbox JS execution timeout), `reaper_stuck_threshold_minutes` (Stuck task lease time), and `scheduler_poll_interval_seconds` (Scheduler poll interval). Update backend queries to store/load these from the `system_settings` table.

### Phase 6: Frontend Route Lazy Loading
*   **Goal:** Eliminate frontend build chunk size warnings and speed up initial page load.
*   **Location:** `frontend/src/App.jsx`
*   **Action:** Use `React.lazy` and `Suspense` with a custom loader for dashboard and user pages, splitting the main JS bundle into optimized chunk sizes.

### Phase 7: Merge Existing Task State for PATCH Updates (Edge Case Bug Fix)
*   **Goal:** Prevent database corruption or constraint violations when updating task coordinates, prompts, or partial fields via `PATCH /api/v1/tasks/:id`.
*   **Location:** `cmd/server/task_rest_handlers.go`
*   **Action:** Convert the fields in `UpdateTaskRequest` to Go pointers so we can distinguish between absent fields (nil) and explicitly provided empty values. Query the existing task configuration first, and merge the incoming patch parameters onto it before running the UPDATE query.
