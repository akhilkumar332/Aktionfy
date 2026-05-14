# Design Spec: Scheduled Actions MCP v3 - The "Durable AI Engine"

**Date:** 2026-05-14  
**Status:** Draft  
**Topic:** Orchestration, Visual Building, and Blueprint Marketplace

## 1. Overview
The goal of version 3 is to transition Scheduled Actions MCP from a simple "fire-and-forget" scheduler into a comprehensive **AI Orchestration Engine**. This involves moving from isolated tasks to interconnected "Workflows" that support data piping, conditional logic, and visual management.

## 2. Architecture & Backend (Pillar 1)

### 2.1 Graph Execution Engine
The current `depends_on_task_id` is a simple link. We will upgrade this to a Directed Acyclic Graph (DAG) model.

*   **Data Piping:** Tasks will support a template syntax (e.g., `{{task.TASK_ID.output}}`) in their `agent_prompt`. 
*   **Execution Context:** The `execution_traces` table will be enhanced to store `output_data` (the LLM's response or tool output) in a structured JSONB format.
*   **Logical Branching:** 
    *   Add `branch_condition` (JSONB) to the `tasks` table.
    *   Example: `{"if": "contains", "value": "CRITICAL", "action": "trigger"}`.
    *   The scheduler (`scheduler.go`) will evaluate this condition before firing a dependent task.

### 2.2 Schema Updates
*   `tasks`: Add `branch_condition` (JSONB) and `is_bundle_root` (BOOLEAN).
*   `execution_traces`: Ensure `output_data` captures full LLM responses for piping.

## 3. Visual Building & Task Wizard (Pillar 2)

### 3.1 The Hybrid Workflow UI
The Task Wizard remains the primary method for creation, while the Canvas becomes the "Studio."

*   **Task Wizard (Primary):**
    *   New "Step" in the wizard for "Logic & Connections."
    *   Allows selecting a parent task and choosing "Pipe Output" (injecting `{{task.id.output}}` into the prompt).
*   **Workflow Canvas (Studio):**
    *   **Interactive Links:** Dragging an edge between nodes updates `depends_on_task_id` in the DB.
    *   **Sidebar Editing:** Clicking a node opens the Task Wizard in a sliding sidebar for rapid iteration without leaving the canvas.
    *   **Live Pulse:** Use SSE to highlight nodes currently in the `processing` state.

## 4. Marketplace & Blueprints (Pillar 3)

### 4.1 Multi-Task Blueprints
Templates will no longer be limited to single tasks.

*   **Blueprint Bundles:** The `templates` table will support a list of task configurations.
*   **One-Click Deployment:**
    *   User clicks "Use Blueprint."
    *   Wizard opens in a "Batch Mode."
    *   User fills in global variables (e.g., "target_email", "api_key").
    *   Platform creates 2-5 interconnected tasks instantly.

### 4.2 Initial Seed Blueprints
1.  **News Digest:** Fetch RSS -> Summarize with AI -> Send Email.
2.  **GitHub Triage:** Scan Issues -> Label with AI -> Post Comment.
3.  **Crypto Watch:** Price Check -> Sentiment Analysis -> Alert if Bullish.

## 5. Implementation Strategy

### Phase 1: Core Engine (Backend)
*   Update `tasks` and `execution_traces` schema.
*   Refactor `scheduler.go` to handle variable replacement in prompts.
*   Implement `fn_claim_due_tasks` logic for branching.

### Phase 2: Enhanced Wizard & Canvas
*   Add sidebar mode to `TaskWizard.jsx`.
*   Implement drag-and-drop connections in `WorkflowCanvas.jsx` using `react-flow` events.
*   Add the "Variable Injector" to the prompt editor.

### Phase 3: Marketplace V2
*   Refactor `templates` to support multi-task configs.
*   Build the "Blueprint Deployment" flow in the frontend.

## 6. Verification Plan
*   **Automated Tests:** New Go tests for prompt variable replacement and branching logic.
*   **End-to-End:** Manual verification of a 3-step pipeline (Fetch -> Summarize -> Alert) created via a Blueprint.
