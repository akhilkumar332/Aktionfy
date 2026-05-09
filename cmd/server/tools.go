package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// registerTools sets up the MCP tools for managing schedules
func registerTools(s *server.MCPServer) {
	createTaskTool := mcp.NewTool("create_task",
		mcp.WithDescription("Creates a new scheduled task"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Task name")),
		mcp.WithString("trigger_type", mcp.Required(), mcp.Description("Trigger type (e.g. interval, cron)")),
		mcp.WithString("agent_prompt", mcp.Required(), mcp.Description("Agent prompt")),
		mcp.WithObject("trigger_config", mcp.Required(), mcp.Description("Trigger configuration")),
		mcp.WithString("missed_task_policy", mcp.Description("Policy for missed tasks (skip, run_immediate)")),
		mcp.WithString("depends_on_task_id", mcp.Description("Optional UUID of a task this task depends on")),
	)

	s.AddTool(createTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value("user_id").(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		userTier, _ := ctx.Value("user_tier").(string)

		// Phase 2.2: Tool Quotas
		var taskCount int
		err := dbPool.QueryRow(ctx, "SELECT COUNT(*) FROM tasks WHERE user_id = $1", userID).Scan(&taskCount)
		if err != nil {
			log.Printf("Quota check error: %v", err)
			return mcp.NewToolResultError("Quota check failed. Please try again later."), nil
		}
		
		if userTier == TierFree && taskCount >= QuotaFree {
			return mcp.NewToolResultError(fmt.Sprintf("quota exceeded: free tier allows maximum %d tasks", QuotaFree)), nil
		} else if userTier == TierPlus && taskCount >= QuotaPlus {
			return mcp.NewToolResultError(fmt.Sprintf("quota exceeded: plus tier allows maximum %d tasks", QuotaPlus)), nil
		} else if userTier == TierPro && taskCount >= QuotaPro {
			return mcp.NewToolResultError(fmt.Sprintf("quota exceeded: pro tier allows maximum %d tasks", QuotaPro)), nil
		}

		name, ok := args["name"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'name'"), nil
		}
		if len(name) > 100 {
			return mcp.NewToolResultError("name too long: maximum 100 characters"), nil
		}

		triggerType, ok := args["trigger_type"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'trigger_type'"), nil
		}
		agentPrompt, ok := args["agent_prompt"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'agent_prompt'"), nil
		}
		if len(agentPrompt) > 10000 {
			return mcp.NewToolResultError("agent_prompt too long: maximum 10,000 characters"), nil
		}
		triggerConfig, ok := args["trigger_config"].(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'trigger_config'"), nil
		}
		
		// Optional Phase 3 fields
		missedPolicy := PolicySkip
		if mp, ok := args["missed_task_policy"].(string); ok && (mp == PolicySkip || mp == PolicyRunImmediate) {
			missedPolicy = mp
		}
		
		var dependsOn *string
		if dep, ok := args["depends_on_task_id"].(string); ok && dep != "" {
			// Basic UUID length validation to prevent Postgres 500 errors
			if len(dep) == 36 {
				// Check if task exists and belongs to user
				var exists bool
				err := dbPool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2)", dep, userID).Scan(&exists)
				if err != nil || !exists {
					return mcp.NewToolResultError("invalid depends_on_task_id: task not found or unauthorized"), nil
				}
				dependsOn = &dep
			} else {
				return mcp.NewToolResultError("invalid depends_on_task_id format, expected UUID"), nil
			}
		}
		
		// trigger_config needs to be saved as JSONB
		triggerConfigBytes, err := json.Marshal(triggerConfig)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid trigger_config JSON: %v", err)), nil
		}

		// Calculate initial next_run
		nextRun, err := calculateNextRun(triggerType, triggerConfig, time.Now().UTC())
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid trigger configuration: %v", err)), nil
		}

		var taskID string
		err = dbPool.QueryRow(ctx, `
			INSERT INTO tasks (user_id, name, trigger_type, trigger_config, agent_prompt, missed_task_policy, depends_on_task_id, next_run)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id
		`, userID, name, triggerType, triggerConfigBytes, agentPrompt, missedPolicy, dependsOn, nextRun).Scan(&taskID)

		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to insert task: %v", err)), nil
		}

		resBytes, _ := json.Marshal(map[string]string{"status": "success", "task_id": taskID, "next_run": nextRun.Format(time.RFC3339)})
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	listTasksTool := mcp.NewTool("list_tasks",
		mcp.WithDescription("Lists user's active tasks"),
	)
	s.AddTool(listTasksTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, ok := ctx.Value("user_id").(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		rows, err := dbPool.Query(ctx, "SELECT id, name, trigger_type, status, next_run FROM tasks WHERE user_id = $1", userID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		defer rows.Close()

		var tasks []map[string]interface{}
		for rows.Next() {
			var id, name, tType, status string
			var nextRun time.Time
			if err := rows.Scan(&id, &name, &tType, &status, &nextRun); err == nil {
				tasks = append(tasks, map[string]interface{}{
					"id":           id,
					"name":         name,
					"trigger_type": tType,
					"status":       status,
					"next_run":     nextRun.Format(time.RFC3339),
				})
			} else {
				log.Printf("Error scanning task row for user %s: %v", userID, err)
			}
		}
		
		resBytes, _ := json.Marshal(tasks)
		if string(resBytes) == "null" {
			resBytes = []byte("[]")
		}
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	pauseTaskTool := mcp.NewTool("pause_task",
		mcp.WithDescription("Pauses a scheduled task"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task ID")),
	)
	s.AddTool(pauseTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value("user_id").(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}
		_, err := dbPool.Exec(ctx, "UPDATE tasks SET status = $1 WHERE id = $2 AND user_id = $3", StatusPaused, id, userID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		resBytes, _ := json.Marshal(map[string]string{"status": StatusPaused})
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	resumeTaskTool := mcp.NewTool("resume_task",
		mcp.WithDescription("Resumes a scheduled task"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task ID")),
	)
	s.AddTool(resumeTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value("user_id").(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}
		// Also reset failure_count when resuming
		_, err := dbPool.Exec(ctx, "UPDATE tasks SET status = $1, failure_count = 0 WHERE id = $2 AND user_id = $3", StatusActive, id, userID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		resBytes, _ := json.Marshal(map[string]string{"status": StatusActive})
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	deleteTaskTool := mcp.NewTool("delete_task",
		mcp.WithDescription("Deletes a scheduled task"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task ID")),
	)
	s.AddTool(deleteTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value("user_id").(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}
		_, err := dbPool.Exec(ctx, "DELETE FROM tasks WHERE id = $1 AND user_id = $2", id, userID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		resBytes, _ := json.Marshal(map[string]string{"status": "deleted"})
		return mcp.NewToolResultText(string(resBytes)), nil
	})
}
