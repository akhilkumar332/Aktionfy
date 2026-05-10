package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"schedule-mcp/db"
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
}

type ImportTasksRequest struct {
	Tasks []TransferTask `json:"tasks"`
}

func exportUserTasks(ctx context.Context, userID string) ([]TransferTask, error) {
	rows, err := dbPool.Query(ctx, `
SELECT id::text, name, trigger_type, trigger_config::text, agent_prompt, missed_task_policy, requires_approval,
       COALESCE(depends_on_task_id::text, ''), trigger_on_completion
FROM tasks
WHERE user_id = $1
ORDER BY created_at ASC
`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []TransferTask
	for rows.Next() {
		var task TransferTask
		var triggerConfigText string
		if err := rows.Scan(
			&task.LegacyID,
			&task.Name,
			&task.TriggerType,
			&triggerConfigText,
			&task.AgentPrompt,
			&task.MissedTaskPolicy,
			&task.RequiresApproval,
			&task.DependsOnLegacyID,
			&task.TriggerOnCompletion,
		); err != nil {
			return nil, err
		}
		task.TriggerConfig = json.RawMessage(triggerConfigText)
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
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
		if task.AgentPrompt == "" {
			return nil, fmt.Errorf("task %d: agent_prompt is required", idx)
		}
		missedPolicy := task.MissedTaskPolicy
		if missedPolicy == "" {
			missedPolicy = PolicySkip
		}

		var triggerConfig map[string]interface{}
		if err := json.Unmarshal(task.TriggerConfig, &triggerConfig); err != nil {
			return nil, fmt.Errorf("task %d: invalid trigger_config: %w", idx, err)
		}

		nextRun, err := calculateNextRun(task.TriggerType, triggerConfig, time.Now().UTC())
		if err != nil {
			return nil, fmt.Errorf("task %d: invalid schedule: %w", idx, err)
		}

		triggerConfigBytes, _ := json.Marshal(triggerConfig)
		createdTask, err := queries.CreateTask(ctx, db.CreateTaskParams{
			UserID:              userID,
			Name:                task.Name,
			TriggerType:         pgtype.Text{String: task.TriggerType, Valid: true},
			TriggerConfig:       triggerConfigBytes,
			AgentPrompt:         task.AgentPrompt,
			MissedTaskPolicy:    pgtype.Text{String: missedPolicy, Valid: true},
			NextRun:             pgtype.Timestamptz{Time: nextRun, Valid: true},
			RequiresApproval:    pgtype.Bool{Bool: task.RequiresApproval, Valid: true},
			TriggerOnCompletion: pgtype.Bool{Bool: task.TriggerOnCompletion, Valid: true},
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
		if _, err := dbPool.Exec(ctx, `
UPDATE tasks
SET depends_on_task_id = $1, trigger_on_completion = $2
WHERE id = $3 AND user_id = $4
`, parentID, task.TriggerOnCompletion, childID, userID); err != nil {
			return nil, fmt.Errorf("failed to link imported dependency for %q: %w", task.LegacyID, err)
		}
	}

	return createdString, nil
}
