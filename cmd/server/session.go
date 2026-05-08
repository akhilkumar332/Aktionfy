package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/redis/go-redis/v9"
)

// GlobalSessionManager tracks which users have active SSE connections via Redis
var GlobalSessionManager = &SessionManager{}

type SessionManager struct {
	redisClient *redis.Client
}

func (sm *SessionManager) Init(client *redis.Client) {
	sm.redisClient = client
}

// AddUser sets a heartbeat in Redis that expires after 30 seconds
func (sm *SessionManager) AddUser(ctx context.Context, userID string) {
	if sm.redisClient == nil {
		return
	}
	err := sm.redisClient.Set(ctx, fmt.Sprintf("session:%s", userID), "active", 30*time.Second).Err()
	if err != nil {
		log.Printf("Failed to set session for user %s: %v", userID, err)
	}
}

// RemoveUser removes the heartbeat from Redis
func (sm *SessionManager) RemoveUser(ctx context.Context, userID string) {
	if sm.redisClient == nil {
		return
	}
	sm.redisClient.Del(ctx, fmt.Sprintf("session:%s", userID))
}

// IsOnline checks if a user has an active heartbeat in Redis
func (sm *SessionManager) IsOnline(ctx context.Context, userID string) bool {
	if sm.redisClient == nil {
		return false
	}
	val, err := sm.redisClient.Get(ctx, fmt.Sprintf("session:%s", userID)).Result()
	if err == redis.Nil {
		return false
	} else if err != nil {
		log.Printf("Failed to check session for user %s: %v", userID, err)
		return false
	}
	return val == "active"
}

// Heartbeat Loop - Keeps the session active in Redis while the SSE connection is open
// Also subscribes to Pub/Sub to listen for remote task triggers
func (sm *SessionManager) MaintainHeartbeat(ctx context.Context, userID string, mcpServer *server.MCPServer) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	
	sm.AddUser(ctx, userID)
	
	// Subscribe to tasks meant for this user
	pubsub := sm.redisClient.Subscribe(context.Background(), fmt.Sprintf("trigger_task:%s", userID))
	defer pubsub.Close()
	
	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			// The HTTP request was cancelled (connection closed)
			// Use a new context to remove the user since the request ctx is cancelled
			sm.RemoveUser(context.Background(), userID)
			return
		case <-ticker.C:
			sm.AddUser(ctx, userID)
		case msg := <-ch:
			// Received a task trigger from another node
			// We execute it here because we have the physical SSE connection
			log.Printf("Received Pub/Sub task trigger for user %s on node", userID)
			
			// Fire the sampling request asynchronously
			go func(payload string) {
				sampleCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				
				var taskData map[string]string
				if err := json.Unmarshal([]byte(payload), &taskData); err != nil {
					log.Printf("Failed to unmarshal pubsub payload: %v", err)
					return
				}
				
				taskID := taskData["task_id"]
				prompt := taskData["prompt"]
				executionID := taskData["execution_id"]

				// Phase 10.1: Prevent Double Execution if user is connected from multiple terminals
				locked, err := sm.redisClient.SetNX(sampleCtx, fmt.Sprintf("lock:exec:%s", executionID), "locked", 5*time.Minute).Result()
				if err != nil || !locked {
					log.Printf("Task %s already executed by another connection for user %s", taskID, userID)
					return
				}

				req := mcp.CreateMessageRequest{
					CreateMessageParams: mcp.CreateMessageParams{
						Messages: []mcp.SamplingMessage{
							{Role: "user", Content: mcp.TextContent{Type: "text", Text: prompt}},
						},
						MaxTokens: 1000,
					},
				}

				// Phase 7.2: Real LLM Response Handling
				res, err := mcpServer.RequestSampling(sampleCtx, req)
				if err != nil {
					log.Printf("Pub/Sub Sampling failed for user %s: %v", userID, err)
					
					// Phase 10.2: Properly log failure back to DB instead of failing silently
					dbCtx, dbCancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer dbCancel()
					
					_, _ = dbPool.Exec(dbCtx, "INSERT INTO task_logs (task_id, user_id, status, error_message) VALUES ($1, $2, 'failure', $3)", taskID, userID, err.Error())
					
					// Increment failure count securely
					var currentFailures int
					_ = dbPool.QueryRow(dbCtx, "UPDATE tasks SET failure_count = failure_count + 1 WHERE id = $1 RETURNING failure_count", taskID).Scan(&currentFailures)
					
					if currentFailures >= 3 {
						_, _ = dbPool.Exec(dbCtx, "UPDATE tasks SET status = $1 WHERE id = $2", StatusError, taskID)
						sendFailureEmail(dbCtx, userID, taskID, "Unknown Task") // Note: task name isn't passed via pubsub right now, but could be added
					}
					return
				}

				// Safely extract the LLM's text response
				llmResponse := "No response provided by LLM"
				if res != nil {
					// Convert response to JSON string for the log
					resBytes, _ := json.Marshal(res)
					llmResponse = string(resBytes)
				}

				log.Printf("Received LLM Response for user %s: %s", userID, llmResponse)
				
				// Save the actual LLM response to the specific task log
				_, _ = dbPool.Exec(context.Background(), "INSERT INTO task_logs (task_id, user_id, status, llm_response) VALUES ($1, $2, 'success', $3)", taskID, userID, llmResponse)

			}(msg.Payload)
		}
	}
}

// flushWriter is a simple wrapper to ensure SSE flushes
type flushWriter struct {
	http.ResponseWriter
}

func (fw *flushWriter) Write(p []byte) (n int, err error) {
	n, err = fw.ResponseWriter.Write(p)
	if flusher, ok := fw.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
	return
}
