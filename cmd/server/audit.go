package main

import (
	"context"
	"encoding/json"
	"log"
)

type AuditEvent struct {
	UserID       string
	Action       string
	ResourceType string
	ResourceID   string
	Metadata     map[string]interface{}
}

type AuditLogEntry struct {
	ID           string                 `json:"id"`
	UserID       *string                `json:"user_id,omitempty"`
	Action       string                 `json:"action"`
	ResourceType string                 `json:"resource_type"`
	ResourceID   *string                `json:"resource_id,omitempty"`
	Metadata     map[string]interface{} `json:"metadata"`
	CreatedAt    string                 `json:"created_at"`
}

func writeAuditLog(ctx context.Context, event AuditEvent) {
	if dbPool == nil {
		return
	}
	metadata := event.Metadata
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		log.Printf("Failed to marshal audit log metadata for action %s: %v", event.Action, err)
		return
	}

	_, err = dbPool.Exec(ctx, `
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
VALUES (NULLIF($1, ''), $2, $3, NULLIF($4, ''), $5::jsonb)
`, event.UserID, event.Action, event.ResourceType, event.ResourceID, string(payload))
	if err != nil {
		log.Printf("Failed to write audit log for action %s: %v", event.Action, err)
	}
}
