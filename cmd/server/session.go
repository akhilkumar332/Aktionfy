package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/redis/go-redis/v9"
)

// GlobalSessionManager tracks which users have active SSE connections via Redis
var GlobalSessionManager = &SessionManager{
	mcpSessions: make(map[string]map[string]server.ClientSession),
}

type SessionManager struct {
	redisClient *redis.Client
	mu          sync.RWMutex
	mcpSessions map[string]map[string]server.ClientSession
}

func (sm *SessionManager) Init(client *redis.Client) {
	sm.redisClient = client
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if sm.mcpSessions == nil {
		sm.mcpSessions = make(map[string]map[string]server.ClientSession)
	}
}

// AddMCPSession stores the local in-memory MCP session
func (sm *SessionManager) AddMCPSession(userID string, session server.ClientSession) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if sm.mcpSessions[userID] == nil {
		sm.mcpSessions[userID] = make(map[string]server.ClientSession)
	}
	sm.mcpSessions[userID][session.SessionID()] = session
}

// RemoveMCPSession removes the local in-memory MCP session
func (sm *SessionManager) RemoveMCPSession(userID string, sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	if sm.mcpSessions[userID] != nil {
		delete(sm.mcpSessions[userID], sessionID)
		if len(sm.mcpSessions[userID]) == 0 {
			delete(sm.mcpSessions, userID)
		}
	}
}

// GetMCPSession retrieves an active local in-memory MCP session if it exists.
// If multiple sessions exist, it returns the first one (usually the bridge/CLI).
func (sm *SessionManager) GetMCPSession(userID string) server.ClientSession {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	if sessions, exists := sm.mcpSessions[userID]; exists {
		for _, s := range sessions {
			return s
		}
	}
	return nil
}

func (sm *SessionManager) GetActiveSessionCount(ctx context.Context) (int, error) {
	if sm.redisClient == nil {
		return 0, nil
	}
	// Only count bridge sessions as active actors
	iter := sm.redisClient.Scan(ctx, 0, "bridge:session:*", 0).Iterator()
	count := 0
	for iter.Next(ctx) {
		count++
	}
	return count, iter.Err()
}

// AddUser sets a heartbeat in Redis that expires after 30 seconds
func (sm *SessionManager) AddUser(ctx context.Context, userID string, isBridge bool) {
	if sm.redisClient == nil {
		return
	}
	ctx, span := otel.Tracer("session").Start(ctx, "AddUser")
	defer span.End()

	key := fmt.Sprintf("session:%s", userID)
	if isBridge {
		key = fmt.Sprintf("bridge:session:%s", userID)
	}

	err := sm.redisClient.Set(ctx, key, "active", 30*time.Second).Err()
	if err != nil {
		log.Printf("Failed to set session for user %s: %v", userID, err)
		span.RecordError(err)
	}
}

// RemoveUser removes the heartbeat from Redis
func (sm *SessionManager) RemoveUser(ctx context.Context, userID string, isBridge bool) {
	if sm.redisClient == nil {
		return
	}
	ctx, span := otel.Tracer("session").Start(ctx, "RemoveUser")
	defer span.End()

	key := fmt.Sprintf("session:%s", userID)
	if isBridge {
		key = fmt.Sprintf("bridge:session:%s", userID)
	}

	sm.redisClient.Del(ctx, key)
}

// IsOnline checks if a user has an active bridge heartbeat in Redis
func (sm *SessionManager) IsOnline(ctx context.Context, userID string) bool {
	if sm.redisClient == nil {
		return false
	}
	ctx, span := otel.Tracer("session").Start(ctx, "IsOnline")
	defer span.End()

	// Only bridge connections count as being "online" for the neural link status
	val, err := sm.redisClient.Get(ctx, fmt.Sprintf("bridge:session:%s", userID)).Result()
	if err == redis.Nil {
		return false
	} else if err != nil {
		log.Printf("Failed to check session for user %s: %v", userID, err)
		span.RecordError(err)
		return false
	}
	return val == "active"
}

