# Comprehensive Platform v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the platform into a comprehensive AI Orchestration Engine with data piping, conditional branching, and an interactive visual builder.

**Architecture:** We will implement a Directed Acyclic Graph (DAG) model on top of the existing task scheduler. Data piping will use a template syntax `{{task.ID.output}}` replaced at runtime. Conditional branching will be handled by the scheduler evaluating a JSONB condition against the parent task's output.

**Tech Stack:** Go (Echo), PostgreSQL (pgx, sqlc), React, React Flow.

---

### Task 1: Schema and Database Layer Updates

**Files:**
- Modify: `schedule-mcp/schema.sql`
- Modify: `schedule-mcp/db/queries.sql`
- Run: `sqlc generate` (if applicable)

- [ ] **Step 1: Update schema.sql with new columns**
```sql
ALTER TABLE tasks ADD COLUMN branch_condition JSONB;
ALTER TABLE tasks ADD COLUMN is_bundle_root BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 2: Update queries.sql to include new fields in CreateTask**
```sql
-- name: CreateTask :one
INSERT INTO tasks (
    user_id, name, trigger_type, trigger_config, agent_prompt, 
    missed_task_policy, depends_on_task_id, next_run, requires_approval, 
    encrypted_secrets, trigger_on_completion, workspace_id, task_type, 
    native_code, branch_condition, is_bundle_root
) 
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
RETURNING *;
```

- [ ] **Step 3: Add query to fetch task output for piping**
```sql
-- name: GetTaskOutput :one
SELECT output_data FROM execution_traces 
WHERE task_id = $1 
ORDER BY start_time DESC 
LIMIT 1;
```

- [ ] **Step 4: Run sqlc generate**
Run: `cd schedule-mcp && sqlc generate`

- [ ] **Step 5: Commit changes**
```bash
git add schedule-mcp/schema.sql schedule-mcp/db/queries.sql schedule-mcp/db/queries.sql.go
git commit -m "feat: update schema and queries for platform v3"
```

---

### Task 2: Backend Logic - Data Piping and Branching

**Files:**
- Modify: `schedule-mcp/cmd/server/scheduler.go`
- Modify: `schedule-mcp/cmd/server/tools.go`

- [ ] **Step 1: Implement variable replacement logic in scheduler.go**
Add a function `resolvePromptVariables(ctx, userID, prompt) string`.

- [ ] **Step 2: Update handleClaimedTask to resolve prompt variables**
Before publishing to Redis, call `resolvePromptVariables`.

- [ ] **Step 3: Implement branching evaluation logic**
Add `evaluateBranchCondition(condition, parentOutput) bool`.

- [ ] **Step 4: Update completeTask to respect branching**
Only trigger dependent tasks if `branch_condition` is met.

- [ ] **Step 5: Update create_task tool in tools.go**
Add `branch_condition` and `is_bundle_root` to the tool definition and handler.

- [ ] **Step 6: Write unit tests for branching and piping**
Create `schedule-mcp/cmd/server/orchestration_test.go`.

- [ ] **Step 7: Commit changes**
```bash
git add schedule-mcp/cmd/server/scheduler.go schedule-mcp/cmd/server/tools.go
git commit -m "feat: implement data piping and branching logic"
```

---

### Task 3: Frontend - Task Wizard Enhancements

**Files:**
- Modify: `schedule-mcp/frontend/src/components/TaskWizard.jsx`

- [ ] **Step 1: Add "Logic & Connections" step to the wizard**
Include fields for `depends_on_task_id` (dropdown) and `branch_condition` (JSON editor or simple toggle).

- [ ] **Step 2: Implement "Variable Injector" in the prompt field**
A button that inserts `{{task.SELECTED_ID.output}}` at the cursor position.

- [ ] **Step 3: Update handleSubmit to include new fields**
Ensure `branch_condition` and `depends_on_task_id` are sent to the API.

- [ ] **Step 4: Commit changes**
```bash
git add schedule-mcp/frontend/src/components/TaskWizard.jsx
git commit -m "feat: enhance TaskWizard with logic and piping support"
```

---

### Task 4: Frontend - Workflow Canvas Interactive Mode

**Files:**
- Modify: `schedule-mcp/frontend/src/pages/WorkflowCanvas.jsx`

- [ ] **Step 1: Implement onConnect handler**
When an edge is drawn, call `api/tasks/link` to update `depends_on_task_id` in the backend.

- [ ] **Step 2: Add sidebar editing**
Clicking a node opens a sidebar with the `TaskWizard` in edit mode.

- [ ] **Step 3: Implement Live Pulse**
Use existing SSE events to highlight nodes that are currently `processing`.

- [ ] **Step 4: Commit changes**
```bash
git add schedule-mcp/frontend/src/pages/WorkflowCanvas.jsx
git commit -m "feat: make WorkflowCanvas interactive with sidebar editing"
```

---

### Task 5: Marketplace - Multi-Task Blueprints

**Files:**
- Modify: `schedule-mcp/db/queries.sql`
- Modify: `schedule-mcp/frontend/src/pages/Templates.jsx`

- [ ] **Step 1: Update templates schema to support multiple tasks**
Modify `config` column in `templates` to allow an array of task definitions.

- [ ] **Step 2: Update Templates.jsx to handle bundles**
When "Use Blueprint" is clicked for a bundle, trigger a batch creation flow.

- [ ] **Step 3: Implement Batch Creation API in Go**
Add `POST /api/v1/blueprints/deploy`.

- [ ] **Step 4: Commit changes**
```bash
git add schedule-mcp/db/queries.sql schedule-mcp/frontend/src/pages/Templates.jsx
git commit -m "feat: implement multi-task blueprints in marketplace"
```

---

### Task 6: Final Verification and Cleanup

- [ ] **Step 1: Run all backend tests**
`cd schedule-mcp && go test ./...`

- [ ] **Step 2: Run frontend build**
`cd schedule-mcp/frontend && npm run build`

- [ ] **Step 3: Perform manual end-to-end test**
Create a 2-step pipeline: Task A fetches data, Task B summarizes it if Task A succeeds.

- [ ] **Step 4: Linting check**
`cd schedule-mcp && golangci-lint run` (if available) or `go fmt ./...`.
