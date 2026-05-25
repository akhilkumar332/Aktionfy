package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
	"strconv"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type CreateTaskRequest struct {
	Name                string          `json:"name"`
	WorkspaceID         string          `json:"workspace_id"`
	TaskType            string          `json:"task_type"`
	AgentPrompt         string          `json:"agent_prompt"`
	NativeCode          string          `json:"native_code"`
	TriggerType         string          `json:"trigger_type"`
	TriggerConfig       json.RawMessage `json:"trigger_config"`
	RequiresApproval    bool            `json:"requires_approval"`
	MissedTaskPolicy    string          `json:"missed_task_policy"`
	DependsOnTaskID     string          `json:"depends_on_task_id"`
	TriggerOnCompletion bool            `json:"trigger_on_completion"`
	BranchCondition     json.RawMessage `json:"branch_condition"`
	LoopCondition       json.RawMessage `json:"loop_condition"`
	IsBundleRoot        bool            `json:"is_bundle_root"`
	SwarmConfig         json.RawMessage `json:"swarm_config"`
	MaxRetries          int             `json:"max_retries"`
	BackoffStrategy     string          `json:"backoff_strategy"`
}

func apiCreateTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	userTier := getUserTier(c)
	if err := CheckUserQuota(c.Request().Context(), userID, userTier); err != nil {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: err.Error()})
	}

	var req CreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	var workspaceID pgtype.UUID
	if req.WorkspaceID != "" {
		var err error
		workspaceID, err = mustParseUUID(c, req.WorkspaceID)
		if err != nil {
			return err
		}
	}

	var dependsOnTaskID pgtype.UUID
	if req.DependsOnTaskID != "" {
		var err error
		dependsOnTaskID, err = mustParseUUID(c, req.DependsOnTaskID)
		if err != nil {
			return err
		}

		// Verify ownership of the dependency
		exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
			ID:     dependsOnTaskID,
			UserID: userID,
		})
		if err != nil || !exists {
			return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Unauthorized dependency"})
		}
	}
	policy := req.MissedTaskPolicy
	if policy == "" {
		policy = "run_immediately"
	}

	params := db.CreateTaskParams{
		UserID:              userID,
		Name:                req.Name,
		TriggerType:         pgtype.Text{String: req.TriggerType, Valid: true},
		TriggerConfig:       req.TriggerConfig,
		AgentPrompt:         req.AgentPrompt,
		WorkspaceID:         workspaceID,
		TaskType:            pgtype.Text{String: req.TaskType, Valid: true},
		NativeCode:          pgtype.Text{String: req.NativeCode, Valid: true},
		MissedTaskPolicy:    pgtype.Text{String: policy, Valid: true},
		RequiresApproval:    pgtype.Bool{Bool: req.RequiresApproval, Valid: true},
		DependsOnTaskID:     dependsOnTaskID,
		TriggerOnCompletion: pgtype.Bool{Bool: req.TriggerOnCompletion, Valid: true},
		BranchCondition:     req.BranchCondition,
		LoopCondition:       req.LoopCondition,
		IsBundleRoot:        pgtype.Bool{Bool: req.IsBundleRoot, Valid: true},
		NextRun:             pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		SwarmConfig:         req.SwarmConfig,
		MaxRetries:          pgtype.Int4{Int32: int32(req.MaxRetries), Valid: true},
		BackoffStrategy:     pgtype.Text{String: req.BackoffStrategy, Valid: true},
	}

	task, err := queries.CreateTask(c.Request().Context(), params)
	if err != nil {
		log.Printf("Failed to create task: %v", err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create task"})
	}

	IncrementCachedTaskCount(c.Request().Context(), userID)

	// Audit Log
	taskIDStr := formatUUID(task.ID)
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.create",
		ResourceType: "task",
		ResourceID:   taskIDStr,
		Metadata: map[string]interface{}{
			"name": req.Name,
		},
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusCreated, APIResponse{Success: true, Data: task})
}

func apiListTasksHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	search := c.QueryParam("search")
	status := c.QueryParam("status")
	
	limitStr := c.QueryParam("limit")
	offsetStr := c.QueryParam("offset")
	
	limit := int32(50)
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 100 {
			limit = int32(parsed)
		}
	}
	
	offset := int32(0)
	if offsetStr != "" {
		if parsed, err := strconv.Atoi(offsetStr); err == nil && parsed >= 0 {
			offset = int32(parsed)
		}
	}

	sfKey := fmt.Sprintf("ListTasks:%s:%s:%s:%d:%d", userID, search, status, limit, offset)
	v, err, _ := CacheGroup.Do(sfKey, func() (interface{}, error) {
		tasks, err := queries.SearchUserTasks(c.Request().Context(), db.SearchUserTasksParams{
			UserID:    userID,
			Search:    search,
			Status:    status,
			LimitVal:  limit,
			OffsetVal: offset,
		})
		if err != nil {
			return nil, err
		}
		if tasks == nil {
			tasks = []db.SearchUserTasksRow{}
		}
		return tasks, nil
	})

	if err != nil {
		log.Printf("Failed to list tasks for user %s: %v", userID, err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to list tasks"})
	}

	tasks := v.([]db.SearchUserTasksRow)
	total := int64(0)
	if len(tasks) > 0 {
		total = tasks[0].TotalCount
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": tasks,
		"total": total,
	})
}

func apiGetTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	task, err := queries.GetTaskByID(c.Request().Context(), db.GetTaskByIDParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: task})
}

type BulkTasksRequest struct {
	Action  string   `json:"action"` // "delete", "pause", "resume"
	TaskIDs []string `json:"task_ids"`
}

func apiBulkTasksHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	var req BulkTasksRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if len(req.TaskIDs) == 0 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "No task IDs provided"})
	}

	successCount := 0
	for _, idStr := range req.TaskIDs {
		taskID, err := parseUUIDString(idStr)
		if err != nil {
			continue
		}
		
		ctx := c.Request().Context()
		switch req.Action {
		case "delete":
			if queries.DeleteTask(ctx, db.DeleteTaskParams{ID: taskID, UserID: userID}) == nil {
				successCount++
				DecrementCachedTaskCount(ctx, userID)
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

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.bulk_" + req.Action,
		ResourceType: "tasks",
		Metadata: map[string]interface{}{
			"requested_count": len(req.TaskIDs),
			"success_count":   successCount,
		},
	})

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"success_count": successCount,
			"action":        req.Action,
		},
	})
}

func parseUUIDString(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	err := u.Scan(s)
	return u, err
}

func apiPauseTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	err = queries.UpdateTaskStatusByUserID(c.Request().Context(), db.UpdateTaskStatusByUserIDParams{
		Status: pgtype.Text{String: "paused", Valid: true},
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to pause task"})
	}

	// Audit Log
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.pause",
		ResourceType: "task",
		ResourceID:   taskIDStr,
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task paused"})
}

func apiResumeTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	err = queries.UpdateTaskStatusByUserID(c.Request().Context(), db.UpdateTaskStatusByUserIDParams{
		Status: pgtype.Text{String: "active", Valid: true},
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to resume task"})
	}

	// Audit Log
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.resume",
		ResourceType: "task",
		ResourceID:   taskIDStr,
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task resumed"})
}

func apiDeleteTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	err = queries.DeleteTask(c.Request().Context(), db.DeleteTaskParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete task"})
	}

	DecrementCachedTaskCount(c.Request().Context(), userID)

	// Audit Log
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.delete",
		ResourceType: "task",
		ResourceID:   taskIDStr,
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task deleted"})
}

func apiTriggerTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	// Verify ownership
	exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to verify task ownership"})
	}
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	// Prevent triggering if already processing
	t, err := queries.GetTaskByID(c.Request().Context(), db.GetTaskByIDParams{
		ID:     taskID,
		UserID: userID,
	})
	if err == nil && t.Status.String == "processing" {
		return c.JSON(http.StatusConflict, APIResponse{Success: false, Error: "Task is already being processed"})
	}

	// Trigger via Redis Stream for high-throughput ingestion
	err = ProduceTaskTrigger(c.Request().Context(), userID, taskIDStr, nil)
	if err != nil {
		log.Printf("Failed to produce task trigger for %s: %v. Falling back to DB update.", taskIDStr, err)
		err = queries.UpdateTaskNextRun(c.Request().Context(), db.UpdateTaskNextRunParams{
			Status:  pgtype.Text{String: "active", Valid: true},
			NextRun: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
			ID:      taskID,
			UserID:  userID,
		})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to trigger task"})
		}
	}

	// Audit Log
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.trigger",
		ResourceType: "task",
		ResourceID:   taskIDStr,
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task triggered immediately"})
}

type UpdateTaskRequest struct {
	Name                *string          `json:"name"`
	WorkspaceID         *string          `json:"workspace_id"`
	TaskType            *string          `json:"task_type"`
	AgentPrompt         *string          `json:"agent_prompt"`
	NativeCode          *string          `json:"native_code"`
	TriggerType         *string          `json:"trigger_type"`
	TriggerConfig       json.RawMessage  `json:"trigger_config"`
	RequiresApproval    *bool            `json:"requires_approval"`
	MissedTaskPolicy    *string          `json:"missed_task_policy"`
	UICoordinates       json.RawMessage  `json:"ui_coordinates"`
	DependsOnTaskID     *string          `json:"depends_on_task_id"`
	TriggerOnCompletion *bool            `json:"trigger_on_completion"`
	BranchCondition     json.RawMessage  `json:"branch_condition"`
	LoopCondition       json.RawMessage  `json:"loop_condition"`
	SwarmConfig         json.RawMessage  `json:"swarm_config"`
	MaxRetries          *int             `json:"max_retries"`
	BackoffStrategy     *string          `json:"backoff_strategy"`
}

func apiUpdateTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	var req UpdateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	ctx := c.Request().Context()
	tx, err := dbPool.Begin(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to start transaction"})
	}
	defer tx.Rollback(ctx)

	qtx := queries.WithTx(tx)

	// Fetch existing task to merge parameters (preventing partial updates from overwriting with default values)
	existing, err := qtx.GetTaskByID(ctx, db.GetTaskByIDParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	// Auto-snapshot before update
	if _, err := qtx.CreateTaskVersion(ctx, db.CreateTaskVersionParams{
		ID:     taskID,
		UserID: userID,
	}); err != nil {
		log.Printf("Warning: Failed to create task version snapshot for %s: %v", taskIDStr, err)
	}

	// Merge fields
	name := existing.Name
	if req.Name != nil {
		name = *req.Name
	}
	taskType := existing.TaskType.String
	if req.TaskType != nil {
		taskType = *req.TaskType
	}
	agentPrompt := existing.AgentPrompt
	if req.AgentPrompt != nil {
		agentPrompt = *req.AgentPrompt
	}
	nativeCode := existing.NativeCode.String
	if req.NativeCode != nil {
		nativeCode = *req.NativeCode
	}
	triggerType := existing.TriggerType.String
	if req.TriggerType != nil {
		triggerType = *req.TriggerType
	}
	triggerConfig := existing.TriggerConfig
	if len(req.TriggerConfig) > 0 {
		triggerConfig = req.TriggerConfig
	}
	requiresApproval := existing.RequiresApproval.Bool
	if req.RequiresApproval != nil {
		requiresApproval = *req.RequiresApproval
	}
	missedPolicy := existing.MissedTaskPolicy.String
	if req.MissedTaskPolicy != nil {
		missedPolicy = *req.MissedTaskPolicy
	}
	uiCoordinates := existing.UiCoordinates
	if len(req.UICoordinates) > 0 {
		uiCoordinates = req.UICoordinates
	}
	triggerOnCompletion := existing.TriggerOnCompletion.Bool
	if req.TriggerOnCompletion != nil {
		triggerOnCompletion = *req.TriggerOnCompletion
	}
	branchCondition := existing.BranchCondition
	if len(req.BranchCondition) > 0 {
		branchCondition = req.BranchCondition
	}
	loopCondition := existing.LoopCondition
	if len(req.LoopCondition) > 0 {
		loopCondition = req.LoopCondition
	}
	swarmConfig := existing.SwarmConfig
	if len(req.SwarmConfig) > 0 {
		swarmConfig = req.SwarmConfig
	}
	maxRetries := existing.MaxRetries.Int32
	if req.MaxRetries != nil {
		maxRetries = int32(*req.MaxRetries)
	}
	backoffStrategy := existing.BackoffStrategy.String
	if req.BackoffStrategy != nil {
		backoffStrategy = *req.BackoffStrategy
	}

	workspaceID := existing.WorkspaceID
	if req.WorkspaceID != nil {
		if *req.WorkspaceID == "" {
			workspaceID = pgtype.UUID{Valid: false}
		} else {
			uuidVal, err := mustParseUUID(c, *req.WorkspaceID)
			if err != nil {
				return err
			}
			workspaceID = uuidVal
		}
	}

	dependsOnTaskID := existing.DependsOnTaskID
	if req.DependsOnTaskID != nil {
		if *req.DependsOnTaskID == "" {
			dependsOnTaskID = pgtype.UUID{Valid: false}
		} else {
			if *req.DependsOnTaskID == taskIDStr {
				return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "A task cannot depend on itself"})
			}
			uuidVal, err := mustParseUUID(c, *req.DependsOnTaskID)
			if err != nil {
				return err
			}
			dependsOnTaskID = uuidVal

			// Verify ownership of the dependency
			exists, err := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{
				ID:     dependsOnTaskID,
				UserID: userID,
			})
			if err != nil || !exists {
				return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Unauthorized dependency"})
			}
		}
	}

	// Use manual SQL to ensure all fields are updated since sqlc isn't available to regenerate
	query := `
		UPDATE tasks
		SET name = $1,
		    workspace_id = $2,
		    task_type = $3,
		    agent_prompt = $4,
		    native_code = $5,
		    trigger_type = $6,
		    trigger_config = $7,
		    requires_approval = $8,
		    missed_task_policy = $9,
		    ui_coordinates = $10,
		    depends_on_task_id = $11,
		    trigger_on_completion = $12,
		    branch_condition = $13,
		    loop_condition = $14,
		    swarm_config = $15,
		    max_retries = $16,
		    backoff_strategy = $17
		WHERE id = $18 AND user_id = $19`

	_, err = tx.Exec(ctx, query,
		name,
		workspaceID,
		pgtype.Text{String: taskType, Valid: true},
		agentPrompt,
		pgtype.Text{String: nativeCode, Valid: nativeCode != ""},
		pgtype.Text{String: triggerType, Valid: triggerType != ""},
		triggerConfig,
		pgtype.Bool{Bool: requiresApproval, Valid: true},
		pgtype.Text{String: missedPolicy, Valid: true},
		uiCoordinates,
		dependsOnTaskID,
		pgtype.Bool{Bool: triggerOnCompletion, Valid: true},
		branchCondition,
		loopCondition,
		swarmConfig,
		maxRetries,
		pgtype.Text{String: backoffStrategy, Valid: true},
		taskID,
		userID,
	)

	if err != nil {
		log.Printf("Failed to update task: %v", err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update task"})
	}

	if err := tx.Commit(ctx); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to commit transaction"})
	}

	// Audit Log
	writeAuditLog(ctx, AuditEvent{
		UserID:       userID,
		Action:       "task.update",
		ResourceType: "task",
		ResourceID:   taskIDStr,
	})

	_ = PublishEvent(ctx, PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task updated"})
}
func apiListTaskVersionsHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	// Check ownership first
	exists, _ := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{ID: taskID, UserID: userID})
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	versions, err := queries.ListTaskVersions(c.Request().Context(), taskID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to list versions"})
	}
	if versions == nil {
		versions = []db.TaskVersion{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: versions})
}

func apiRestoreTaskVersionHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	versionIDStr := c.Param("version_id")

	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}
	versionID, err := mustParseUUID(c, versionIDStr)
	if err != nil {
		return err
	}

	ctx := c.Request().Context()
	tx, err := dbPool.Begin(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to start transaction"})
	}
	defer tx.Rollback(ctx)

	qtx := queries.WithTx(tx)

	// 1. Create a snapshot of CURRENT state before rolling back
	if _, err := qtx.CreateTaskVersion(ctx, db.CreateTaskVersionParams{
		ID:     taskID,
		UserID: userID,
	}); err != nil {
		log.Printf("Warning: Failed to create current state snapshot before restore for %s: %v", taskIDStr, err)
	}

	// 2. Restore
	err = qtx.RestoreTaskFromVersion(ctx, db.RestoreTaskFromVersionParams{
		ID:     taskID,
		UserID: userID,
		ID_2:   versionID, // ID_2 is the version ID in RestoreTaskFromVersionParams
	})
	if err != nil {
		log.Printf("Restore failed: %v", err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Restore failed"})
	}

	if err := tx.Commit(ctx); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to commit transaction"})
	}

	// Audit Log
	writeAuditLog(ctx, AuditEvent{
		UserID:       userID,
		Action:       "task.restore_version",
		ResourceType: "task",
		ResourceID:   taskIDStr,
		Metadata: map[string]interface{}{
			"version_id": versionIDStr,
		},
	})

	_ = PublishEvent(ctx, PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task restored successfully"})
}

type LinkTaskRequest struct {
	DependsOnTaskID     string `json:"depends_on_task_id"`
	TriggerOnCompletion bool   `json:"trigger_on_completion"`
}

func apiLinkTaskHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	var req LinkTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	var dependsOnTaskID pgtype.UUID
	if req.DependsOnTaskID != "" {
		if req.DependsOnTaskID == taskIDStr {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "A task cannot depend on itself"})
		}
		var err error
		dependsOnTaskID, err = mustParseUUID(c, req.DependsOnTaskID)
		if err != nil {
			return err
		}

		// Verify ownership of the dependency
		exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
			ID:     dependsOnTaskID,
			UserID: userID,
		})
		if err != nil || !exists {
			return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Unauthorized dependency"})
		}
	}

	err = queries.LinkTaskDependency(c.Request().Context(), db.LinkTaskDependencyParams{
		DependsOnTaskID:     dependsOnTaskID,
		TriggerOnCompletion: pgtype.Bool{Bool: req.TriggerOnCompletion, Valid: true},
		ID:                  taskID,
		UserID:              userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to link tasks"})
	}

	// Audit Log
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.link",
		ResourceType: "task",
		ResourceID:   taskIDStr,
		Metadata: map[string]interface{}{
			"depends_on": req.DependsOnTaskID,
		},
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "task_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Tasks linked successfully"})
}

func apiGetExecutionTracesHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	executionID := c.Param("execution_id")

	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	// Check ownership
	exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to verify task ownership"})
	}
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	// Try reading from Redis list buffer first
	key := fmt.Sprintf("logs:%s:%s", taskIDStr, executionID)
	if RedisClient != nil {
		count, err := RedisClient.LLen(c.Request().Context(), key).Result()
		if err == nil && count > 0 {
			dataList, err := RedisClient.LRange(c.Request().Context(), key, 0, -1).Result()
			if err == nil && len(dataList) > 0 {
				var traces []db.ExecutionTrace
				for _, jsonStr := range dataList {
					var t db.ExecutionTrace
					if err := json.Unmarshal([]byte(jsonStr), &t); err == nil {
						traces = append(traces, t)
					}
				}
				if len(traces) > 0 {
					return c.JSON(http.StatusOK, APIResponse{Success: true, Data: traces})
				}
			}
		}
	}

	// Fallback to DB
	traces, err := queries.ListExecutionTracesByExecutionID(c.Request().Context(), db.ListExecutionTracesByExecutionIDParams{
		TaskID:      taskID,
		ExecutionID: executionID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch execution traces"})
	}
	if traces == nil {
		traces = []db.ExecutionTrace{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: traces})
}

func apiListTaskExecutionsHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")

	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	// Check ownership
	exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to verify task ownership"})
	}
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	executions, err := queries.ListTaskExecutionIDs(c.Request().Context(), taskID)
	if err != nil {
		log.Printf("ListTaskExecutionIDs query failed for task %s: %v", taskIDStr, err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch task executions: " + err.Error()})
	}
	if executions == nil {
		executions = []db.ListTaskExecutionIDsRow{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: executions})
}

type ManualRouteRequest struct {
	TargetTaskID string `json:"target_task_id"`
}

func apiManualRouteHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	taskIDStr := c.Param("id")
	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	var req ManualRouteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	targetTaskID, err := mustParseUUID(c, req.TargetTaskID)
	if err != nil {
		return err
	}

	// 1. Verify source task ownership and state
	task, err := queries.GetTaskByID(c.Request().Context(), db.GetTaskByIDParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	if task.LastApprovalStatus.String != "needs_routing" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Task is not in needs_routing state"})
	}

	// 2. Verify target task ownership and dependency
	targetTask, err := queries.GetTaskByID(c.Request().Context(), db.GetTaskByIDParams{
		ID:     targetTaskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Target task not found"})
	}

	if !targetTask.DependsOnTaskID.Valid || formatUUID(targetTask.DependsOnTaskID) != taskIDStr {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Target task does not depend on source task"})
	}

	// 3. Update target task to active and next_run = NOW()
	err = queries.UpdateTaskNextRun(c.Request().Context(), db.UpdateTaskNextRunParams{
		Status:  pgtype.Text{String: "active", Valid: true},
		NextRun: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ID:      targetTaskID,
		UserID:  userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to trigger target task"})
	}

	// 4. Mark source task as completed (or approved)
	err = queries.UpdateTaskApprovalStatusAndLastRun(c.Request().Context(), db.UpdateTaskApprovalStatusAndLastRunParams{
		LastApprovalStatus: pgtype.Text{String: "manual_routed", Valid: true},
		Status:             pgtype.Text{String: "completed", Valid: true},
		ID:                 taskID,
		UserID:             userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update source task"})
	}

	// Audit Log
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       userID,
		Action:       "task.manual_route",
		ResourceType: "task",
		ResourceID:   taskIDStr,
		Metadata: map[string]interface{}{
			"target_task_id": req.TargetTaskID,
		},
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task manually routed"})
}

// apiLockTaskHandler locks a task node for editing in Redis.
func apiLockTaskHandler(c echo.Context) error {
	ctx := c.Request().Context()
	taskIDStr := c.Param("id")
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	if RedisClient == nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true})
	}

	email := userID
	user, err := queries.GetUser(ctx, userID)
	if err == nil && user.Email.Valid {
		email = user.Email.String
	}

	key := fmt.Sprintf("lock:edit:task:%s", taskIDStr)
	acquired, err := RedisClient.SetNX(ctx, key, email, 15*time.Second).Result()
	if err != nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true})
	}

	if !acquired {
		currentOwner, _ := RedisClient.Get(ctx, key).Result()
		if currentOwner != email {
			return c.JSON(http.StatusOK, APIResponse{
				Success: false,
				Error:   fmt.Sprintf("Node is currently locked by another administrator: %s", currentOwner),
			})
		}
		_ = RedisClient.Expire(ctx, key, 15*time.Second).Err()
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true})
}

// apiUnlockTaskHandler unlocks a task node.
func apiUnlockTaskHandler(c echo.Context) error {
	ctx := c.Request().Context()
	taskIDStr := c.Param("id")
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	if RedisClient == nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true})
	}

	email := userID
	user, err := queries.GetUser(ctx, userID)
	if err == nil && user.Email.Valid {
		email = user.Email.String
	}

	key := fmt.Sprintf("lock:edit:task:%s", taskIDStr)
	releaseScript := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	_, _ = RedisClient.Eval(ctx, releaseScript, []string{key}, email).Result()

	return c.JSON(http.StatusOK, APIResponse{Success: true})
}

