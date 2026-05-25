package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
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
	if RedisClient == nil {
		if dbPool == nil {
			return
		}
		metadata := event.Metadata
		if metadata == nil {
			metadata = map[string]interface{}{}
		}
		payload, err := json.Marshal(metadata)
		if err != nil {
			log.Printf("Failed to marshal audit log metadata: %v", err)
			return
		}

		_ = queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
			UserID:       pgtype.Text{String: event.UserID, Valid: event.UserID != ""},
			Action:       event.Action,
			ResourceType: event.ResourceType,
			ResourceID:   pgtype.Text{String: event.ResourceID, Valid: event.ResourceID != ""},
			Metadata:     payload,
		})
		return
	}

	eventBytes, _ := json.Marshal(event)
	err := RedisClient.RPush(ctx, "buffer:audit_logs", eventBytes).Err()
	if err != nil {
		log.Printf("Failed to buffer audit log to Redis: %v", err)
	}
}

func StartAuditLogFlusher(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				flushAuditLogs(ctx)
			}
		}
	}()
}

func flushAuditLogs(ctx context.Context) {
	if RedisClient == nil || dbPool == nil {
		return
	}

	for i := 0; i < 100; i++ {
		res, err := RedisClient.LPop(ctx, "buffer:audit_logs").Result()
		if err != nil {
			break
		}

		var event AuditEvent
		if err := json.Unmarshal([]byte(res), &event); err != nil {
			log.Printf("Failed to unmarshal buffered audit log: %v", err)
			continue
		}

		metadata := event.Metadata
		if metadata == nil {
			metadata = map[string]interface{}{}
		}
		payload, _ := json.Marshal(metadata)

		_ = queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
			UserID:       pgtype.Text{String: event.UserID, Valid: event.UserID != ""},
			Action:       event.Action,
			ResourceType: event.ResourceType,
			ResourceID:   pgtype.Text{String: event.ResourceID, Valid: event.ResourceID != ""},
			Metadata:     payload,
		})
	}
}

type bufferedLoginHistory struct {
	UserID    string `json:"user_id"`
	IpAddress string `json:"ip_address"`
	UserAgent string `json:"user_agent"`
	Success   bool   `json:"success"`
}

func StartLoginHistoryFlusher(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				flushLoginHistory(ctx)
			}
		}
	}()
}

func flushLoginHistory(ctx context.Context) {
	if RedisClient == nil || dbPool == nil {
		return
	}

	for i := 0; i < 100; i++ {
		res, err := RedisClient.LPop(ctx, "buffer:login_history").Result()
		if err != nil {
			break
		}

		var event bufferedLoginHistory
		if err := json.Unmarshal([]byte(res), &event); err != nil {
			log.Printf("Failed to unmarshal buffered login history: %v", err)
			continue
		}

		status := "failed"
		if event.Success {
			status = "success"
		}

		_ = queries.CreateLoginHistory(ctx, db.CreateLoginHistoryParams{
			UserID:    event.UserID,
			IpAddress: pgtype.Text{String: event.IpAddress, Valid: true},
			UserAgent: pgtype.Text{String: event.UserAgent, Valid: true},
			Status:    status,
		})
	}
}

func writeLoginHistory(ctx context.Context, userID, ipAddress, userAgent string, success bool) {
	status := "failed"
	if success {
		status = "success"
	}
	
	if RedisClient == nil {
		if dbPool == nil {
			return
		}
		_ = queries.CreateLoginHistory(ctx, db.CreateLoginHistoryParams{
			UserID:    userID,
			IpAddress: pgtype.Text{String: ipAddress, Valid: true},
			UserAgent: pgtype.Text{String: userAgent, Valid: true},
			Status:    status,
		})
		return
	}

	event := bufferedLoginHistory{
		UserID:    userID,
		IpAddress: ipAddress,
		UserAgent: userAgent,
		Success:   success,
	}
	eventBytes, _ := json.Marshal(event)
	_ = RedisClient.RPush(ctx, "buffer:login_history", eventBytes).Err()
}
