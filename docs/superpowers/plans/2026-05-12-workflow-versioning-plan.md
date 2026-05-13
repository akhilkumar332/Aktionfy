# Workflow Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a snapshot and rollback system for tasks, allowing users to safely iterate on prompts and code.

**Architecture:**
1. **Snapshots:** A new `task_versions` table will store the state of a task (prompt, triggers, code) at a specific point in time.
2. **Automatic Versioning:** Every time a user updates a task via the API, a new version is automatically created.
3. **Rollback:** A restore endpoint will replace the current task state with the values from a specific version.

**Tech Stack:** Go (Echo), PostgreSQL (sqlc).

---

### Task 1: Database Migration for Workflow Versioning

**Files:**
- Create: `migrations/014_workflow_versioning.up.sql`
- Create: `migrations/014_workflow_versioning.down.sql`
- Modify: `db/queries.sql`

- [ ] **Step 1: Write migration up script**

```sql
CREATE TABLE task_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL,
    agent_prompt TEXT NOT NULL,
    missed_task_policy TEXT NOT NULL,
    depends_on_task_id UUID,
    requires_approval BOOLEAN NOT NULL,
    trigger_on_completion BOOLEAN NOT NULL,
    task_type TEXT NOT NULL,
    native_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_versions_task_id ON task_versions (task_id);
```

- [ ] **Step 2: Write migration down script**

```sql
DROP TABLE IF EXISTS task_versions;
```

- [ ] **Step 3: Add versioning queries to db/queries.sql**

```sql
-- name: CreateTaskVersion :one
INSERT INTO task_versions (
    task_id, name, trigger_type, trigger_config, agent_prompt, 
    missed_task_policy, depends_on_task_id, requires_approval, 
    trigger_on_completion, task_type, native_code
) 
SELECT 
    id, name, trigger_type, trigger_config, agent_prompt, 
    missed_task_policy, depends_on_task_id, requires_approval, 
    trigger_on_completion, task_type, native_code
FROM tasks WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: ListTaskVersions :many
SELECT * FROM task_versions WHERE task_id = $1 ORDER BY created_at DESC;

-- name: GetTaskVersionByID :one
SELECT * FROM task_versions WHERE id = $1 AND task_id = $2;

-- name: RestoreTaskFromVersion :exec
UPDATE tasks
SET 
    name = v.name,
    trigger_type = v.trigger_type,
    trigger_config = v.trigger_config,
    agent_prompt = v.agent_prompt,
    missed_task_policy = v.missed_task_policy,
    depends_on_task_id = v.depends_on_task_id,
    requires_approval = v.requires_approval,
    trigger_on_completion = v.trigger_on_completion,
    task_type = v.task_type,
    native_code = v.native_code
FROM task_versions v
WHERE tasks.id = $1 AND tasks.user_id = $2 AND v.id = $3 AND v.task_id = $1;
```

- [ ] **Step 4: Run sqlc generate**

Run: `go run github.com/sqlc-dev/sqlc/cmd/sqlc@latest generate`

- [ ] **Step 5: Commit**

```bash
git add migrations/ db/
git commit -m "feat(db): add schema for workflow versioning"
```

---

### Task 2: Backend Logic - Auto-Snapshot and Restore Endpoint

**Files:**
- Modify: `cmd/server/task_rest_handlers.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Update apiUpdateTaskHandler to auto-snapshot**

In `apiUpdateTaskHandler`, *before* applying the update, call `queries.CreateTaskVersion`.

- [ ] **Step 2: Implement Restore Handler**

```go
func apiRestoreTaskVersionHandler(c echo.Context) error {
    userID := getUserID(c)
    taskIDStr := c.Param("id")
    versionIDStr := c.Param("version_id")
    
    var taskID, versionID pgtype.UUID
    if err := parseUUID(taskIDStr, &taskID); err != nil {
        return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
    }
    if err := parseUUID(versionIDStr, &versionID); err != nil {
        return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid version ID"})
    }

    // 1. Create a snapshot of CURRENT state before rolling back (optional but recommended)
    _, _ = queries.CreateTaskVersion(c.Request().Context(), db.CreateTaskVersionParams{
        ID:     taskID,
        UserID: userID,
    })

    // 2. Restore
    err := queries.RestoreTaskFromVersion(c.Request().Context(), db.RestoreTaskFromVersionParams{
        ID:     taskID,
        UserID: userID,
        ID_2:   versionID,
    })
    if err != nil {
        return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Restore failed"})
    }

    return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task restored to version " + versionIDStr})
}
```

- [ ] **Step 3: Implement List Versions Handler**

```go
func apiListTaskVersionsHandler(c echo.Context) error {
    userID := getUserID(c)
    taskIDStr := c.Param("id")
    var taskID pgtype.UUID
    parseUUID(taskIDStr, &taskID)

    // Check ownership first
    exists, _ := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{ID: taskID, UserID: userID})
    if !exists { return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"}) }

    versions, err := queries.ListTaskVersions(c.Request().Context(), taskID)
    if err != nil { return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to list versions"}) }

    return c.JSON(http.StatusOK, APIResponse{Success: true, Data: versions})
}
```

- [ ] **Step 4: Register routes in main.go**

```go
api.GET("/tasks/:id/versions", apiListTaskVersionsHandler)
api.POST("/tasks/:id/restore/:version_id", apiRestoreTaskVersionHandler)
```

- [ ] **Step 5: Commit**

```bash
git add cmd/server/
git commit -m "feat(backend): implement automatic snapshots and restore logic"
```

---

### Task 3: Frontend - Task History and Rollback UI

**Files:**
- Create: `frontend/src/pages/TaskHistory.jsx`
- Modify: `frontend/src/pages/Tasks.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add "History" button to Tasks.jsx**

Add a `History` icon/button next to each task in the list that navigates to `/tasks/:id/history`.

- [ ] **Step 2: Build TaskHistory.jsx**

A page that:
1. Fetches `/api/tasks/:id/versions`.
2. Lists versions in a vertical timeline.
3. Shows differences (or at least the prompt/code of that version).
4. Provides a "Restore" button that calls the restore API.

- [ ] **Step 3: Register route in App.jsx**

Add `/tasks/:id/history` route.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): implement task history and restore UI"
```

---

### Task 4: Verification and Build

- [ ] **Step 1: Run Go Lint and Build**

Run: `go build ./cmd/server`
Expected: Success

- [ ] **Step 2: Run Frontend Build**

Run: `cd frontend && npm run build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: verify workflow versioning implementation"
```
