# Phase 3: Live Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real-time updates in the frontend using SSE and Redis Pub/Sub, including live task status, execution logs, and interactive approval prompts.

**Architecture:** 
1. **Backend:** Update the scheduler and handlers to call `PublishEvent` on relevant state changes.
2. **Frontend:** Create a `useSSE` hook to listen for events from the `/sse` endpoint and dispatch them to the UI.
3. **UI:** Update `Dashboard.jsx` and `Monitor.jsx` to respond to these events.

**Tech Stack:** Go, Redis, React, Server-Sent Events (SSE), Lucide React, Framer Motion

---

### Task 1: Emit Redis Events from Backend

**Files:**
- Modify: `cmd/server/scheduler.go`
- Modify: `cmd/server/api_handlers.go`

- [ ] **Step 1: Emit event on task execution**

In `cmd/server/scheduler.go`, after a task is executed (successfully or failed), call `PublishEvent`.

```go
PublishEvent(ctx, PubSubEvent{
    UserID:    t.UserID,
    EventType: "task_executed",
    Payload:   fmt.Sprintf(`{"task_id":"%s", "status":"%s", "execution_time":"%s"}`, t.ID, status, time.Now().Format(time.RFC3339)),
})
```

- [ ] **Step 2: Emit event on task status change**

In `cmd/server/api_handlers.go` (if we have status change endpoints like pause/resume), call `PublishEvent`.

- [ ] **Step 3: Build and Verify**

Run: `go build -o server_bin ./cmd/server`
Expected: builds successfully.

### Task 2: Implement SSE Hook and Event System

**Files:**
- Create: `frontend/src/hooks/useSSE.js`

- [ ] **Step 1: Write useSSE hook**

```javascript
import { useEffect } from 'react';

export const useSSE = (onEvent) => {
  useEffect(() => {
    const eventSource = new EventSource('/sse', { withCredentials: true });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error', err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, [onEvent]);
};
```

### Task 3: Live Status Updates in Dashboard

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Integrate useSSE**

Listen for `task_status_changed` and `task_executed` events to increment/decrement `taskCount` or show toast notifications.

- [ ] **Step 2: Add Toast Notifications**

Use a simple state-based toast or a library if already present to show "Task X executed successfully".

### Task 4: Live Log Updates in Monitor

**Files:**
- Modify: `frontend/src/pages/Monitor.jsx`

- [ ] **Step 1: Integrate useSSE**

Listen for `task_executed` events and prepend the new log entry to the `logs` state immediately.

```javascript
useSSE((event) => {
  if (event.event_type === 'task_executed') {
    const newLog = JSON.parse(event.payload);
    setLogs(prev => [newLog, ...prev]);
  }
});
```

### Task 5: Approval Prompt UI

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Listen for approval_required events**

When a task pauses for approval, emit `approval_required`. The frontend shows a modal or card to Approve/Deny.

- [ ] **Step 2: Implement Approval API call**

Add a handler for the Approve/Deny button that calls a new endpoint (e.g., `POST /api/tasks/:id/approve`).

- [ ] **Step 3: Final Verification and Commit (END OF PHASE 3)**

Build frontend: `npm run build` (if applicable)
Run: `git add . && git commit -m "feat: phase 3 live dashboards with SSE and Redis Pub/Sub"`
