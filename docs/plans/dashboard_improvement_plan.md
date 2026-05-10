# Dashboard Improvement Plan

## 1. Objective
Enhance the existing React-based User and Admin dashboards to fully expose the underlying database schema and backend capabilities, improving user experience, observability, and administrative control.

## 2. Key Files & Context
- **User Dashboard Components:** `Dashboard.jsx`, `Monitor.jsx`, `Vault.jsx`
- **Admin Dashboard Components:** `AdminUsers.jsx`, `AdminSEO.jsx`
- **Backend Schema:** `schema.sql` (Tables: `tasks`, `audit_logs`, `outbound_webhooks`, `task_logs`)

## 3. Proposed Additions (New Pages)

### 3.1 User: Task Management Interface (`Tasks.jsx`)
**Motivation:** Currently, users can only manage tasks via the MCP client interface (the LLM). While this fits the "MCP-first" architecture, users need a GUI to view, verify, and manually intervene in their schedules.
**Features:**
- A data grid listing all tasks (`name`, `status`, `next_run`, `trigger_type`, `failure_count`).
- Actions: Pause, Resume, Delete tasks.
- Visual representation of task chains (`depends_on_task_id`).
- Quick-edit for `agent_prompt` and `missed_task_policy`.

### 3.2 User: Outbound Webhooks Management (`Webhooks.jsx`)
**Motivation:** The `outbound_webhooks` and `webhook_deliveries` tables exist in the schema, but there is no GUI for users to register their receiving endpoints.
**Features:**
- Form to add new webhook URLs and select `event_types` (e.g., `task_success`, `task_failure`).
- List of registered webhooks with active/inactive toggles.
- View recent `webhook_deliveries` (success/fail status codes) to debug integration issues.

### 3.3 Admin: Audit Logs Interface (`AdminAudit.jsx`)
**Motivation:** The system captures administrative and security events in `audit_logs`, but admins cannot view them without raw database access.
**Features:**
- Real-time tabular view of system-wide audit events.
- Filtering by `action`, `resource_type`, and date ranges.

### 3.4 Admin: System Health Overview (`AdminSystem.jsx`)
**Motivation:** Provide high-level observability over the schedule-mcp infrastructure.
**Features:**
- Real uptime metrics (replacing the hardcoded 99.99% in the user dashboard).
- Global task execution error rates.
- Orphaned or stuck task detection (tasks locked for too long).

## 4. Improvements to Existing Dashboards

### 4.1 User Dashboard (`Dashboard.jsx`)
- **Dynamic Links:** Make the "Active Streams" (Task Count) clickable, routing the user to the new `Tasks.jsx` page.
- **Accurate Uptime:** Replace the hardcoded `99.99%` uptime metric with real data derived from `task_logs` (success vs. failure ratios) or an actual system health endpoint.
- **Approval Context:** Enhance the Pending Approvals cards to show a brief snippet of the `agent_prompt` so the user knows exactly what they are approving.

### 4.2 Monitor (`Monitor.jsx`)
- **Filtering & Search:** Add a search bar to filter logs by `task_name` and dropdowns to filter by `status` (success, failure, missed).
- **Pagination:** Implement frontend or backend pagination. Currently, it attempts to render all fetched logs, which will cause performance degradation as the `task_logs` table grows.
- **Log Detail Expansion:** Allow rows to be clicked to expand and show the full `llm_response` and `error_message` with syntax highlighting, rather than truncating it in the table cell.

### 4.3 Admin Users (`AdminUsers.jsx`)
- **Data Scalability:** Introduce table pagination and a real backend search (currently it relies on a frontend filter or fetches all users).
- **Session Management:** Add a "Revoke Sessions" action that drops a user's active API keys and SSE sessions in emergencies.
- **Sorting:** Allow sorting by `Tier`, `Role`, and `Created At`.

## 5. Implementation Phases
- **Phase 1:** Build the `Tasks.jsx` page for users. This is the highest-value missing feature for the core user experience.
- **Phase 2:** Build the `Webhooks.jsx` page and Admin Audit interface.
- **Phase 3:** Refactor existing components (`Monitor.jsx`, `AdminUsers.jsx`, `Dashboard.jsx`) to add filtering, pagination, and real data bindings for hardcoded values.