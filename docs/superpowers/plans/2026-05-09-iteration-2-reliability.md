# Iteration 2: Reliability & Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance task execution reliability by refactoring completion logic to the execution node, implementing a recovery reaper, and securing cross-user task dependencies.

**Architecture:** 
1. The scheduler will now only transition tasks to `processing` and delegate completion responsibility to the node receiving the Pub/Sub trigger. 
2. A new "Reaper" background process will recover tasks stuck in `processing` due to worker crashes.
3. Task dependency creation will be validated to prevent cross-user data leakage.

**Tech Stack:** Go, PostgreSQL, Redis, MCP-Go SDK.

---

### Task 1: Refactor Scheduler to Delegate Completion

**Files:**
- Modify: `schedule-mcp/cmd/server/scheduler.go`

- [ ] **Step 1: Update Pub/Sub payload**
Update `runScheduler` to include `trigger_type` and `trigger_config` in the JSON payload.

- [ ] **Step 2: Remove direct completion from scheduler**
In `runScheduler`, after `redisClient.Publish` succeeds, do NOT call `completeTask` or update status. The task should remain in `processing`.

- [ ] **Step 3: Update Missed Task Policy handling**
Ensure tasks that are "missed" (user offline) still use `completeTask` or manual updates since they aren't delivered to an execution node.

### Task 2: Implement Completion Logic in Execution Node

**Files:**
- Modify: `schedule-mcp/cmd/server/session.go`

- [ ] **Step 1: Parse trigger info from payload**
In `MaintainHeartbeat`'s message listener, parse `trigger_type` and `trigger_config` from the JSON payload.

- [ ] **Step 2: Call `completeTask` after Sampling**
After a successful `RequestSampling` (or permanent failure), calculate the next run time using `calculateNextRun` and call `completeTask(ctx, taskID, nextRun)`.

- [ ] **Step 3: Handle one-off tasks**
If `trigger_type` is `date`, set status to `completed` instead of calculating a next run.

### Task 3: Implement Reaper for Stuck Tasks

**Files:**
- Modify: `schedule-mcp/cmd/server/scheduler.go`
- Modify: `schedule-mcp/cmd/server/main.go`

- [ ] **Step 1: Add `runReaper` function**
Add `runReaper(ctx context.Context)` in `scheduler.go`. It should run a ticker every 1 minute and execute:
`UPDATE tasks SET status = 'active', locked_by = NULL WHERE status = 'processing' AND next_run < NOW() - INTERVAL '5 minutes'`.

- [ ] **Step 2: Start Reaper in `main.go`**
Invoke `go runReaper(ctx)` in the `main` function alongside the scheduler.

### Task 4: Fix Cross-User Dependency Vulnerability

**Files:**
- Modify: `schedule-mcp/cmd/server/tools.go`
- Modify: `schedule-mcp/schema.sql`

- [ ] **Step 1: Validate dependency ownership in `create_task`**
In `tools.go`, before inserting, verify `depends_on_task_id` belongs to the same `userID`. Return an error if it doesn't.

- [ ] **Step 2: Update `fn_claim_due_tasks`**
In `schema.sql`, ensure the dependency join also matches `user_id`.
`LEFT JOIN tasks dep ON t.depends_on_task_id = dep.id AND dep.user_id = t.user_id`

### Task 5: Verification & Build

- [ ] **Step 1: Compile the project**
Run `go build ./cmd/server` to ensure no syntax errors.

- [ ] **Step 2: Run existing tests**
Run `go test ./cmd/server/...` to ensure no regressions.
