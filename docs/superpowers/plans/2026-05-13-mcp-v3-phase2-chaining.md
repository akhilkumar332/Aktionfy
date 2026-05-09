# V3 Phase 2: Chaining Engine & Prompt Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Trigger on Completion" logic and the prompt injection system for both chaining context and vault secrets.

**Architecture:** 
1. **Triggering:** Update `completeTask` to immediately trigger dependent tasks flagged with `trigger_on_completion`.
2. **Injection:** Create a `resolvePrompt` utility that performs string replacement for `{{secrets.NAME}}` and injects parent task context.

**Tech Stack:** Go, Redis, PostgreSQL

---

### Task 1: Update Schema for Chaining

**Files:**
- Modify: `db/queries.sql`
- Create: `migrations/006_v3_chaining.sql`

- [ ] **Step 1: Write SQL Migration**

Create `migrations/006_v3_chaining.sql`:
```sql
ALTER TABLE tasks ADD COLUMN trigger_on_completion BOOLEAN DEFAULT FALSE;
```

- [ ] **Step 2: Update Queries**

Update `CreateTask` and `ListUserTasks` in `db/queries.sql` to include `trigger_on_completion`.

Add a query to find dependent tasks:
```sql
-- name: GetDependentTasksToTrigger :many
SELECT * FROM tasks WHERE depends_on_task_id = $1 AND trigger_on_completion = TRUE AND status = 'active';
```

- [ ] **Step 3: Run sqlc**

Run: `sqlc generate`

- [ ] **Step 4: Stage Files (DO NOT COMMIT)**

### Task 2: Implement Prompt Injection Utility

**Files:**
- Create: `cmd/server/prompt_resolver.go`

- [ ] **Step 1: Write resolvePrompt logic**

```go
func resolvePrompt(ctx context.Context, userID string, rawPrompt string, parentTaskID pgtype.UUID) (string, error) {
    resolved := rawPrompt
    
    // 1. Resolve Secrets: {{secrets.NAME}}
    // regex find all matches, fetch from db, decrypt, replace
    
    // 2. Resolve Chaining Context (Existing logic moved here)
    if parentTaskID.Valid {
        // fetch latest log, wrap in "Context from previous task:"
    }
    
    return resolved, nil
}
```

- [ ] **Step 2: Stage Files (DO NOT COMMIT)**

### Task 3: Update Scheduler for Immediate Triggering

**Files:**
- Modify: `cmd/server/scheduler.go`
- Modify: `cmd/server/session.go`

- [ ] **Step 1: Update completeTask in scheduler.go**

In `completeTask`, after updating the status, fetch `GetDependentTasksToTrigger`. For each, publish a `trigger_task:userID` event to Redis.

- [ ] **Step 2: Integrate resolvePrompt in session.go**

In the execution node (session.go), before creating the MCP sampling request, call `resolvePrompt` to prepare the final text.

- [ ] **Step 3: Build and Verify**

Run: `go build ./cmd/server`
Expected: builds successfully.

- [ ] **Step 4: Final Verification and Commit (END OF PHASE 2)**

Run: `git add . && git commit -m "feat(v3): implementation phase 2 - chaining engine and prompt injection"`
