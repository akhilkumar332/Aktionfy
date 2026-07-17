package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"aktionfy/db"

	"github.com/jackc/pgx/v5/pgtype"
)

type IntegrationHandler func(ctx context.Context, config map[string]interface{}, input map[string]interface{}, secrets map[string]string) (string, error)

var integrationRegistry = map[string]IntegrationHandler{
	"github_create_issue": executeGithubCreateIssue,
	"slack_post_message":  executeSlackPostMessage,
	"http_request":        executeHTTPRequest,
}

func handleIntegrationAction(workerCtx context.Context, t db.Task, triggerPayload map[string]interface{}) {
	taskID := formatUUID(t.ID)
	executionID := fmt.Sprintf("%s-%d", taskID, time.Now().UTC().UnixNano())

	if !t.IntegrationID.Valid {
		failIntegration(workerCtx, t, taskID, executionID, fmt.Errorf("integration_id is missing"))
		return
	}

	handler, exists := integrationRegistry[t.IntegrationID.String]
	if !exists {
		failIntegration(workerCtx, t, taskID, executionID, fmt.Errorf("unknown integration_id: %s", t.IntegrationID.String))
		return
	}

	var config map[string]interface{}
	if len(t.IntegrationConfig) > 0 {
		if err := json.Unmarshal(t.IntegrationConfig, &config); err != nil {
			log.Printf("Warning: failed to unmarshal integration config for task %s", taskID)
		}
	}

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
		StepName:    fmt.Sprintf("Integration Execution Started (%s)", t.IntegrationID.String),
		InputData:   pgtype.Text{String: string(inputJSON), Valid: true},
	}); err != nil {
		log.Printf("Trace error for task %s: %v", taskID, err)
	}

	// Fetch secrets required by integration
	var requiredSecrets []string
	if t.IntegrationID.String == "github_create_issue" {
		requiredSecrets = []string{"GITHUB_TOKEN"}
	} else if t.IntegrationID.String == "slack_post_message" {
		requiredSecrets = []string{"SLACK_TOKEN"}
	}

	secrets := make(map[string]string)
	for _, key := range requiredSecrets {
		enc, err := queries.GetUserSecret(workerCtx, db.GetUserSecretParams{
			UserID: t.UserID,
			Name:   key,
		})
		if err == nil {
			dec, dErr := Decrypt(enc)
			if dErr == nil {
				secrets[key] = string(dec)
			}
		}
	}

	// Execute
	result, err := handler(workerCtx, config, triggerPayload, secrets)

	if err != nil {
		failIntegration(workerCtx, t, taskID, executionID, err)
		return
	}

	succeedIntegration(workerCtx, t, taskID, executionID, result)
}

func failIntegration(workerCtx context.Context, t db.Task, taskID string, executionID string, err error) {
	log.Printf("Integration execution failed for task %s: %v", taskID, err)
	observeTaskOutcome("execution_failure")

	if _, traceErr := queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{Metadata: nil,
		TaskID:       t.ID,
		ExecutionID:  executionID,
		WorkerID:     workerID,
		StepName:     "Integration Execution Failed",
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
			Status:  pgtype.Text{String: StatusPaused, Valid: true},
			NextRun: pgtype.Timestamptz{Time: nextRun, Valid: true},
			ID:      t.ID,
			UserID:  t.UserID,
		})
	}
}

func succeedIntegration(workerCtx context.Context, t db.Task, taskID string, executionID string, result string) {
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
		StepName:    "Integration Execution Success",
		OutputData:  pgtype.Text{String: result, Valid: true},
	})

	var config map[string]interface{}
	if err := json.Unmarshal(t.TriggerConfig, &config); err == nil {
		if newNextRun, calcErr := calculateNextRun(t.TriggerType.String, config, time.Now().UTC()); calcErr == nil {
			completeTask(workerCtx, t.UserID, taskID, newNextRun)
			return
		}
	}
	queries.UpdateTaskStatus(workerCtx, db.UpdateTaskStatusParams{
		Status: pgtype.Text{String: StatusPaused, Valid: true},
		ID:     t.ID,
	})
}

