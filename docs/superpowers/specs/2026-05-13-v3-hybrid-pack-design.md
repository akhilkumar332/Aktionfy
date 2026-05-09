# Scheduled Actions MCP Server - V3 Hybrid Pack Design

## Goal
Implement advanced AI orchestration capabilities via **Contextual Chaining** and enhance enterprise security with a **Global Secret Vault**.

## Feature 1: Contextual Chaining (Workflow Pipelines)
Enable tasks to be linked together so that the completion of one task automatically triggers the next.

### Mechanism
*   **Triggering:** When a task completes successfully, the server checks for any tasks that `depend_on` it.
*   **Execution:** Instead of waiting for their next scheduled time, these dependent tasks are moved to the front of the execution queue (or triggered immediately via Pub/Sub).
*   **Conditional Chaining (Advanced):** Allow the user to define a regex or "keyword" that must be present in the parent task's output for the child task to trigger.
*   **Data Flow:** The LLM response from the parent task is automatically injected into the child task's context (e.g., as a system message or variable).

## Feature 2: Global Secret Vault (Encrypted Credential Management)
A centralized system for users to store and reuse sensitive API keys across multiple tasks.

### Mechanism
*   **Storage:** A new `user_secrets` table storing encrypted key-value pairs (AES-256-GCM).
*   **Usage:** Users reference secrets in their task prompts using double-curly syntax: `Summarize my emails using {{secrets.GMAIL_TOKEN}}`.
*   **Injection:** During task execution, the worker retrieves the encrypted secret, decrypts it in-memory, and performs a string replacement in the prompt before sending it to the LLM.
*   **Management:** A dedicated "Vault" tab in the User Dashboard for creating, updating, and deleting secrets (secrets are never shown in plain text after creation).

## Architecture Changes
*   **Database:**
    *   `tasks`: Add `trigger_on_completion` (boolean) and `trigger_condition` (text/regex).
    *   `user_secrets`: New table with `id`, `user_id`, `name`, `encrypted_value`, and `created_at`.
*   **Backend:**
    *   `scheduler.go`: Update `completeTask` logic to scan for and trigger dependent tasks.
    *   `crypto.go`: Reuse AES-256 utilities for the secret vault.
    *   `tools.go`: Add `create_secret` and `delete_secret` MCP tools.
*   **Frontend:**
    *   **Vault Page:** New UI for secret management.
    *   **Task Editor:** Update UI to support linking tasks and selecting "Trigger on Completion".

## Success Criteria
1.  A user can create Task A and Task B, where Task B runs only after Task A finishes and uses Task A's output.
2.  A user can store a "GITHUB_TOKEN" once and use it in multiple scheduled tasks without re-entering it.
3.  Secrets are encrypted at rest and never exposed in logs or UI.
