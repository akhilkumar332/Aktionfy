package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"aktionfy/db"

	"github.com/jackc/pgx/v5/pgtype"
)

func handleSwarmRouterAction(workerCtx context.Context, t db.Task, triggerPayload map[string]interface{}, state map[string]interface{}) {
	taskID := formatUUID(t.ID)
	executionID := fmt.Sprintf("%s-%d", taskID, time.Now().UTC().UnixNano())

	var config SwarmConfig
	if len(t.SwarmConfig) > 0 {
		if err := json.Unmarshal(t.SwarmConfig, &config); err != nil {
			failSwarm(workerCtx, t, taskID, executionID, fmt.Errorf("failed to parse swarm config: %v", err))
			return
		}
	}

	if len(config.Council) == 0 {
		failSwarm(workerCtx, t, taskID, executionID, fmt.Errorf("no agents configured in swarm council"))
		return
	}

	// Fetch OpenAI key from vault
	encKey, err := queries.GetUserSecret(workerCtx, db.GetUserSecretParams{
		UserID: t.UserID,
		Name:   "OPENAI_API_KEY",
	})
	if err != nil {
		failSwarm(workerCtx, t, taskID, executionID, fmt.Errorf("missing OPENAI_API_KEY in vault for swarm execution"))
		return
	}

	decKey, err := Decrypt(encKey)
	if err != nil {
		failSwarm(workerCtx, t, taskID, executionID, fmt.Errorf("failed to decrypt API key"))
		return
	}
	apiKey := string(decKey)

	// Prepare trace
	inputMap := map[string]interface{}{
		"payload": triggerPayload,
		"config":  config,
	}
	inputJSON, _ := json.Marshal(inputMap)

	if _, err := queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{Metadata: nil,
		TaskID:      t.ID,
		ExecutionID: executionID,
		WorkerID:    workerID,
		StepName:    "Swarm Orchestration Started",
		InputData:   pgtype.Text{String: string(inputJSON), Valid: true},
	}); err != nil {
		log.Printf("Trace error for task %s: %v", taskID, err)
	}

	// Begin the Swarm Debate
	resolvedAgentPrompt := resolvePromptVariables(workerCtx, t.UserID, t.AgentPrompt, triggerPayload, state)
	var conversationHistory []string
	conversationHistory = append(conversationHistory, fmt.Sprintf("SYSTEM: The user prompt is: %s", resolvedAgentPrompt))

	maxTurns := 5 // Hardcode or extract from config if we add it later

	consensusReached := false
	var finalResult string

	for turn := 0; turn < maxTurns; turn++ {
		for _, agent := range config.Council {
			if consensusReached {
				break
			}

			stepName := fmt.Sprintf("Agent Turn: %s", agent.Name)

			// Build LLM context
			resolvedCouncilPrompt := resolvePromptVariables(workerCtx, t.UserID, agent.Prompt, triggerPayload, state)
			llmPrompt := fmt.Sprintf("%s\n\nConversation so far:\n%s\n\nProvide your response. If consensus is reached and the task is fully complete, include the exact string [CONSENSUS_REACHED] in your response.",
				resolvedCouncilPrompt, strings.Join(conversationHistory, "\n"))

			// Native LLM Call
			response, llmErr := callOpenAI(apiKey, llmPrompt)
			if llmErr != nil {
				failSwarm(workerCtx, t, taskID, executionID, fmt.Errorf("LLM error from %s: %v", agent.Name, llmErr))
				return
			}

			conversationHistory = append(conversationHistory, fmt.Sprintf("%s: %s", agent.Name, response))

			queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{Metadata: nil,
				TaskID:      t.ID,
				ExecutionID: executionID,
				WorkerID:    workerID,
				StepName:    stepName,
				OutputData:  pgtype.Text{String: response, Valid: true},
			})

			if strings.Contains(response, "[CONSENSUS_REACHED]") {
				consensusReached = true
				finalResult = response
				break
			}

			// Optional: slight delay to prevent rate limits
			time.Sleep(500 * time.Millisecond)
		}
		if consensusReached {
			break
		}
	}

	if !consensusReached {
		finalResult = "Max turns reached without consensus. Last state: \n" + strings.Join(conversationHistory[len(conversationHistory)-2:], "\n")
	}

	succeedSwarm(workerCtx, t, taskID, executionID, finalResult)
}

