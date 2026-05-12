# Platform Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement UX improvements (visual canvas, templates), Core Engine power (webhooks, branching, retries, DLQ), and Enterprise controls (workspaces, telemetry, audit logs) into Schedule MCP.

**Architecture:** 
1. Database Migrations (Workspaces, Templates, Webhook Triggers, DLQ Tasks, Tasks updates).
2. Backend Handlers & Scheduler Updates.
3. Frontend Integration (React Flow for Canvas, UI for Workspaces, DLQ, Webhooks, Templates).

**Tech Stack:** Go (Echo), PostgreSQL (sqlc), React, React Flow, TailwindCSS.

---

### Task 1: Database Migrations for Core Engine & Enterprise

**Files:**
- Create: `migrations/011_platform_enhancements.up.sql`
- Create: `migrations/011_platform_enhancements.down.sql`
- Modify: `db/queries.sql`

- [ ] **Step 1: Write migration up script**

```sql
-- Workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    PRIMARY KEY (workspace_id, user_id)
);

-- Templates
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inbound Webhooks
CREATE TABLE webhook_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- DLQ Tasks
CREATE TABLE dlq_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    error_message TEXT,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update Tasks
ALTER TABLE tasks ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN max_retries INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN retry_count INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN backoff_strategy VARCHAR(50) DEFAULT 'linear';
ALTER TABLE tasks ADD COLUMN ui_coordinates JSONB;
```

- [ ] **Step 2: Write migration down script**

```sql
ALTER TABLE tasks DROP COLUMN ui_coordinates;
ALTER TABLE tasks DROP COLUMN backoff_strategy;
ALTER TABLE tasks DROP COLUMN retry_count;
ALTER TABLE tasks DROP COLUMN max_retries;
ALTER TABLE tasks DROP COLUMN workspace_id;

DROP TABLE IF EXISTS dlq_tasks;
DROP TABLE IF EXISTS webhook_triggers;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS workspaces;
```

- [ ] **Step 3: Add corresponding queries to db/queries.sql**

```sql
-- name: CreateWorkspace :one
INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING *;

-- name: GetUserWorkspaces :many
SELECT w.* FROM workspaces w 
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id 
WHERE w.owner_id = $1 OR wm.user_id = $1;

-- name: CreateWebhookTrigger :one
INSERT INTO webhook_triggers (task_id, token) VALUES ($1, $2) RETURNING *;

-- name: GetTaskByWebhookToken :one
SELECT t.* FROM tasks t JOIN webhook_triggers w ON t.id = w.task_id WHERE w.token = $1;

-- name: MoveToDLQ :one
INSERT INTO dlq_tasks (task_id, error_message) VALUES ($1, $2) RETURNING *;

-- name: CreateTemplate :one
INSERT INTO templates (name, description, config, is_public, workspace_id) VALUES ($1, $2, $3, $4, $5) RETURNING *;
```

- [ ] **Step 4: Run sqlc generate to update Go models**

Run: `sqlc generate`

- [ ] **Step 5: Apply migration to local DB**

Run: `./scripts/migrate.sh up`

- [ ] **Step 6: Commit**

```bash
git add migrations/ db/
git commit -m "feat(db): add schema for platform enhancements"
```

---

### Task 2: Core Engine Power - Webhooks & Retries

**Files:**
- Create: `cmd/server/webhook_inbound_handlers.go`
- Modify: `cmd/server/scheduler.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Implement Inbound Webhook Handler**

```go
package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
)

