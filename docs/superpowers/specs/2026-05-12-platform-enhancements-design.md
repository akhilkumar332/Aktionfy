# Schedule MCP Platform Enhancements Design

## 1. User Experience & Growth (UX/UI)

**Goal:** Lower the barrier to entry for complex workflows while providing power-user tools.

*   **Visual Canvas (Node-Based Workflow Builder):**
    *   **Implementation:** Integrate a library like React Flow in the frontend.
    *   **Features:** Drag-and-drop nodes representing Tasks, Triggers, and Logic Gates. Visual connections showing data flow and dependencies (chaining).
    *   **Backend Changes:** Update the API to accept/return graphical layout coordinates alongside standard task definitions.
*   **Template Library & Custom Configurations:**
    *   **Implementation:** Create a new `templates` table in the database.
    *   **Features:** A catalog of pre-built workflows (e.g., "Daily News Summary", "GitHub Issue Triage"). Users can save their own workflows as custom templates. A wizard interface to instantiate templates by filling in variables (e.g., specific URLs or API keys).

## 2. Core Engine Power (Backend)

**Goal:** Evolve the system from a time-based scheduler into an event-driven, intelligent automation engine.

*   **Inbound Webhook Triggers:**
    *   **Implementation:** Add a `webhook_triggers` table and a dedicated API endpoint (e.g., `/api/v1/webhooks/inbound/{token}`).
    *   **Features:** Allows external services to trigger a task immediately. The webhook payload can be passed into the task's prompt context.
*   **Conditional Logic (Branching):**
    *   **Implementation:** Introduce a new task type: `Logic Node`.
    *   **Features:** Allows workflows to fork based on the output of a parent task. The execution node evaluates the parent's response against defined rules (e.g., JSON parsing or simple regex) to determine the next task in the chain.
*   **Automated Retries & Dead Letter Queue (DLQ):**
    *   **Implementation:** Add retry configuration (`max_retries`, `backoff_strategy`) to the `tasks` table. Create a `dlq_tasks` table.
    *   **Features:** Automatically retry failed executions. If a task exhausts retries, it moves to the DLQ, where users can review the error logs and manually replay it.

## 3. Enterprise & Admin Controls

**Goal:** Provide the necessary oversight, security, and collaboration tools for teams and enterprise deployments.

*   **Team Workspaces & Granular RBAC:**
    *   **Implementation:** Introduce a `workspaces` table. Modify RBAC to check permissions at the workspace level rather than just the user level.
    *   **Features:** Users can invite others to a workspace. Tasks, chains, and secrets belong to workspaces, allowing team collaboration.
*   **System Health & Telemetry Dashboard:**
    *   **Implementation:** Enhance the existing admin dashboard. Use Prometheus/Grafana or expand custom metrics.
    *   **Features:** "God Mode" view for admins showing queue depth, worker node health (heartbeats), and system-wide success/failure rates.
*   **Audit & Compliance Export:**
    *   **Implementation:** Expand the existing `audit_logs` table.
    *   **Features:** Track specifically when the Secret Vault is accessed and by which task/agent. Add UI to export these logs to CSV for compliance review.
