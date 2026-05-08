package main

import (
	"time"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	APIKey       string    `json:"api_key"`
	Role         string    `json:"role"`
	Tier         string    `json:"tier"`
	CreatedAt    time.Time `json:"created_at"`
}

// Task represents a scheduled task in the database
type Task struct {
	ID                 string    `json:"id"`
	UserID             string    `json:"user_id"`
	Name               string    `json:"name"`
	TriggerType        string    `json:"trigger_type"`
	TriggerConfig      []byte    `json:"trigger_config"` // JSONB
	AgentPrompt        string    `json:"agent_prompt"`
	Status             string    `json:"status"`
	NextRun            time.Time `json:"next_run"`
	FailureCount       int       `json:"failure_count"`
	MissedTaskPolicy   string    `json:"missed_task_policy"`
	DependsOnTaskID    *string   `json:"depends_on_task_id"`
}