// Heartbeat Loop - Keeps the session active in Redis while the SSE connection is open
// Also subscribes to Pub/Sub to listen for remote task triggers
func (sm *SessionManager) MaintainHeartbeat(ctx context.Context, userID string, mcpServer *server.MCPServer, isBridge bool) {
	if sm.redisClient == nil {
		log.Printf("Redis client not initialized in SessionManager")
		return
	}

	// Check per-user connection limit (max 10 connections)
	connCountKey := fmt.Sprintf("conn_count:%s", userID)
	count, err := sm.redisClient.Incr(ctx, connCountKey).Result()
	if err != nil {
		log.Printf("Error incrementing connection count for user %s: %v", userID, err)
	}
	sm.redisClient.Expire(ctx, connCountKey, 1*time.Minute)

	defer func() {
		// Use a background context for cleanup to ensure it runs even if parent is cancelled
		sm.redisClient.Decr(context.Background(), connCountKey)
	}()

	if count > 10 {
		log.Printf("User %s exceeded connection limit (%d). Rejecting SSE.", userID, count)
		return
	}

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	activeSSEConnections.Inc()
	defer activeSSEConnections.Dec()

	sm.AddUser(ctx, userID, isBridge)
	defer func() {
		// Use a background context for cleanup to ensure it runs even if parent is cancelled
		sm.RemoveUser(context.Background(), userID, isBridge)
	}()

	if !isBridge {
		// Non-bridge connections just stay open to keep the session alive
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				sm.AddUser(ctx, userID, isBridge)
			}
		}
	}

	var backoff time.Duration = 1 * time.Second
	for {
		// Subscribe to tasks meant for this user
		pubsub := sm.redisClient.Subscribe(ctx, fmt.Sprintf("trigger_task:%s", userID))

		// Wait for subscription confirmation
		_, err := pubsub.Receive(ctx)
		if err != nil {
			log.Printf("Failed to subscribe to Redis for user %s: %v. Retrying in %v...", userID, err, backoff)
			pubsub.Close()
			timer := time.NewTimer(backoff)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-timer.C:
				if backoff < 30*time.Second {
					backoff *= 2
				}
				continue
			}
		}

		// Reset backoff on successful subscription
		backoff = 1 * time.Second

		ch := pubsub.Channel()

		// Inner loop for processing messages
		shouldExit := false
		func() {
			defer pubsub.Close()
			for {
				select {
				case <-ctx.Done():
					shouldExit = true
					return
				case <-ticker.C:
					sm.AddUser(ctx, userID, isBridge)
					// Refresh connection count expiry
					sm.redisClient.Expire(ctx, connCountKey, 1*time.Minute)
				case msg, ok := <-ch:
					if !ok {
						log.Printf("Redis channel closed for user %s. Re-subscribing...", userID)
						return
					}
					// Received a task trigger from another node
					log.Printf("Received Pub/Sub task trigger for user %s", userID)

					// Fire the sampling request asynchronously
					workerWG.Add(1)
					go func(payload string) {
						defer workerWG.Done()
						defer func() {
							if r := recover(); r != nil {
								log.Printf("Panic recovered in task worker for user %s: %v", userID, r)
							}
						}()
						executionStart := time.Now()

						var taskData map[string]interface{}
						if err := json.Unmarshal([]byte(payload), &taskData); err != nil {
							log.Printf("Failed to unmarshal pubsub payload: %v", err)
							return
						}

						// Extract trace context
						var traceMap map[string]interface{}
						if tm, ok := taskData["trace_context"].(map[string]interface{}); ok {
							traceMap = tm
						}

						carrier := propagation.MapCarrier{}
						for k, v := range traceMap {
							if s, ok := v.(string); ok {
								carrier[k] = s
							}
						}
						// Use context.Background() but propagate the trace from the pubsub message.
						// This ensures the task finishes even if the user closes their browser (SSE cancels).
						parentCtx := otel.GetTextMapPropagator().Extract(context.Background(), carrier)

						// Create a background context with timeout for the entire execution
						ctx, span := otel.Tracer("aktionfy").Start(parentCtx, "Redis Task Trigger")
						defer span.End()

						taskID, ok1 := taskData["task_id"].(string)
						prompt, ok2 := taskData["prompt"].(string)
						executionID, ok3 := taskData["execution_id"].(string)

						if !ok1 || !ok2 || !ok3 || taskID == "" || prompt == "" || executionID == "" {
							missing := []string{}
							if !ok1 || taskID == "" { missing = append(missing, "task_id") }
							if !ok2 || prompt == "" { missing = append(missing, "prompt") }
							if !ok3 || executionID == "" { missing = append(missing, "execution_id") }
							
							errMsg := fmt.Sprintf("Missing critical fields in Pub/Sub payload: %v", missing)
							log.Printf("%s for user %s", errMsg, userID)
							span.RecordError(errors.New(errMsg))
							span.SetStatus(codes.Error, errMsg)
							return
						}

						span.SetAttributes(
							attribute.String("task_id", taskID),
							attribute.String("execution_id", executionID),
							attribute.String("user_id", userID),
						)
						triggerType, _ := taskData["trigger_type"].(string)
						triggerConfigStr, _ := taskData["trigger_config"].(string)
						triggerPayload, _ := taskData["trigger_payload"].(map[string]interface{})

						if triggerType == "" || triggerConfigStr == "" {
							errMsg := "Incomplete trigger data in Pub/Sub payload (missing trigger_type or trigger_config)"
							log.Printf("%s for user %s: %+v", errMsg, userID, taskData)
							span.RecordError(errors.New(errMsg))
							span.SetStatus(codes.Error, errMsg)
							return
						}

						var tid pgtype.UUID
						if err := parseUUID(taskID, &tid); err != nil {
							log.Printf("Invalid task ID received via Pub/Sub for user %s: %s", userID, taskID)
							span.RecordError(err)
							span.SetStatus(codes.Error, "invalid task uuid")
							return
						}

						// Keep DB operations alive across prompt resolution, sampling, and status updates.
						dbCtx, dbCancel := context.WithTimeout(ctx, 120*time.Second)
						defer dbCancel()

						t, err := queries.GetTaskByID(dbCtx, db.GetTaskByIDParams{
							ID:     tid,
							UserID: userID,
						})
						if err != nil {
							log.Printf("Failed to fetch task %s: %v", taskID, err)
							return
						}

						userEmail, err := queries.GetUserEmail(dbCtx, userID)
						emailStr := ""
						if err != nil {
							log.Printf("Error fetching user email for %s: %v", userID, err)
						} else if userEmail.Valid {
							emailStr = userEmail.String
						}

						if t.TaskType.String == TaskTypeDecisionRouter || t.TaskType.String == TaskTypeSwarmRouter {
							// Decision/Swarm Router logic:
							// 1. Get output of parent task
							parentOutput := ""
							if t.DependsOnTaskID.Valid {
								outBytes, err := queries.GetTaskOutput(dbCtx, db.GetTaskOutputParams{
									TaskID: t.DependsOnTaskID,
									UserID: userID,
								})
								if err != nil {
									log.Printf("Error fetching parent output for task %s: %v", taskID, err)
								} else {
									parentOutput = outBytes.String
								}
							}

							if t.TaskType.String == TaskTypeSwarmRouter {
								executeSwarmRouter(dbCtx, mcpServer, t, parentOutput)
							} else {
								executeDecisionRouter(dbCtx, mcpServer, t, parentOutput)
							}
							return
						}

						// 2. Resolve Prompt (Secrets + Chaining + Webhook Body)
						if _, err := queries.CreateExecutionTrace(dbCtx, db.CreateExecutionTraceParams{Metadata: nil, 
							TaskID:      tid,
							ExecutionID: executionID,
							WorkerID:    workerID,
							StepName:    "Prompt Resolution",
							InputData:   pgtype.Text{String: prompt, Valid: true},
						}); err != nil {
							log.Printf("Trace error for task %s: %v", taskID, err)
						}
						finalPrompt, secretCount, chained, err := resolvePrompt(dbCtx, userID, tid, executionID, prompt, t.DependsOnTaskID, triggerPayload)
						if err != nil {
							log.Printf("Prompt resolution failed for task %s: %v", taskID, err)
							if _, tErr := queries.CreateExecutionTrace(dbCtx, db.CreateExecutionTraceParams{Metadata: nil, 
								TaskID:       tid,
								ExecutionID:  executionID,
								WorkerID:     workerID,
								StepName:     "Prompt Resolution Failed",
								IsError:      pgtype.Bool{Bool: true, Valid: true},
								ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
							}); tErr != nil {
								log.Printf("Trace error for task %s: %v", taskID, tErr)
							}

							// Log failure to DB and update status
							queries.CreateTaskLog(dbCtx, db.CreateTaskLogParams{
								TaskID:       tid,
								UserID:       userID,
								Status:       "failure",
								ErrorMessage: pgtype.Text{String: fmt.Sprintf("Prompt resolution failed: %v", err), Valid: true},
							})
							queries.UpdateTaskStatusAndFailureCount(dbCtx, db.UpdateTaskStatusAndFailureCountParams{
								ID:     tid,
								UserID: userID,
								Status: pgtype.Text{String: "active", Valid: true}, // Reset to active so it can be retried or fixed
							})
							return
						} else {
							if _, err := queries.CreateExecutionTrace(dbCtx, db.CreateExecutionTraceParams{Metadata: nil, 
								TaskID:      tid,
								ExecutionID: executionID,
								WorkerID:    workerID,
								StepName:    "Prompt Resolution Success",
								OutputData:  pgtype.Text{String: maskSensitiveData(finalPrompt), Valid: true},
							}); err != nil {
								log.Printf("Trace error for task %s: %v", taskID, err)
							}
						}

						sampleCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
						defer cancel()

						// Phase 10.1: Check for local session before attempting to lock
						// This ensures only the node with the active SSE connection processes the task
						mcpSession := GlobalSessionManager.GetMCPSession(userID)
						if mcpSession == nil {
						        return
						}
						sampleCtx = mcpServer.WithContext(sampleCtx, mcpSession)

						// Phase 10.2: Prevent Double Execution if user is connected from multiple terminals
						locked, err := sm.redisClient.SetNX(sampleCtx, fmt.Sprintf("lock:exec:%s", executionID), "locked", 5*time.Minute).Result()
						if err != nil || !locked {
						        log.Printf("Task %s already executed by another connection for user %s", taskID, userID)
						        return
						}

						if _, err := queries.CreateExecutionTrace(dbCtx, db.CreateExecutionTraceParams{Metadata: nil, 
						        TaskID:      tid,
						        ExecutionID: executionID,
						        WorkerID:    workerID,
						        StepName:    "LLM Sampling",
						        InputData:   pgtype.Text{String: maskSensitiveData(finalPrompt), Valid: true},
						}); err != nil {
						        log.Printf("Trace error for task %s: %v", taskID, err)
						}

						req := mcp.CreateMessageRequest{							CreateMessageParams: mcp.CreateMessageParams{
								Messages: []mcp.SamplingMessage{
									{Role: "user", Content: mcp.TextContent{Type: "text", Text: finalPrompt}},
								},
								MaxTokens: 1000,
							},
						}

						// Phase 7.2: Real LLM Response Handling
						res, err := mcpServer.RequestSampling(sampleCtx, req)

						if err != nil {
							observeTaskOutcome("execution_failure")
							observeTaskExecutionDuration(executionStart, "failure")
							log.Printf("Pub/Sub Sampling failed for user %s: %v", userID, err)

							if _, err := queries.CreateExecutionTrace(dbCtx, db.CreateExecutionTraceParams{Metadata: nil, 
								TaskID:       tid,
								ExecutionID:  executionID,
								WorkerID:     workerID,
								StepName:     "LLM Sampling Failed",
								IsError:      pgtype.Bool{Bool: true, Valid: true},
								ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
							}); err != nil {
								log.Printf("Trace error for task %s: %v", taskID, err)
							}

							// Phase 10.2: Properly log failure back to DB instead of failing silently
							logID, logErr := queries.CreateTaskLog(dbCtx, db.CreateTaskLogParams{
								TaskID:       tid,
								UserID:       userID,
								Status:       "failure",
								ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
							})
							if logErr != nil {
								log.Printf("Error creating failure log for task %s: %v", taskID, logErr)
							}

							// Emit Redis event
							evtPayload, mErr := json.Marshal(map[string]interface{}{
								"id":               formatUUID(logID),
								"task_id":          taskID,
								"status":           "failure",
								"execution_time":   time.Now().Format(time.RFC3339),
								"task_name":        t.Name,
								"user_email":       emailStr,
								"error_message":    err.Error(),
								"secrets_injected": secretCount,
								"chained":          chained,
							})
							if mErr != nil {
								log.Printf("Error marshaling failure event for %s: %v", taskID, mErr)
							} else {
								if pErr := PublishEvent(dbCtx, PubSubEvent{
									UserID:    userID,
									EventType: "task_executed",
									Payload:   string(evtPayload),
								}); pErr != nil {
									log.Printf("Error publishing task_executed (failure) for %s: %v", taskID, pErr)
								}
							}

							// Increment failure count securely
							currentFailures, incErr := queries.IncrementTaskFailureCount(dbCtx, db.IncrementTaskFailureCountParams{
								ID:     tid,
								UserID: userID,
							})
							if incErr != nil {
								log.Printf("Error incrementing failure count for task %s: %v", taskID, incErr)
							}

							if currentFailures.Int32 >= 3 {
								if uErr := queries.UpdateTaskStatus(dbCtx, db.UpdateTaskStatusParams{
									Status: pgtype.Text{String: StatusError, Valid: true},
									ID:     tid,
									UserID: userID,
								}); uErr != nil {
									log.Printf("Error updating status to error for task %s: %v", taskID, uErr)
								}
								sendFailureEmail(dbCtx, userID, taskID, t.Name)
							} else {
								// Unlock so it can be retried by the scheduler
								if uErr := queries.UpdateTaskStatus(dbCtx, db.UpdateTaskStatusParams{
									Status: pgtype.Text{String: StatusActive, Valid: true},
									ID:     tid,
									UserID: userID,
								}); uErr != nil {
									log.Printf("Error updating status to active for task %s: %v", taskID, uErr)
								}
							}
							return
						}

						// Safely extract the LLM's text response
						llmResponse := "No response provided by LLM"
						if res != nil {
							// Convert response to JSON string for the log
							resBytes, err := json.Marshal(res)
							if err != nil {
								log.Printf("Error marshaling LLM response for %s: %v", taskID, err)
							} else {
								llmResponse = string(resBytes)
							}
						}
						llmResponse = sanitizeLLMResponseForStorage(llmResponse)

						// Phase 12.2: Handle State Updates if response is JSON and contains state_update
						var respObj map[string]interface{}
						if err := json.Unmarshal([]byte(llmResponse), &respObj); err == nil {
							if stateUpdate, ok := respObj["state_update"].(map[string]interface{}); ok {
								// Fetch current state
								currentState := make(map[string]interface{})
								sBytes, err := queries.GetWorkflowState(dbCtx, db.GetWorkflowStateParams{
									TaskID:      tid,
									ExecutionID: executionID,
								})
								if err != nil && !errors.Is(err, pgx.ErrNoRows) {
									log.Printf("Error fetching workflow state for %s: %v", taskID, err)
								}

								if len(sBytes) > 0 {
									if err := json.Unmarshal(sBytes, &currentState); err != nil {
										log.Printf("Error unmarshaling current workflow state for %s: %v", taskID, err)
									}
								}
								// Merge
								for k, v := range stateUpdate {
									currentState[k] = v
								}
								newStateBytes, err := json.Marshal(currentState)
								if err != nil {
									log.Printf("Error marshaling new state for %s: %v", taskID, err)
								} else {
									queries.UpsertWorkflowState(dbCtx, db.UpsertWorkflowStateParams{
										TaskID:      tid,
										ExecutionID: executionID,
										StateData:   newStateBytes,
									})
									log.Printf("Updated workflow state for task %s, execution %s", taskID, executionID)
								}
							}
						}

						log.Printf("Received LLM Response for user %s: %s", userID, llmResponse)
						observeTaskOutcome("execution_success")
						observeTaskExecutionDuration(executionStart, "success")

						if _, err := queries.CreateExecutionTrace(dbCtx, db.CreateExecutionTraceParams{Metadata: nil, 
							TaskID:      tid,
							ExecutionID: executionID,
							WorkerID:    workerID,
							StepName:    "LLM Sampling Success",
							OutputData:  pgtype.Text{String: llmResponse, Valid: true},
						}); err != nil {
							log.Printf("Trace error for task %s: %v", taskID, err)
						}

						// Save the actual LLM response to the specific task log
						logID, err := queries.CreateTaskLog(dbCtx, db.CreateTaskLogParams{
							TaskID:      tid,
							UserID:      userID,
							Status:      "success",
							LlmResponse: pgtype.Text{String: llmResponse, Valid: true},
						})
						if err != nil {
							log.Printf("Error creating success log for task %s: %v", taskID, err)
						}

						// Emit Redis event
						evtPayload, mErr := json.Marshal(map[string]interface{}{
							"id":               formatUUID(logID),
							"task_id":          taskID,
							"status":           "success",
							"execution_time":   time.Now().Format(time.RFC3339),
							"task_name":        t.Name,
							"user_email":       emailStr,
							"llm_response":     llmResponse,
							"secrets_injected": secretCount,
							"chained":          chained,
						})
						if mErr != nil {
							log.Printf("Error marshaling success event for %s: %v", taskID, mErr)
						} else {
							if pErr := PublishEvent(dbCtx, PubSubEvent{
								UserID:    userID,
								EventType: "task_executed",
								Payload:   string(evtPayload),
							}); pErr != nil {
								log.Printf("Error publishing task_executed (success) for %s: %v", taskID, pErr)
							}
						}

						// Phase 12.3: Evaluate loop condition
						if len(t.LoopCondition) > 0 {
							// Fetch state for evaluation
							sBytes, err := queries.GetWorkflowState(dbCtx, db.GetWorkflowStateParams{
								TaskID:      tid,
								ExecutionID: executionID,
							})
							if err != nil && !errors.Is(err, pgx.ErrNoRows) {
								log.Printf("Error fetching workflow state for loop eval %s: %v", taskID, err)
							}
							
							var stateMap map[string]interface{}
							if len(sBytes) > 0 {
								if err := json.Unmarshal(sBytes, &stateMap); err != nil {
									log.Printf("Error unmarshaling workflow state for loop eval %s: %v", taskID, err)
								}
							}

							if evaluateWorkflowLoop(t.LoopCondition, stateMap) {
								log.Printf("Loop condition met for task %s, triggering next iteration.", taskID)
								// Trigger immediate re-run by setting next_run to now and status to active
								completeTask(dbCtx, userID, taskID, time.Now().UTC(), StatusActive)
								return
							}
						}

						// Iteration 2: Advance the task status
						if triggerType == TriggerDate {
							completeTask(dbCtx, userID, taskID, time.Now().UTC(), StatusCompleted)
							return
						}

						var config map[string]interface{}
						if err := json.Unmarshal([]byte(triggerConfigStr), &config); err != nil {
							log.Printf("Error unmarshaling trigger config for task %s: %v", taskID, err)
							if err := queries.UpdateTaskStatus(dbCtx, db.UpdateTaskStatusParams{
								Status: pgtype.Text{String: StatusPaused, Valid: true},
								ID:     tid,
								UserID: userID,
							}); err != nil {
								log.Printf("Error pausing task %s: %v", taskID, err)
							}
							return
						}

						newNextRun, calcErr := calculateNextRun(triggerType, config, time.Now().UTC())
						if calcErr != nil {
							log.Printf("Error calculating next run for task %s: %v", taskID, calcErr)
							if err := queries.UpdateTaskStatus(dbCtx, db.UpdateTaskStatusParams{
								Status: pgtype.Text{String: StatusPaused, Valid: true},
								ID:     tid,
								UserID: userID,
							}); err != nil {
								log.Printf("Error pausing task %s: %v", taskID, err)
							}
							return
						}

						completeTask(dbCtx, userID, taskID, newNextRun)
					}(msg.Payload)
				}
			}
		}()

		if shouldExit {
			return
		}
	}
}
