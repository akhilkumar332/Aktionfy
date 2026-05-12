# Schedule MCP System Audit & Maturity Plan (V5)

## 1. Critical Bug Fixes & Reliability
**Goal:** Harden the existing engine against resource exhaustion and panics.
*   **JS Executor Timeouts:** Wrap the `otto` VM execution in a context with a 5-10 second timeout to prevent infinite loops from locking worker nodes.
*   **Safe Type Assertions:** Audit and replace all direct `.(string)` or `.(*User)` assertions with the safe `getUserID` and `getUserFromEcho` helpers created in V4.
*   **API Validation:** Ensure `handleListPublicTemplates` and other new v1 endpoints have consistent session validation and error reporting.

## 2. Advanced Analytics Implementation
**Goal:** Replace mock data in the Insights dashboard with real system metrics.
*   **P99 Latency Query:** Implement a windowed latency calculation in `db/queries.sql` using PostgreSQL `percentile_cont`.
*   **Success Rate Trends:** Aggregate `execution_traces` over the last 30 days to provide the daily chart data.
*   **Worker Health:** Implement a `worker_heartbeats` table to track "Active Workers" accurately.

## 3. "Next Level" Feature: Workflow Versioning
**Goal:** Allow users to safely experiment with prompts and native code without losing previous working states.
*   **Snapshot System:** Automatically create a record in `task_versions` whenever a task's prompt or code is updated.
*   **Restore Logic:** Add a "Restore" button in the Task Management UI to roll back to a previous version.

## 4. "Next Level" Feature: Workspace Environment Variables
**Goal:** Simplify workflow management by sharing non-secret configuration (e.g., Base URLs, Folder IDs) across all tasks in a workspace.
*   **Env Management:** Add a UI to the Workspace page to manage key-value pairs.
*   **Injection:** Automatically inject these variables into the prompt resolution logic (e.g., `{{env.API_URL}}`).

## 5. Visual Canvas Enhancements (Human-in-the-loop)
**Goal:** Improve the decision-making process for manual approvals.
*   **Approval Comments:** Allow users to add a note/reason when approving or denying a task.
*   **History View:** Show the approval history directly on the Workflow Canvas nodes.