func callOpenAI(apiKey string, prompt string) (string, error) {
	url := "https://api.openai.com/v1/chat/completions"

	payload := map[string]interface{}{
		"model": "gpt-4o-mini", // Using mini for speed in swarms
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"temperature": 0.7,
	}

	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("OpenAI API error: %s", string(respBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", err
	}

	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("no response choices from OpenAI")
}

func failSwarm(workerCtx context.Context, t db.Task, taskID string, executionID string, err error) {
	log.Printf("Swarm execution failed for task %s: %v", taskID, err)
	observeTaskOutcome("execution_failure")

	if _, traceErr := queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{Metadata: nil,
		TaskID:       t.ID,
		ExecutionID:  executionID,
		WorkerID:     workerID,
		StepName:     "Swarm Orchestration Failed",
		IsError:      pgtype.Bool{Bool: true, Valid: true},
		ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
	}); traceErr != nil {
		log.Printf("Trace error for task %s: %v", taskID, traceErr)
	}

	failureCount := t.FailureCount.Int32 + 1
	logID, logErr := queries.CreateTaskLog(workerCtx, db.CreateTaskLogParams{
		TaskID:       t.ID,
		UserID:       t.UserID,
		Status:       "failure",
		ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
	})

	if logErr == nil {
		RecordTaskExecutionTelemetry(workerCtx, t.UserID, taskID, "failure")
	}

	evtPayload, _ := json.Marshal(map[string]interface{}{
		"id":             formatUUID(logID),
		"task_id":        taskID,
		"status":         "failure",
		"execution_time": time.Now().Format(time.RFC3339),
		"task_name":      t.Name,
		"error_message":  err.Error(),
		"execution_id":   executionID,
	})

	PublishEvent(workerCtx, PubSubEvent{
		UserID:    t.UserID,
		EventType: "task_executed",
		Payload:   string(evtPayload),
	})

	retryCount := t.RetryCount.Int32 + 1
	maxRetries := t.MaxRetries.Int32
	if maxRetries == 0 {
		maxRetries = 3
	}

	if retryCount > maxRetries {
		queries.UpdateTaskStatusAndFailureCount(workerCtx, db.UpdateTaskStatusAndFailureCountParams{
			Status:       pgtype.Text{String: StatusError, Valid: true},
			FailureCount: pgtype.Int4{Int32: failureCount, Valid: true},
			RetryCount:   pgtype.Int4{Int32: retryCount, Valid: true},
			ID:           t.ID,
			UserID:       t.UserID,
		})
		queries.MoveToDLQ(workerCtx, db.MoveToDLQParams{
			TaskID:       t.ID,
			ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
		})
		sendFailureEmail(workerCtx, t.UserID, taskID, t.Name)
	} else {
		backoffMinutes := int(retryCount) * 2
		if t.BackoffStrategy.String == "exponential" {
			backoffMinutes = 1 << retryCount
		}
		nextRun := time.Now().UTC().Add(time.Duration(backoffMinutes) * time.Minute)
		queries.UpdateTaskStatusAndFailureCount(workerCtx, db.UpdateTaskStatusAndFailureCountParams{
			Status:       pgtype.Text{String: StatusActive, Valid: true},
			FailureCount: pgtype.Int4{Int32: failureCount, Valid: true},
			RetryCount:   pgtype.Int4{Int32: retryCount, Valid: true},
			ID:           t.ID,
			UserID:       t.UserID,
		})
		queries.UpdateTaskNextRun(workerCtx, db.UpdateTaskNextRunParams{
			Status:  pgtype.Text{String: StatusActive, Valid: true},
			NextRun: pgtype.Timestamptz{Time: nextRun, Valid: true},
			ID:      t.ID,
			UserID:  t.UserID,
		})
	}
}

func succeedSwarm(workerCtx context.Context, t db.Task, taskID string, executionID string, result string) {
	observeTaskOutcome("success")

	logID, logErr := queries.CreateTaskLog(workerCtx, db.CreateTaskLogParams{
		TaskID:      t.ID,
		UserID:      t.UserID,
		Status:      "success",
		LlmResponse: pgtype.Text{String: result, Valid: true},
	})

	if logErr == nil {
		RecordTaskExecutionTelemetry(workerCtx, t.UserID, taskID, "success")
	}

	evtPayload, _ := json.Marshal(map[string]interface{}{
		"id":             formatUUID(logID),
		"task_id":        taskID,
		"status":         "success",
		"execution_time": time.Now().Format(time.RFC3339),
		"task_name":      t.Name,
		"llm_response":   result,
		"execution_id":   executionID,
	})

	PublishEvent(workerCtx, PubSubEvent{
		UserID:    t.UserID,
		EventType: "task_executed",
		Payload:   string(evtPayload),
	})

	queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{Metadata: nil,
		TaskID:      t.ID,
		ExecutionID: executionID,
		WorkerID:    workerID,
		StepName:    "Swarm Orchestration Consensus Reached",
		OutputData:  pgtype.Text{String: result, Valid: true},
	})

			if t.TriggerType.String == "date" || t.TriggerType.String == "webhook" || t.TriggerType.String == "manual" {
				completeTask(workerCtx, t.UserID, taskID, time.Time{}, false, StatusCompleted)
				return
			}

			var config map[string]interface{}
			nextRun := time.Time{}
			finalStatus := StatusPaused

			if err := json.Unmarshal(t.TriggerConfig, &config); err == nil {
				if newNextRun, calcErr := calculateNextRun(t.TriggerType.String, config, time.Now().UTC()); calcErr == nil {
					nextRun = newNextRun
					finalStatus = StatusActive
				}
			}

			completeTask(workerCtx, t.UserID, taskID, nextRun, false, finalStatus)
}
