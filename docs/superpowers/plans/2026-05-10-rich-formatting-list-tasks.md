# Task 4: Rich Formatting for List Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `list_tasks` tool to return a Markdown table for better readability while preserving JSON for machine parsing.

**Architecture:** Modify the `list_tasks` handler in `cmd/server/tools.go` to generate a Markdown table string and append the JSON representation in an HTML comment.

**Tech Stack:** Go (standard library).

---

### Task 1: Implement Rich Formatting in `list_tasks`

**Files:**
- Modify: `schedule-mcp/cmd/server/tools.go`

- [ ] **Step 1: Update the handler to generate Markdown and JSON**

Modify the `list_tasks` handler:
1. Initialize a `strings.Builder` for the Markdown table.
2. Add the header: `| ID | Prompt | Status | Next Run | Approval |`.
3. Add the separator: `|---|---|---|---|---|`.
4. Iterate through `rows` (from `queries.ListUserTasks`).
5. For each row:
   - Format UUID using `formatUUID(t.ID)`.
   - Use `t.Name` as "Prompt".
   - Use `t.Status.String` for "Status".
   - Format `t.NextRun.Time` (e.g., `2006-01-02 15:04`).
   - If `t.RequiresApproval.Bool` is true, set "Approval" to "Required", otherwise "Optional".
   - Append the row to the Markdown builder.
6. Generate the JSON string from the `tasks` slice.
7. Combine the Markdown table and the JSON comment:
   ```
   [Markdown Table]
   
   <!-- JSON: [JSON string] -->
   ```
8. Return the combined string using `mcp.NewToolResultText`.

- [ ] **Step 2: Verify Build**

Run: `go build -o server_bin ./cmd/server`
Expected: Success.

- [ ] **Step 3: Stage changes**

Run: `git add schedule-mcp/cmd/server/tools.go`
