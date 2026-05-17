package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type TransferTask struct {
	LegacyID            string          `json:"legacy_id,omitempty"`
	Name                string          `json:"name"`
	TriggerType         string          `json:"trigger_type"`
	TriggerConfig       json.RawMessage `json:"trigger_config"`
	AgentPrompt         string          `json:"agent_prompt"`
	MissedTaskPolicy    string          `json:"missed_task_policy"`
	RequiresApproval    bool            `json:"requires_approval"`
	DependsOnLegacyID   string          `json:"depends_on_legacy_id,omitempty"`
	TriggerOnCompletion bool            `json:"trigger_on_completion"`
	TaskType            string          `json:"task_type"`
	NativeCode          string          `json:"native_code"`
	BranchCondition     json.RawMessage `json:"branch_condition"`
	IsBundleRoot        bool            `json:"is_bundle_root"`
	SwarmConfig         json.RawMessage `json:"swarm_config"`
}

type ImportTasksRequest struct {
	Tasks []TransferTask `json:"tasks"`
}

func exportUserTasks(ctx context.Context, userID string) ([]TransferTask, error) {
	rows, err := queries.ExportUserTasks(ctx, userID)
	if err != nil {
		return nil, err
	}

	var tasks []TransferTask
	for _, row := range rows {
		task := TransferTask{
			LegacyID:            formatUUID(row.ID),
			Name:                row.Name,
			TriggerType:         row.TriggerType.String,
			TriggerConfig:       row.TriggerConfig,
			AgentPrompt:         row.AgentPrompt,
			MissedTaskPolicy:    row.MissedTaskPolicy.String,
			RequiresApproval:    row.RequiresApproval.Bool,
			TriggerOnCompletion: row.TriggerOnCompletion.Bool,
			TaskType:            row.TaskType.String,
			NativeCode:          row.NativeCode.String,
			BranchCondition:     row.BranchCondition,
			IsBundleRoot:        row.IsBundleRoot.Bool,
			SwarmConfig:         row.SwarmConfig,
		}
		if row.DependsOnTaskID.Valid {
			task.DependsOnLegacyID = formatUUID(row.DependsOnTaskID)
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}

func importUserTasks(ctx context.Context, userID string, tasks []TransferTask) (map[string]string, error) {
	if len(tasks) == 0 {
		return map[string]string{}, nil
	}

	created := make(map[string]pgtype.UUID)
	createdString := make(map[string]string)

	for idx, task := range tasks {
		if task.Name == "" {
			return nil, fmt.Errorf("task %d: name is required", idx)
		}
		if task.TriggerType == "" {
			return nil, fmt.Errorf("task %d: trigger_type is required", idx)
		}
		
		missedPolicy := task.MissedTaskPolicy
		if missedPolicy == "" {
			missedPolicy = "run_immediately"
		}

		var triggerConfig map[string]interface{}
		if err := json.Unmarshal(task.TriggerConfig, &triggerConfig); err != nil {
			return nil, fmt.Errorf("task %d: invalid trigger_config: %w", idx, err)
		}

		nextRun, err := calculateNextRun(task.TriggerType, triggerConfig, time.Now().UTC())
		if err != nil {
			return nil, fmt.Errorf("task %d: invalid schedule: %w", idx, err)
		}

		createdTask, err := queries.CreateTask(ctx, db.CreateTaskParams{
			UserID:              userID,
			Name:                task.Name,
			TriggerType:         pgtype.Text{String: task.TriggerType, Valid: true},
			TriggerConfig:       task.TriggerConfig,
			AgentPrompt:         task.AgentPrompt,
			MissedTaskPolicy:    pgtype.Text{String: missedPolicy, Valid: true},
			NextRun:             pgtype.Timestamptz{Time: nextRun, Valid: true},
			RequiresApproval:    pgtype.Bool{Bool: task.RequiresApproval, Valid: true},
			TriggerOnCompletion: pgtype.Bool{Bool: task.TriggerOnCompletion, Valid: true},
			TaskType:            pgtype.Text{String: task.TaskType, Valid: task.TaskType != ""},
			NativeCode:          pgtype.Text{String: task.NativeCode, Valid: task.NativeCode != ""},
			BranchCondition:     task.BranchCondition,
			IsBundleRoot:        pgtype.Bool{Bool: task.IsBundleRoot, Valid: true},
			SwarmConfig:         task.SwarmConfig,
		})
		if err != nil {
			return nil, fmt.Errorf("task %d: create failed: %w", idx, err)
		}

		if task.LegacyID != "" {
			created[task.LegacyID] = createdTask.ID
			createdString[task.LegacyID] = formatUUID(createdTask.ID)
		}
	}

	for _, task := range tasks {
		if task.LegacyID == "" || task.DependsOnLegacyID == "" {
			continue
		}
		childID, ok := created[task.LegacyID]
		if !ok {
			continue
		}
		parentID, ok := created[task.DependsOnLegacyID]
		if !ok {
			return nil, fmt.Errorf("dependency %q for task %q was not included in the import bundle", task.DependsOnLegacyID, task.LegacyID)
		}

		err := queries.LinkTaskDependency(ctx, db.LinkTaskDependencyParams{
			DependsOnTaskID:     pgtype.UUID{Bytes: parentID.Bytes, Valid: true},
			TriggerOnCompletion: pgtype.Bool{Bool: task.TriggerOnCompletion, Valid: true},
			ID:                  childID,
			UserID:              userID,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to link imported dependency for %q: %w", task.LegacyID, err)
		}
	}

	return createdString, nil
}
