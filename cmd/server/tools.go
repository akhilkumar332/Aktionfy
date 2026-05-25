package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"aktionfy/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// registerTools sets up the MCP tools for managing schedules
func registerTools(s *server.MCPServer) {
	createTaskTool := mcp.NewTool("create_task",
		mcp.WithDescription("Creates a new scheduled task"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Task name")),
		mcp.WithString("trigger_type", mcp.Required(), mcp.Description("Trigger type (e.g. interval, cron, date)")),
		mcp.WithString("agent_prompt", mcp.Description("Agent prompt")),
		mcp.WithObject("trigger_config", mcp.Required(), mcp.Description("Trigger configuration")),
		mcp.WithString("missed_task_policy", mcp.Description("Policy for missed tasks (skip, run_immediately)")),
		mcp.WithString("depends_on_task_id", mcp.Description("Optional UUID of a task this task depends on")),
		mcp.WithObject("secrets", mcp.Description("Optional secrets to be stored securely (e.g. API keys)")),
		mcp.WithBoolean("requires_approval", mcp.Description("If true, the task will require manual approval before each execution")),
		mcp.WithObject("branch_condition", mcp.Description("Optional branch condition for dependent tasks (e.g. {\"if\": \"contains\", \"value\": \"success\"})")),
		mcp.WithBoolean("is_bundle_root", mcp.Description("If true, this task is the root of a workflow bundle")),
		mcp.WithString("task_type", mcp.Description("Optional task type (e.g. decision_router, native_action)")),
		mcp.WithString("native_code", mcp.Description("Optional JS code for native_action tasks")),
		mcp.WithObject("swarm_config", mcp.Description("Optional swarm configuration for swarm_router tasks")),
	)

	s.AddTool(createTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		val := ctx.Value(userTierKey)
		userTier, ok := val.(string)
		if !ok {
			userTier = TierFree
		}

		// Central Quota Enforcement
		if err := CheckUserQuota(ctx, userID, userTier); err != nil {
			return mcp.NewToolResultError(err.Error()), nil
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
		agentPrompt := ""
		if ap, ok := args["agent_prompt"].(string); ok {
			agentPrompt = ap
		}
		if len(agentPrompt) > 10000 {
			return mcp.NewToolResultError("agent_prompt too long: maximum 10,000 characters"), nil
		}
		triggerConfig, ok := args["trigger_config"].(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'trigger_config'"), nil
		}

		taskType := "mcp_sampling"
		if tt, ok := args["task_type"].(string); ok && tt != "" {
			taskType = tt
		}
		nativeCode := ""
		if nc, ok := args["native_code"].(string); ok {
			nativeCode = nc
		}

		// Optional Phase 3 fields
		missedPolicy := PolicySkip
		if mp, ok := args["missed_task_policy"].(string); ok {
			switch mp {
			case PolicySkip, PolicyRunImmediate:
				missedPolicy = mp
			case "run_immediate":
				// Backward-compatible alias for older clients/docs.
				missedPolicy = PolicyRunImmediate
			}
		}

		requiresApproval := false
		if ra, ok := args["requires_approval"].(bool); ok {
			requiresApproval = ra
		}

		var branchCondition []byte
		if bc, ok := args["branch_condition"].(map[string]interface{}); ok {
			var err error
			branchCondition, err = json.Marshal(bc)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid branch_condition JSON: %v", err)), nil
			}
		}

		isBundleRoot := false
		if ibr, ok := args["is_bundle_root"].(bool); ok {
			isBundleRoot = ibr
		}

		var encryptedSecrets []byte
		if secrets, ok := args["secrets"].(map[string]interface{}); ok && len(secrets) > 0 {
			secretsBytes, err := json.Marshal(secrets)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid secrets JSON: %v", err)), nil
			}
			encryptedSecrets, err = Encrypt(secretsBytes)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("encryption error: %v", err)), nil
			}
		}

		var dependsOn pgtype.UUID
		if dep, ok := args["depends_on_task_id"].(string); ok && dep != "" {
			if err := parseUUID(dep, &dependsOn); err != nil {
				return mcp.NewToolResultError("invalid depends_on_task_id format, expected UUID"), nil
			}
			// Check ownership
			exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
				ID:     dependsOn,
				UserID: userID,
			})
			if err != nil || !exists {
				return mcp.NewToolResultError("invalid depends_on_task_id: task not found or unauthorized"), nil
			}
		}

		// trigger_config needs to be saved as JSONB
		triggerConfigBytes, err := json.Marshal(triggerConfig)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid trigger_config JSON: %v", err)), nil
		}

		var swarmConfig []byte
		if sc, ok := args["swarm_config"].(map[string]interface{}); ok {
			var err error
			swarmConfig, err = json.Marshal(sc)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid swarm_config JSON: %v", err)), nil
			}
		}

		// Calculate initial next_run
		nextRun, err := calculateNextRun(triggerType, triggerConfig, time.Now().UTC())
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("invalid trigger configuration: %v", err)), nil
		}

		task, err := queries.CreateTask(ctx, db.CreateTaskParams{
			UserID:           userID,
			Name:             name,
			TriggerType:      pgtype.Text{String: triggerType, Valid: true},
			TriggerConfig:    triggerConfigBytes,
			AgentPrompt:      agentPrompt,
			MissedTaskPolicy: pgtype.Text{String: missedPolicy, Valid: true},
			DependsOnTaskID:  dependsOn,
			NextRun:          pgtype.Timestamptz{Time: nextRun, Valid: true},
			RequiresApproval: pgtype.Bool{Bool: requiresApproval, Valid: true},
			EncryptedSecrets: encryptedSecrets,
			BranchCondition:  branchCondition,
			IsBundleRoot:     pgtype.Bool{Bool: isBundleRoot, Valid: true},
			TaskType:         pgtype.Text{String: taskType, Valid: true},
			NativeCode:       pgtype.Text{String: nativeCode, Valid: true},
			SwarmConfig:      swarmConfig,
		})

		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to insert task: %v", err)), nil
		}
		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "task.create",
			ResourceType: "task",
			ResourceID:   formatUUID(task.ID),
			Metadata: map[string]interface{}{
				"trigger_type": triggerType,
			},
		})

		resMap := map[string]string{"status": "success", "task_id": formatUUID(task.ID), "next_run": nextRun.Format(time.RFC3339)}
		resBytes, err := json.Marshal(resMap)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("internal error marshaling response: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	listTasksTool := mcp.NewTool("list_tasks",
		mcp.WithDescription("Lists user's active tasks"),
		mcp.WithString("status", mcp.Description("Optional status filter (e.g. active, paused, processing)")),
		mcp.WithInteger("limit", mcp.Description("Optional maximum number of tasks to return")),
		mcp.WithInteger("offset", mcp.Description("Optional pagination offset")),
	)
	s.AddTool(listTasksTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		var statusFilter string
		var limit, offset int64
		if ok {
			if sf, ok := args["status"].(string); ok {
				statusFilter = sf
			}
			if lim, ok := args["limit"].(float64); ok {
				limit = int64(lim)
			} else if limInt, ok := args["limit"].(int64); ok {
				limit = limInt
			}
			if off, ok := args["offset"].(float64); ok {
				offset = int64(off)
			} else if offInt, ok := args["offset"].(int64); ok {
				offset = offInt
			}
		}

		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		var rows []db.ListUserTasksRow
		var err error
		cachedRows, cacheErr := GetCachedTasks(ctx, userID)
		if cacheErr == nil && cachedRows != nil {
			rows = cachedRows
		} else {
			rows, err = queries.ListUserTasks(ctx, userID)
			if err == nil {
				SetCachedTasks(ctx, userID, rows)
			}
		}
		if err != nil && cachedRows == nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		// Apply status filtering
		var filteredRows []db.ListUserTasksRow
		for _, t := range rows {
			if statusFilter != "" && !strings.EqualFold(t.Status.String, statusFilter) {
				continue
			}
			filteredRows = append(filteredRows, t)
		}

		// Apply pagination
		totalTasks := int64(len(filteredRows))
		start := offset
		if start < 0 {
			start = 0
		}
		if start > totalTasks {
			start = totalTasks
		}
		end := totalTasks
		if limit > 0 && start+limit < totalTasks {
			end = start + limit
		}
		paginatedRows := filteredRows[start:end]

		var tasks []map[string]interface{}
		var md strings.Builder
		md.WriteString("| ID | Prompt | Status | Next Run | Approval |\n")
		md.WriteString("|---|---|---|---|---|\n")

		for _, t := range paginatedRows {
			idStr := formatUUID(t.ID)
			approval := "Optional"
			if t.RequiresApproval.Bool {
				approval = "Required"
			}
			nextRunStr := t.NextRun.Time.Format("2006-01-02 15:04")

			cleanName := strings.ReplaceAll(t.Name, "|", "\\|")
			md.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n",
				idStr, cleanName, t.Status.String, nextRunStr, approval))

			tasks = append(tasks, map[string]interface{}{
				"id":                   idStr,
				"name":                 t.Name,
				"trigger_type":         t.TriggerType.String,
				"status":               t.Status.String,
				"next_run":             t.NextRun.Time.Format(time.RFC3339),
				"requires_approval":    t.RequiresApproval.Bool,
				"has_secrets":          len(t.EncryptedSecrets) > 0,
				"last_approval_status": t.LastApprovalStatus.String,
			})
		}

		resBytes, _ := json.Marshal(tasks)
		if string(resBytes) == "null" {
			resBytes = []byte("[]")
		}

		finalOutput := fmt.Sprintf("%s\n<!-- JSON: %s -->", md.String(), string(resBytes))
		return mcp.NewToolResultText(finalOutput), nil
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
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(id, &tid); err != nil {
			return mcp.NewToolResultError("invalid task ID format"), nil
		}
		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		if !exists {
			return mcp.NewToolResultError("task not found"), nil
		}

		err = queries.UpdateTaskStatusByUserID(ctx, db.UpdateTaskStatusByUserIDParams{
			Status: pgtype.Text{String: StatusPaused, Valid: true},
			ID:     tid,
			UserID: userID,
		})
		// Note: The original code didn't check ownership here, but it's good practice.
		// For now I'll stick to original logic but using sqlc.
		// Actually, I'll add ownership check to queries.sql for safety.
		// But wait, the original UPDATE had `WHERE id = $2 AND user_id = $3`.
		// I should update my query in queries.sql.

		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		// Emit Redis event
		evtPayload, err := json.Marshal(map[string]interface{}{
			"task_id": id,
			"status":  StatusPaused,
		})
		if err == nil {
			if err := PublishEvent(ctx, PubSubEvent{
				UserID:    userID,
				EventType: "task_status_changed",
				Payload:   string(evtPayload),
			}); err != nil {
				log.Printf("Error publishing task_status_changed event: %v", err)
			}
		}

		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "task.pause",
			ResourceType: "task",
			ResourceID:   id,
		})

		resBytes, err := json.Marshal(map[string]string{"status": StatusPaused})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("internal error: %v", err)), nil
		}
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
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(id, &tid); err != nil {
			return mcp.NewToolResultError("invalid task ID format"), nil
		}
		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		if !exists {
			return mcp.NewToolResultError("task not found"), nil
		}

		err = queries.ResetTaskFailureCount(ctx, db.ResetTaskFailureCountParams{
			Status: pgtype.Text{String: StatusActive, Valid: true},
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		// Emit Redis event
		evtPayload, err := json.Marshal(map[string]string{"task_id": id, "status": StatusActive})
		if err == nil {
			if err := PublishEvent(ctx, PubSubEvent{
				UserID:    userID,
				EventType: "task_status_changed",
				Payload:   string(evtPayload),
			}); err != nil {
				log.Printf("Error publishing task_status_changed event: %v", err)
			}
		}

		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "task.resume",
			ResourceType: "task",
			ResourceID:   id,
		})

		resBytes, err := json.Marshal(map[string]string{"status": StatusActive})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("internal error: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	bulkActionTasksTool := mcp.NewTool("bulk_action_tasks",
		mcp.WithDescription("Perform bulk actions on multiple tasks"),
		mcp.WithString("action", mcp.Required(), mcp.Description("Action to perform: delete, pause, resume")),
		mcp.WithString("task_ids", mcp.Required(), mcp.Description("Comma-separated list of task UUIDs")),
	)

	s.AddTool(bulkActionTasksTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		action, ok := args["action"].(string)
		if !ok || (action != "delete" && action != "pause" && action != "resume") {
			return mcp.NewToolResultError("invalid action. Must be delete, pause, or resume"), nil
		}

		taskIDsStr, ok := args["task_ids"].(string)
		if !ok || taskIDsStr == "" {
			return mcp.NewToolResultError("missing task_ids"), nil
		}

		taskIDs := strings.Split(taskIDsStr, ",")
		successCount := 0

		for _, idStr := range taskIDs {
			idStr = strings.TrimSpace(idStr)
			var taskID pgtype.UUID
			if err := parseUUID(idStr, &taskID); err != nil {
				continue
			}
			switch action {
			case "delete":
				if queries.DeleteTask(ctx, db.DeleteTaskParams{ID: taskID, UserID: userID}) == nil {
					successCount++
				}
			case "pause":
				if queries.UpdateTaskStatus(ctx, db.UpdateTaskStatusParams{Status: pgtype.Text{String: "paused", Valid: true}, ID: taskID, UserID: userID}) == nil {
					successCount++
				}
			case "resume":
				if queries.UpdateTaskStatus(ctx, db.UpdateTaskStatusParams{Status: pgtype.Text{String: "active", Valid: true}, ID: taskID, UserID: userID}) == nil {
					successCount++
				}
			}
		}

		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "task.bulk_" + action + "_mcp",
			ResourceType: "tasks",
			Metadata: map[string]interface{}{
				"requested_count": len(taskIDs),
				"success_count":   successCount,
			},
		})

		return mcp.NewToolResultText(fmt.Sprintf("Successfully processed %d tasks for action %s", successCount, action)), nil
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
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(id, &tid); err != nil {
			return mcp.NewToolResultError("invalid task ID format"), nil
		}
		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		if !exists {
			return mcp.NewToolResultError("task not found"), nil
		}

		err = queries.DeleteTask(ctx, db.DeleteTaskParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		InvalidateCachedTask(ctx, id)
		InvalidateCachedTasks(ctx, userID)
		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "task.delete",
			ResourceType: "task",
			ResourceID:   id,
		})
		resBytes, err := json.Marshal(map[string]string{"status": "deleted"})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("internal error: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	getTaskTool := mcp.NewTool("get_task",
		mcp.WithDescription("Gets detailed information about a specific task"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task ID")),
	)
	s.AddTool(getTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(id, &tid); err != nil {
			return mcp.NewToolResultError("invalid task ID format"), nil
		}

		var t db.Task
		var err error
		cachedTask, cacheErr := GetCachedTask(ctx, id)
		if cacheErr == nil && cachedTask != nil {
			t = *cachedTask
		} else {
			t, err = queries.GetTaskByID(ctx, db.GetTaskByIDParams{
				ID:     tid,
				UserID: userID,
			})
			if err == nil {
				SetCachedTask(ctx, id, t)
			}
		}
		if err != nil && cachedTask == nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError("task not found"), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		resBytes, err := json.Marshal(t)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("internal error: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	updateTaskTool := mcp.NewTool("update_task",
		mcp.WithDescription("Updates an existing task's configuration"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task ID")),
		mcp.WithString("agent_prompt", mcp.Description("New agent prompt")),
		mcp.WithString("missed_task_policy", mcp.Description("New policy for missed tasks")),
		mcp.WithString("depends_on_task_id", mcp.Description("New dependency")),
		mcp.WithObject("branch_condition", mcp.Description("New branch condition")),
		mcp.WithObject("loop_condition", mcp.Description("New loop condition")),
		mcp.WithObject("swarm_config", mcp.Description("New swarm configuration")),
	)
	s.AddTool(updateTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(id, &tid); err != nil {
			return mcp.NewToolResultError("invalid task ID format"), nil
		}

		// Fetch existing task to merge
		t, err := queries.GetTaskByID(ctx, db.GetTaskByIDParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError("task not found"), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		agentPrompt := t.AgentPrompt
		if ap, ok := args["agent_prompt"].(string); ok {
			agentPrompt = ap
		}

		missedPolicy := t.MissedTaskPolicy
		if mp, ok := args["missed_task_policy"].(string); ok {
			missedPolicy = pgtype.Text{String: mp, Valid: true}
		}

		dependsOn := t.DependsOnTaskID
		if dep, ok := args["depends_on_task_id"].(string); ok {
			if dep == "" {
				dependsOn = pgtype.UUID{Valid: false}
			} else {
				if dep == id {
					return mcp.NewToolResultError("a task cannot depend on itself"), nil
				}
				if err := parseUUID(dep, &dependsOn); err != nil {
					return mcp.NewToolResultError("invalid depends_on_task_id format"), nil
				}
				// Verify ownership of the dependency
				depExists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
					ID:     dependsOn,
					UserID: userID,
				})
				if err != nil || !depExists {
					return mcp.NewToolResultError("dependency task not found or unauthorized"), nil
				}
			}
		}

		branchCondition := t.BranchCondition
		if bc, ok := args["branch_condition"].(map[string]interface{}); ok {
			var err error
			branchCondition, err = json.Marshal(bc)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid branch_condition: %v", err)), nil
			}
		}

		loopCondition := t.LoopCondition
		if lc, ok := args["loop_condition"].(map[string]interface{}); ok {
			var err error
			loopCondition, err = json.Marshal(lc)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid loop_condition: %v", err)), nil
			}
		}

		swarmConfig := t.SwarmConfig
		if sc, ok := args["swarm_config"].(map[string]interface{}); ok {
			var err error
			swarmConfig, err = json.Marshal(sc)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("invalid swarm_config: %v", err)), nil
			}
		}

		// Automatically create a task version before applying updates (Immutable Versioning)
		_, err = queries.CreateTaskVersion(ctx, db.CreateTaskVersionParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			log.Printf("Warning: failed to create task version: %v", err)
		}

		_, err = queries.UpdateTaskAgentPromptAndPolicy(ctx, db.UpdateTaskAgentPromptAndPolicyParams{
			ID:                 tid,
			UserID:             userID,
			AgentPrompt:        agentPrompt,
			MissedTaskPolicy:   missedPolicy,
			DependsOnTaskID:    dependsOn,
			BranchCondition:    branchCondition,
			LoopCondition:      loopCondition,
			SwarmConfig:        swarmConfig,
			TriggerOnCompletion: t.TriggerOnCompletion,
			UiCoordinates:      t.UiCoordinates,
		})

		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		InvalidateCachedTask(ctx, id)
		InvalidateCachedTasks(ctx, userID)

		return mcp.NewToolResultText("Task updated successfully"), nil
	})

	executeTaskTool := mcp.NewTool("execute_task",
		mcp.WithDescription("Manually triggers a task to run immediately"),
		mcp.WithString("id", mcp.Required(), mcp.Description("Task ID")),
	)
	s.AddTool(executeTaskTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		id, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'id'"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(id, &tid); err != nil {
			return mcp.NewToolResultError("invalid task ID format"), nil
		}

		// Ensure ownership
		t, err := queries.GetTaskByID(ctx, db.GetTaskByIDParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError("task not found"), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		if t.Status.String == StatusProcessing {
			return mcp.NewToolResultError("task is already being processed"), nil
		}

		err = queries.UpdateTaskNextRun(ctx, db.UpdateTaskNextRunParams{
			Status:  pgtype.Text{String: StatusActive, Valid: true},
			NextRun: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
			ID:      tid,
			UserID:  userID,
		})

		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		return mcp.NewToolResultText("Task queued for immediate execution"), nil
	})

	getCurrentTimeTool := mcp.NewTool("get_current_time",
		mcp.WithDescription("Returns the current server time"),
	)
	s.AddTool(getCurrentTimeTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		now := time.Now().UTC().Format(time.RFC3339)
		return mcp.NewToolResultText(fmt.Sprintf("Current server time (UTC): %s", now)), nil
	})

	storeSecretTool := mcp.NewTool("store_secret",
		mcp.WithDescription("Stores an encrypted secret for the user"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Secret name")),
		mcp.WithString("value", mcp.Required(), mcp.Description("Secret value")),
	)
	s.AddTool(storeSecretTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		name, ok := args["name"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'name'"), nil
		}
		value, ok := args["value"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'value'"), nil
		}

		encrypted, err := Encrypt([]byte(value))
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("encryption error: %v", err)), nil
		}

		_, err = queries.UpsertUserSecret(ctx, db.UpsertUserSecretParams{
			UserID:         userID,
			Name:           name,
			EncryptedValue: encrypted,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		InvalidateCachedUserSecrets(ctx, userID)
		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "secret.upsert",
			ResourceType: "secret",
			ResourceID:   name,
		})

		return mcp.NewToolResultText("Secret stored successfully"), nil
	})

	listSecretsTool := mcp.NewTool("list_secrets",
		mcp.WithDescription("Lists user's secret names and creation dates"),
	)
	s.AddTool(listSecretsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		var rows []db.ListUserSecretsRow
		var err error
		cachedRows, cacheErr := GetCachedUserSecrets(ctx, userID)
		if cacheErr == nil && cachedRows != nil {
			rows = cachedRows
		} else {
			rows, err = queries.ListUserSecrets(ctx, userID)
			if err == nil {
				SetCachedUserSecrets(ctx, userID, rows)
			}
		}
		if err != nil && cachedRows == nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		var md strings.Builder
		md.WriteString("| Name | Created At |\n")
		md.WriteString("|---|---|\n")

		for _, r := range rows {
			createdAt := r.CreatedAt.Time.Format("2006-01-02 15:04")
			md.WriteString(fmt.Sprintf("| %s | %s |\n", r.Name, createdAt))
		}

		if len(rows) == 0 {
			return mcp.NewToolResultText("No secrets found."), nil
		}

		return mcp.NewToolResultText(md.String()), nil
	})

	deleteSecretTool := mcp.NewTool("delete_secret",
		mcp.WithDescription("Deletes a user secret"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Secret name")),
	)
	s.AddTool(deleteSecretTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		name, ok := args["name"].(string)
		if !ok {
			return mcp.NewToolResultError("missing or invalid 'name'"), nil
		}

		err := queries.DeleteUserSecret(ctx, db.DeleteUserSecretParams{
			UserID: userID,
			Name:   name,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}
		InvalidateCachedUserSecrets(ctx, userID)
		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "secret.delete",
			ResourceType: "secret",
			ResourceID:   name,
		})

		return mcp.NewToolResultText("Secret deleted successfully"), nil
	})

	getExecutionLogsTool := mcp.NewTool("get_execution_logs",
		mcp.WithDescription("Retrieves recent task execution runs or detailed step-by-step trace logs"),
		mcp.WithString("task_id", mcp.Required(), mcp.Description("UUID of the task")),
		mcp.WithString("execution_id", mcp.Description("Optional execution run ID to fetch detailed steps")),
		mcp.WithInteger("limit", mcp.Description("Optional maximum number of runs to return (default: 10)")),
	)
	s.AddTool(getExecutionLogsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		taskIDStr, ok := args["task_id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing task_id"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(taskIDStr, &tid); err != nil {
			return mcp.NewToolResultError("invalid task_id format"), nil
		}

		// Ensure task ownership
		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil || !exists {
			return mcp.NewToolResultError("task not found or unauthorized"), nil
		}

		execID, hasExecID := args["execution_id"].(string)

		if hasExecID && execID != "" {
			// List detailed traces for specific execution run
			traces, err := queries.ListExecutionTracesByExecutionID(ctx, db.ListExecutionTracesByExecutionIDParams{
				TaskID:      tid,
				ExecutionID: execID,
			})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to fetch traces: %v", err)), nil
			}

			var md strings.Builder
			md.WriteString(fmt.Sprintf("### Execution Run Logs for ID `%s`:\n\n", execID))
			md.WriteString("| Start Time | Step Name | Duration (ms) | Status | Error Message |\n")
			md.WriteString("|---|---|---|---|---|\n")

			for _, t := range traces {
				startStr := t.StartTime.Time.Format("2006-01-02 15:04:05")
				status := "Success"
				if t.IsError.Bool {
					status = "Failed"
				}
				duration := "N/A"
				if t.DurationMs.Valid {
					duration = fmt.Sprintf("%d", t.DurationMs.Int32)
				}
				md.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n", startStr, t.StepName, duration, status, t.ErrorMessage.String))
			}

			if len(traces) == 0 {
				return mcp.NewToolResultText("No steps recorded for this execution run ID."), nil
			}

			return mcp.NewToolResultText(md.String()), nil
		} else {
			// List summary of task execution runs
			runs, err := queries.ListTaskExecutionIDs(ctx, tid)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to fetch runs: %v", err)), nil
			}

			limit := int64(10)
			if lim, ok := args["limit"].(float64); ok && lim > 0 {
				limit = int64(lim)
			} else if limInt, ok := args["limit"].(int64); ok && limInt > 0 {
				limit = limInt
			}

			var md strings.Builder
			md.WriteString("### Recent Task Execution Runs:\n\n")
			md.WriteString("| Execution Run ID | Start Time | Last Activity | Status |\n")
			md.WriteString("|---|---|---|---|\n")

			count := int64(0)
			for _, r := range runs {
				if count >= limit {
					break
				}
				status := "Success"
				if r.IsError {
					status = "Failed"
				}
				startStr := "N/A"
				if r.StartTime.Valid {
					startStr = r.StartTime.Time.Format("2006-01-02 15:04:05")
				}
				activityStr := "N/A"
				if r.LastActivity.Valid {
					activityStr = r.LastActivity.Time.Format("2006-01-02 15:04:05")
				}
				md.WriteString(fmt.Sprintf("| `%s` | %s | %s | %s |\n", r.ExecutionID, startStr, activityStr, status))
				count++
			}

			if len(runs) == 0 {
				return mcp.NewToolResultText("No execution history found for this task."), nil
			}

			return mcp.NewToolResultText(md.String()), nil
		}
	})

	createWebhookTriggerTool := mcp.NewTool("create_webhook_trigger",
		mcp.WithDescription("Creates a new inbound webhook trigger URL token for a task"),
		mcp.WithString("task_id", mcp.Required(), mcp.Description("UUID of the task")),
	)
	s.AddTool(createWebhookTriggerTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		taskIDStr, ok := args["task_id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing task_id"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(taskIDStr, &tid); err != nil {
			return mcp.NewToolResultError("invalid task_id format"), nil
		}

		// Ensure task ownership
		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil || !exists {
			return mcp.NewToolResultError("task not found or unauthorized"), nil
		}

		token := uuid.New().String()
		_, err = queries.CreateWebhookTrigger(ctx, db.CreateWebhookTriggerParams{
			TaskID: pgtype.UUID{Bytes: tid.Bytes, Valid: true},
			Token:  token,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to create webhook: %v", err)), nil
		}

		// Invalidate cache
		InvalidateCachedTask(ctx, taskIDStr)
		InvalidateCachedTasks(ctx, userID)

		webhookUrl := fmt.Sprintf("/api/v1/webhooks/inbound/%s", token)
		resMap := map[string]string{
			"status":      "success",
			"webhook_url": webhookUrl,
			"token":       token,
		}
		resBytes, _ := json.Marshal(resMap)
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	listWorkspacesTool := mcp.NewTool("list_workspaces",
		mcp.WithDescription("Lists all workspaces owned by or shared with the user"),
	)
	s.AddTool(listWorkspacesTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		var workspaces []db.Workspace
		var err error
		cachedWorkspaces, cacheErr := GetCachedWorkspaces(ctx, userID)
		if cacheErr == nil && cachedWorkspaces != nil {
			workspaces = cachedWorkspaces
		} else {
			workspaces, err = queries.GetUserWorkspaces(ctx, userID)
			if err == nil {
				SetCachedWorkspaces(ctx, userID, workspaces)
			}
		}
		if err != nil && cachedWorkspaces == nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to list workspaces: %v", err)), nil
		}

		var md strings.Builder
		md.WriteString("| ID | Workspace Name | Created At |\n")
		md.WriteString("|---|---|---|\n")

		for _, w := range workspaces {
			idStr := formatUUID(w.ID)
			createdStr := w.CreatedAt.Time.Format("2006-01-02 15:04")
			md.WriteString(fmt.Sprintf("| %s | %s | %s |\n", idStr, w.Name, createdStr))
		}

		if len(workspaces) == 0 {
			return mcp.NewToolResultText("No workspaces found."), nil
		}

		return mcp.NewToolResultText(md.String()), nil
	})

	createWorkspaceTool := mcp.NewTool("create_workspace",
		mcp.WithDescription("Creates a new workspace"),
		mcp.WithString("name", mcp.Required(), mcp.Description("Name of the workspace")),
	)
	s.AddTool(createWorkspaceTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		name, ok := args["name"].(string)
		if !ok || name == "" {
			return mcp.NewToolResultError("missing workspace name"), nil
		}

		w, err := queries.CreateWorkspace(ctx, db.CreateWorkspaceParams{
			Name:    name,
			OwnerID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to create workspace: %v", err)), nil
		}

		InvalidateCachedWorkspaces(ctx, userID)

		resMap := map[string]string{
			"status":       "success",
			"workspace_id": formatUUID(w.ID),
			"name":         w.Name,
		}
		resBytes, _ := json.Marshal(resMap)
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	getSystemStatusTool := mcp.NewTool("get_system_status",
		mcp.WithDescription("Retrieves the current operational status and metrics of the Aktionfy cluster"),
	)
	s.AddTool(getSystemStatusTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		uptime := time.Since(ServerStartTime).Round(time.Second)

		redisStatus := "Online"
		if RedisClient != nil {
			if err := RedisClient.Ping(ctx).Err(); err != nil {
				redisStatus = fmt.Sprintf("Error: %v", err)
			}
		} else {
			redisStatus = "Offline/Unconfigured"
		}

		workers, err := queries.ListWorkerHeartbeats(ctx)
		activeWorkersCount := 0
		if err == nil {
			now := time.Now().UTC()
			for _, w := range workers {
				if w.LastHeartbeat.Valid && w.LastHeartbeat.Time.After(now.Add(-2*time.Minute)) {
					activeWorkersCount++
				}
			}
		}

		var md strings.Builder
		md.WriteString("### Aktionfy System Status Report:\n\n")
		md.WriteString(fmt.Sprintf("- **Uptime**: %s\n", uptime.String()))
		md.WriteString(fmt.Sprintf("- **Redis Infrastructure**: %s\n", redisStatus))
		md.WriteString(fmt.Sprintf("- **Active Reaper Nodes**: %d\n", activeWorkersCount))

		return mcp.NewToolResultText(md.String()), nil
	})

	listTaskVersionsTool := mcp.NewTool("list_task_versions",
		mcp.WithDescription("Lists all historical versions of a task"),
		mcp.WithString("task_id", mcp.Required(), mcp.Description("UUID of the task")),
	)
	s.AddTool(listTaskVersionsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		taskIDStr, ok := args["task_id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing task_id"), nil
		}

		var tid pgtype.UUID
		if err := parseUUID(taskIDStr, &tid); err != nil {
			return mcp.NewToolResultError("invalid task_id format"), nil
		}

		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil || !exists {
			return mcp.NewToolResultError("task not found or unauthorized"), nil
		}

		versions, err := queries.ListTaskVersions(ctx, tid)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to fetch versions: %v", err)), nil
		}

		var md strings.Builder
		md.WriteString("### Task Version History:\n\n")
		md.WriteString("| Version ID | Saved At | Prompt Preview |\n")
		md.WriteString("|---|---|---|\n")

		for _, v := range versions {
			versionIDStr := formatUUID(v.ID)
			savedAtStr := v.CreatedAt.Time.Format("2006-01-02 15:04:05")
			preview := v.AgentPrompt
			if len(preview) > 50 {
				preview = preview[:47] + "..."
			}
			preview = strings.ReplaceAll(preview, "\n", " ")
			preview = strings.ReplaceAll(preview, "|", "\\|")
			md.WriteString(fmt.Sprintf("| `%s` | %s | %s |\n", versionIDStr, savedAtStr, preview))
		}

		if len(versions) == 0 {
			return mcp.NewToolResultText("No version history found for this task."), nil
		}

		return mcp.NewToolResultText(md.String()), nil
	})

	restoreTaskVersionTool := mcp.NewTool("restore_task_version",
		mcp.WithDescription("Restores a task from a specific historical version"),
		mcp.WithString("task_id", mcp.Required(), mcp.Description("UUID of the task")),
		mcp.WithString("version_id", mcp.Required(), mcp.Description("UUID of the version to restore")),
	)
	s.AddTool(restoreTaskVersionTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		taskIDStr, ok := args["task_id"].(string)
		versionIDStr, ok2 := args["version_id"].(string)
		if !ok || !ok2 {
			return mcp.NewToolResultError("missing task_id or version_id"), nil
		}

		var tid, vid pgtype.UUID
		if err := parseUUID(taskIDStr, &tid); err != nil {
			return mcp.NewToolResultError("invalid task_id format"), nil
		}
		if err := parseUUID(versionIDStr, &vid); err != nil {
			return mcp.NewToolResultError("invalid version_id format"), nil
		}

		// Verify task ownership
		exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil || !exists {
			return mcp.NewToolResultError("task not found or unauthorized"), nil
		}

		// Fetch version to confirm it exists and belongs to this task
		version, err := queries.GetTaskVersionByID(ctx, db.GetTaskVersionByIDParams{
			ID:     vid,
			TaskID: tid,
		})
		if err != nil {
			if err == pgx.ErrNoRows {
				return mcp.NewToolResultError("version not found for this task"), nil
			}
			return mcp.NewToolResultError(fmt.Sprintf("db error: %v", err)), nil
		}

		// Automatically save current state to task_versions before reverting
		_, err = queries.CreateTaskVersion(ctx, db.CreateTaskVersionParams{
			ID:     tid,
			UserID: userID,
		})
		if err != nil {
			log.Printf("Warning: failed to create task version before restore: %v", err)
		}

		err = queries.RestoreTaskFromVersion(ctx, db.RestoreTaskFromVersionParams{
			ID:     tid,
			UserID: userID,
			ID_2:   version.ID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to restore task version: %v", err)), nil
		}

		InvalidateCachedTask(ctx, taskIDStr)
		InvalidateCachedTasks(ctx, userID)

		return mcp.NewToolResultText(fmt.Sprintf("Task '%s' successfully restored to version saved at %s", taskIDStr, version.CreatedAt.Time.Format("2006-01-02 15:04:05"))), nil
	})

	setWorkspaceEnvTool := mcp.NewTool("set_workspace_env",
		mcp.WithDescription("Sets or updates an environment variable for a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("UUID of the workspace")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Variable name (e.g. API_KEY)")),
		mcp.WithString("value", mcp.Required(), mcp.Description("Variable value")),
	)
	s.AddTool(setWorkspaceEnvTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		workspaceIDStr, ok1 := args["workspace_id"].(string)
		name, ok2 := args["name"].(string)
		value, ok3 := args["value"].(string)
		if !ok1 || !ok2 || !ok3 || name == "" {
			return mcp.NewToolResultError("missing workspace_id, name, or value"), nil
		}

		var wid pgtype.UUID
		if err := parseUUID(workspaceIDStr, &wid); err != nil {
			return mcp.NewToolResultError("invalid workspace_id format"), nil
		}

		hasAccess, err := queries.CheckWorkspaceAccess(ctx, db.CheckWorkspaceAccessParams{
			ID:      wid,
			OwnerID: userID,
		})
		if err != nil || !hasAccess {
			return mcp.NewToolResultError("workspace not found or access denied"), nil
		}

		_, err = queries.UpsertWorkspaceEnvVar(ctx, db.UpsertWorkspaceEnvVarParams{
			WorkspaceID: wid,
			Name:        name,
			Value:       value,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to set environment variable: %v", err)), nil
		}

		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "workspace.env.set",
			ResourceType: "workspace",
			ResourceID:   workspaceIDStr,
			Metadata: map[string]interface{}{
				"var_name": name,
			},
		})

		return mcp.NewToolResultText(fmt.Sprintf("Environment variable '%s' successfully set for workspace '%s'", name, workspaceIDStr)), nil
	})

	listWorkspaceEnvTool := mcp.NewTool("list_workspace_env",
		mcp.WithDescription("Lists all environment variables for a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("UUID of the workspace")),
	)
	s.AddTool(listWorkspaceEnvTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		workspaceIDStr, ok := args["workspace_id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing workspace_id"), nil
		}

		var wid pgtype.UUID
		if err := parseUUID(workspaceIDStr, &wid); err != nil {
			return mcp.NewToolResultError("invalid workspace_id format"), nil
		}

		hasAccess, err := queries.CheckWorkspaceAccess(ctx, db.CheckWorkspaceAccessParams{
			ID:      wid,
			OwnerID: userID,
		})
		if err != nil || !hasAccess {
			return mcp.NewToolResultError("workspace not found or access denied"), nil
		}

		envVars, err := queries.ListWorkspaceEnvVars(ctx, wid)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to fetch environment variables: %v", err)), nil
		}

		var md strings.Builder
		md.WriteString(fmt.Sprintf("### Environment Variables for Workspace `%s`:\n\n", workspaceIDStr))
		md.WriteString("| Variable Name | Value | Last Updated |\n")
		md.WriteString("|---|---|---|\n")

		sensitiveKeys := []string{"key", "secret", "token", "password"}

		for _, ev := range envVars {
			displayVal := ev.Value
			lowerName := strings.ToLower(ev.Name)
			for _, sk := range sensitiveKeys {
				if strings.Contains(lowerName, sk) {
					displayVal = "********"
					break
				}
			}
			updatedStr := ev.UpdatedAt.Time.Format("2006-01-02 15:04:05")
			md.WriteString(fmt.Sprintf("| %s | %s | %s |\n", ev.Name, displayVal, updatedStr))
		}

		if len(envVars) == 0 {
			return mcp.NewToolResultText("No environment variables configured for this workspace."), nil
		}

		return mcp.NewToolResultText(md.String()), nil
	})

	deleteWorkspaceEnvTool := mcp.NewTool("delete_workspace_env",
		mcp.WithDescription("Deletes an environment variable from a workspace"),
		mcp.WithString("workspace_id", mcp.Required(), mcp.Description("UUID of the workspace")),
		mcp.WithString("name", mcp.Required(), mcp.Description("Variable name to delete")),
	)
	s.AddTool(deleteWorkspaceEnvTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		workspaceIDStr, ok1 := args["workspace_id"].(string)
		name, ok2 := args["name"].(string)
		if !ok1 || !ok2 || name == "" {
			return mcp.NewToolResultError("missing workspace_id or name"), nil
		}

		var wid pgtype.UUID
		if err := parseUUID(workspaceIDStr, &wid); err != nil {
			return mcp.NewToolResultError("invalid workspace_id format"), nil
		}

		hasAccess, err := queries.CheckWorkspaceAccess(ctx, db.CheckWorkspaceAccessParams{
			ID:      wid,
			OwnerID: userID,
		})
		if err != nil || !hasAccess {
			return mcp.NewToolResultError("workspace not found or access denied"), nil
		}

		err = queries.DeleteWorkspaceEnvVar(ctx, db.DeleteWorkspaceEnvVarParams{
			WorkspaceID: wid,
			Name:        name,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to delete environment variable: %v", err)), nil
		}

		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "workspace.env.delete",
			ResourceType: "workspace",
			ResourceID:   workspaceIDStr,
			Metadata: map[string]interface{}{
				"var_name": name,
			},
		})

		return mcp.NewToolResultText(fmt.Sprintf("Environment variable '%s' successfully deleted from workspace '%s'", name, workspaceIDStr)), nil
	})

	createOutboundWebhookTool := mcp.NewTool("create_outbound_webhook",
		mcp.WithDescription("Creates a new outbound HTTP webhook configuration for task events"),
		mcp.WithString("endpoint_url", mcp.Required(), mcp.Description("HTTP POST endpoint URL to send events")),
		mcp.WithString("event_types", mcp.Required(), mcp.Description("Comma-separated list of event types (e.g. task.success,task.failure)")),
		mcp.WithString("signing_secret", mcp.Description("Optional custom signing secret. If omitted, one is generated automatically.")),
	)
	s.AddTool(createOutboundWebhookTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		endpointURL, ok1 := args["endpoint_url"].(string)
		eventTypesStr, ok2 := args["event_types"].(string)
		if !ok1 || !ok2 || endpointURL == "" || eventTypesStr == "" {
			return mcp.NewToolResultError("missing endpoint_url or event_types"), nil
		}

		signingSecret, _ := args["signing_secret"].(string)
		if signingSecret == "" {
			generated, err := generateSigningSecret()
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to generate signing secret: %v", err)), nil
			}
			signingSecret = generated
		}

		encryptedSecret, err := Encrypt([]byte(signingSecret))
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("secret encryption error: %v", err)), nil
		}

		parts := strings.Split(eventTypesStr, ",")
		var eventTypes []string
		for _, p := range parts {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				eventTypes = append(eventTypes, trimmed)
			}
		}

		eventTypesJSON, err := json.Marshal(eventTypes)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to serialize event types: %v", err)), nil
		}

		row, err := queries.CreateOutboundWebhook(ctx, db.CreateOutboundWebhookParams{
			UserID:                 userID,
			EndpointUrl:            endpointURL,
			EventTypes:             eventTypesJSON,
			EncryptedSigningSecret: encryptedSecret,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to create webhook in DB: %v", err)), nil
		}

		webhookIDStr := formatUUID(row.ID)
		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "webhook.create",
			ResourceType: "webhook",
			ResourceID:   webhookIDStr,
			Metadata: map[string]interface{}{
				"endpoint_url": endpointURL,
				"event_types":  eventTypes,
			},
		})

		resMap := map[string]string{
			"status":         "success",
			"webhook_id":     webhookIDStr,
			"endpoint_url":   endpointURL,
			"signing_secret": signingSecret,
		}
		resBytes, _ := json.Marshal(resMap)
		return mcp.NewToolResultText(string(resBytes)), nil
	})

	listOutboundWebhooksTool := mcp.NewTool("list_outbound_webhooks",
		mcp.WithDescription("Lists all outbound webhook configurations for the user"),
	)
	s.AddTool(listOutboundWebhooksTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		webhooks, err := queries.ListOutboundWebhooks(ctx, userID)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to list webhooks: %v", err)), nil
		}

		var md strings.Builder
		md.WriteString("### Outbound Webhook Subscriptions:\n\n")
		md.WriteString("| Webhook ID | Endpoint URL | Event Types | Active | Created At |\n")
		md.WriteString("|---|---|---|---|---|\n")

		for _, w := range webhooks {
			idStr := formatUUID(w.ID)
			createdStr := w.CreatedAt.Time.Format("2006-01-02 15:04")
			activeStr := "True"
			if !w.IsActive {
				activeStr = "False"
			}
			
			var eventTypes []string
			_ = json.Unmarshal(w.EventTypes, &eventTypes)
			eventTypesStr := strings.Join(eventTypes, ", ")

			md.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n", idStr, w.EndpointUrl, eventTypesStr, activeStr, createdStr))
		}

		if len(webhooks) == 0 {
			return mcp.NewToolResultText("No outbound webhooks configured."), nil
		}

		return mcp.NewToolResultText(md.String()), nil
	})

	deleteOutboundWebhookTool := mcp.NewTool("delete_outbound_webhook",
		mcp.WithDescription("Deletes an outbound webhook configuration"),
		mcp.WithString("id", mcp.Required(), mcp.Description("UUID of the webhook configuration to delete")),
	)
	s.AddTool(deleteOutboundWebhookTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		if !ok {
			return mcp.NewToolResultError("invalid arguments"), nil
		}
		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}
		idStr, ok := args["id"].(string)
		if !ok {
			return mcp.NewToolResultError("missing webhook id"), nil
		}

		var wid pgtype.UUID
		if err := parseUUID(idStr, &wid); err != nil {
			return mcp.NewToolResultError("invalid webhook id format"), nil
		}

		err := queries.DeleteOutboundWebhook(ctx, db.DeleteOutboundWebhookParams{
			ID:     wid,
			UserID: userID,
		})
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to delete webhook: %v", err)), nil
		}

		writeAuditLog(ctx, AuditEvent{
			UserID:       userID,
			Action:       "webhook.delete",
			ResourceType: "webhook",
			ResourceID:   idStr,
		})

		return mcp.NewToolResultText(fmt.Sprintf("Outbound webhook '%s' successfully deleted", idStr)), nil
	})

	getAuditLogsTool := mcp.NewTool("get_audit_logs",
		mcp.WithDescription("Retrieves recent audit events for security and compliance monitoring"),
		mcp.WithInteger("limit", mcp.Description("Optional maximum number of logs to retrieve (default: 20)")),
	)
	s.AddTool(getAuditLogsTool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args, ok := req.Params.Arguments.(map[string]interface{})
		limit := int64(20)
		if ok {
			if lim, ok := args["limit"].(float64); ok && lim > 0 {
				limit = int64(lim)
			} else if limInt, ok := args["limit"].(int64); ok && limInt > 0 {
				limit = limInt
			}
		}

		userID, ok := ctx.Value(userIDKey).(string)
		if !ok {
			return mcp.NewToolResultError("unauthorized"), nil
		}

		// ListAuditLogs fetches global audit logs. We retrieve 1000 items and filter for user_id in memory.
		logs, err := queries.ListAuditLogs(ctx, 1000)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to fetch audit logs: %v", err)), nil
		}

		var userLogs []db.AuditLog
		for _, l := range logs {
			if l.UserID.Valid && l.UserID.String == userID {
				userLogs = append(userLogs, l)
				if int64(len(userLogs)) >= limit {
					break
				}
			}
		}

		var md strings.Builder
		md.WriteString("### User Audit Logs:\n\n")
		md.WriteString("| Event ID | Action | Resource Type | Resource ID | Created At |\n")
		md.WriteString("|---|---|---|---|---|\n")

		for _, l := range userLogs {
			idStr := formatUUID(l.ID)
			createdStr := l.CreatedAt.Time.Format("2006-01-02 15:04:05")
			resIDStr := l.ResourceID.String
			if !l.ResourceID.Valid {
				resIDStr = "N/A"
			}
			md.WriteString(fmt.Sprintf("| `%s` | %s | %s | %s | %s |\n", idStr, l.Action, l.ResourceType, resIDStr, createdStr))
		}

		if len(userLogs) == 0 {
			return mcp.NewToolResultText("No audit logs found."), nil
		}

		return mcp.NewToolResultText(md.String()), nil
	})
}