// Implementations for Phase 2 integrations
func executeGithubCreateIssue(ctx context.Context, config map[string]interface{}, input map[string]interface{}, secrets map[string]string) (string, error) {
	token := secrets["GITHUB_TOKEN"]
	if token == "" {
		return "", fmt.Errorf("missing GITHUB_TOKEN in vault")
	}

	getString := func(key string) string {
		if v, ok := config[key].(string); ok && v != "" {
			return v
		}
		if payload, ok := input["payload"].(map[string]interface{}); ok {
			if v, ok := payload[key].(string); ok && v != "" {
				return v
			}
		}
		return ""
	}

	owner := getString("owner")
	repo := getString("repo")
	title := getString("title")
	body := getString("body")

	if owner == "" || repo == "" || title == "" {
		return "", fmt.Errorf("missing required fields for github issue (owner, repo, title)")
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/issues", owner, repo)
	
	reqBody, _ := json.Marshal(map[string]interface{}{
		"title": title,
		"body":  body,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}
	
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	respData, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("github api error (%d): %s", resp.StatusCode, string(respData))
	}
	
	return string(respData), nil
}

func executeSlackPostMessage(ctx context.Context, config map[string]interface{}, input map[string]interface{}, secrets map[string]string) (string, error) {
	token := secrets["SLACK_TOKEN"]
	if token == "" {
		return "", fmt.Errorf("missing SLACK_TOKEN in vault")
	}

	getString := func(key string) string {
		if v, ok := config[key].(string); ok && v != "" {
			return v
		}
		if payload, ok := input["payload"].(map[string]interface{}); ok {
			if v, ok := payload[key].(string); ok && v != "" {
				return v
			}
		}
		return ""
	}

	channel := getString("channel")
	text := getString("text")

	if channel == "" || text == "" {
		return "", fmt.Errorf("missing required fields for slack (channel, text)")
	}

	reqBody, _ := json.Marshal(map[string]interface{}{
		"channel": channel,
		"text":    text,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://slack.com/api/chat.postMessage", bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}
	
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	respData, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("slack api error (%d): %s", resp.StatusCode, string(respData))
	}
	
	return string(respData), nil
}

func executeHTTPRequest(ctx context.Context, config map[string]interface{}, input map[string]interface{}, secrets map[string]string) (string, error) {
	getString := func(key string) string {
		if v, ok := config[key].(string); ok && v != "" {
			return v
		}
		if payload, ok := input["payload"].(map[string]interface{}); ok {
			if v, ok := payload[key].(string); ok && v != "" {
				return v
			}
		}
		return ""
	}

	method := getString("method")
	if method == "" {
		method = "GET"
	}
	
	url := getString("url")
	if url == "" {
		return "", fmt.Errorf("missing required field: url")
	}

	var reqBody io.Reader
	if bodyStr := getString("body"); bodyStr != "" {
		reqBody = bytes.NewBufferString(bodyStr)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return "", err
	}
	
	if headers, ok := config["headers"].(map[string]interface{}); ok {
		for k, v := range headers {
			if strVal, ok := v.(string); ok {
				req.Header.Set(k, strVal)
			}
		}
	} else if payload, ok := input["payload"].(map[string]interface{}); ok {
		if headers, ok := payload["headers"].(map[string]interface{}); ok {
			for k, v := range headers {
				if strVal, ok := v.(string); ok {
					req.Header.Set(k, strVal)
				}
			}
		}
	}

	// Auto-inject token if present in vault and Auth header is not manually set
	if token := secrets["API_TOKEN"]; token != "" && req.Header.Get("Authorization") == "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	respData, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("http request error (%d): %s", resp.StatusCode, string(respData))
	}
	
	return string(respData), nil
}