func handleInboundWebhook(c echo.Context) error {
	token := c.Param("token")
	
	// Get task by token
	task, err := dbQueries.GetTaskByWebhookToken(c.Request().Context(), token)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Invalid webhook token"})
	}

	// Trigger the task immediately
	err = redisClient.Publish(c.Request().Context(), "task_claimed", task.ID.String()).Err()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to trigger task"})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "task triggered", "task_id": task.ID.String()})
}
```

- [ ] **Step 2: Register endpoint in main.go**

```go
// In main.go inside the router setup
api := e.Group("/api/v1")
api.POST("/webhooks/inbound/:token", handleInboundWebhook)
```

- [ ] **Step 3: Implement Retry & DLQ Logic in scheduler.go**

```go
// Inside handleClaimedTask or wherever task execution failure is handled
// Pseudo-code implementation structure
func handleTaskFailure(taskID string, errMessage string) {
    // 1. Get Task
    // 2. If retry_count < max_retries, increment retry_count, schedule next run with backoff
    // 3. Else MoveToDLQ(ctx, db.MoveToDLQParams{TaskID: taskID, ErrorMessage: errMessage})
}
```
*(Self-Review note: This requires integrating into the specific worker loop in scheduler.go which is already implemented for MCP)*

- [ ] **Step 4: Commit**

```bash
git add cmd/server/
git commit -m "feat(backend): implement inbound webhooks and dlq structure"
```

---

### Task 3: API Endpoints for Workspaces and Templates

**Files:**
- Create: `cmd/server/workspace_handlers.go`
- Create: `cmd/server/template_handlers.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Implement Workspace endpoints**

```go
package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
	"schedule-mcp/db"
)

func handleGetWorkspaces(c echo.Context) error {
	userID := getUserID(c)
	workspaces, err := dbQueries.GetUserWorkspaces(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch workspaces"})
	}
	return c.JSON(http.StatusOK, workspaces)
}
```

- [ ] **Step 2: Implement Template endpoints**

```go
package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
)

func handleCreateTemplate(c echo.Context) error {
	// Parse request and insert via dbQueries.CreateTemplate
	return c.JSON(http.StatusCreated, map[string]string{"status": "created"})
}
```

- [ ] **Step 3: Register endpoints in main.go**

```go
api.GET("/workspaces", handleGetWorkspaces, authMiddleware)
api.POST("/templates", handleCreateTemplate, authMiddleware)
```

- [ ] **Step 4: Commit**

```bash
git add cmd/server/
git commit -m "feat(backend): add workspaces and templates api endpoints"
```

---

### Task 4: Frontend - Workspaces and Templates UI

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/pages/Workspaces.jsx`
- Create: `frontend/src/pages/Templates.jsx`
- Modify: `frontend/src/components/DashboardLayout.jsx`

- [ ] **Step 1: Add new links to DashboardLayout**

Modify `frontend/src/components/DashboardLayout.jsx` to include navigation for Workspaces and Templates.

- [ ] **Step 2: Build Workspaces.jsx Component**

```jsx
import React, { useEffect, useState } from 'react';

const Workspaces = () => {
    const [workspaces, setWorkspaces] = useState([]);
    
    useEffect(() => {
        fetch('/api/v1/workspaces').then(res => res.json()).then(data => setWorkspaces(data));
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Workspaces</h1>
            {workspaces.map(w => <div key={w.id} className="p-4 border rounded">{w.name}</div>)}
        </div>
    );
};
export default Workspaces;
```

- [ ] **Step 3: Register React Routes**

Modify `frontend/src/App.jsx` to include `/workspaces` and `/templates` routes.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): implement basic workspaces and templates UI"
```

---

### Task 5: Frontend - Visual Canvas (React Flow)

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/pages/WorkflowCanvas.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Install React Flow**

Run: `npm install reactflow --save` inside `frontend/`

- [ ] **Step 2: Create WorkflowCanvas component**

```jsx
import React, { useCallback } from 'react';
import ReactFlow, { addEdge, Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Trigger' } },
  { id: '2', position: { x: 0, y: 100 }, data: { label: 'Task' } },
];
const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

const WorkflowCanvas = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, edges)), [setEdges]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};
export default WorkflowCanvas;
```

- [ ] **Step 3: Register route and link**

Modify `frontend/src/App.jsx` to include the route for `WorkflowCanvas` and link it from `DashboardLayout.jsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): integrate react flow for visual workflow canvas"
```

---

### Task 6: Testing, Linting and Build

**Files:**
- No new files, run commands.

- [ ] **Step 1: Run Go Lint and Build**

Run: `cd ../ && go build ./cmd/server` (inside schedule-mcp dir)
Expected: Success

- [ ] **Step 2: Run Frontend Build**

Run: `cd frontend && npm run build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: verify build and lint after platform enhancements"
```
