package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"aktionfy/db"

	"github.com/jackc/pgx/v5/pgtype"
)

func handleDecisionRouterAction(workerCtx context.Context, t db.Task, triggerPayload map[string]interface{}) {
	taskIDStr := formatUUID(t.ID)
	executionID := fmt.Sprintf("%s-%d", taskIDStr, time.Now().UTC().UnixNano())

	failRouter := func(err error) {
		log.Printf("Decision router failed for task %s: %v", taskIDStr, err)
		observeTaskOutcome("execution_failure")
		queries.CreateTaskLog(workerCtx, db.CreateTaskLogParams{
			TaskID:       t.ID,
			UserID:       t.UserID,
			Status:       "failure",
			ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
		})
		queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{
			Metadata:     nil,
			TaskID:       t.ID,
			ExecutionID:  executionID,
			WorkerID:     workerID,
			StepName:     "Decision Routing Failed",
			IsError:      pgtype.Bool{Bool: true, Valid: true},
			ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
		})
		RecordTaskExecutionTelemetry(workerCtx, t.UserID, taskIDStr, "failure")
	}

	// Fetch downstream tasks
	dependentTasks, err := queries.GetDependentTasks(workerCtx, t.ID)
	if err != nil {
		failRouter(fmt.Errorf("failed to fetch dependent tasks: %v", err))
		return
	}

	if len(dependentTasks) == 0 {
		failRouter(fmt.Errorf("no downstream tasks connected to router"))
		return
	}

	// Fetch OpenAI key from vault
	encKey, err := queries.GetUserSecret(workerCtx, db.GetUserSecretParams{
		UserID: t.UserID,
		Name:   "OPENAI_API_KEY",
	})
	if err != nil {
		failRouter(fmt.Errorf("missing OPENAI_API_KEY in vault for decision routing"))
		return
	}

	decKey, err := Decrypt(encKey)
	if err != nil {
		failRouter(fmt.Errorf("failed to decrypt API key"))
		return
	}
	apiKey := string(decKey)

	// Prepare traces
	var routesDesc []string
	validIDs := make(map[string]db.Task)
	for _, dt := range dependentTasks {
		idStr := formatUUID(dt.ID)
		validIDs[idStr] = dt
		routesDesc = append(routesDesc, fmt.Sprintf("- ID: %s | Name: %s", idStr, dt.Name))
	}

	payloadJSON, _ := json.MarshalIndent(triggerPayload, "", "  ")

	systemPrompt := fmt.Sprintf(`You are an AI decision router (zero-shot classification).
Your job is to evaluate the Trigger Payload according to the User's Routing Rules, and select EXACTLY ONE downstream Task ID to execute.

Available Downstream Routes:
%s

User's Routing Rules:
%s

Trigger Payload:
%s

INSTRUCTIONS:
1. Output ONLY the exact UUID of the chosen route.
2. Do not include any other text, markdown, or explanation.
3. If the payload is ambiguous, does not match any rules clearly, or you cannot decide, output the exact word: HALT`,
		strings.Join(routesDesc, "\n"), t.AgentPrompt, string(payloadJSON))

	inputMap := map[string]interface{}{
		"system_prompt": systemPrompt,
		"routes":        routesDesc,
	}
	inputJSONBytes, _ := json.Marshal(inputMap)

	if _, err := queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{
		Metadata:    nil,
		TaskID:      t.ID,
		ExecutionID: executionID,
		WorkerID:    workerID,
		StepName:    "Decision Routing Started",
		InputData:   pgtype.Text{String: string(inputJSONBytes), Valid: true},
	}); err != nil {
		log.Printf("Trace error for router %s: %v", taskIDStr, err)
	}

	// Call OpenAI
	response, llmErr := callOpenAI(apiKey, systemPrompt)
	if llmErr != nil {
		failRouter(fmt.Errorf("LLM error during routing: %v", llmErr))
		return
	}

	resultToken := strings.TrimSpace(response)

	if resultToken == "HALT" {
		// Human-in-the-loop requirement
		err = queries.UpdateTaskApprovalStatusAndLastRun(workerCtx, db.UpdateTaskApprovalStatusAndLastRunParams{
			LastApprovalStatus: pgtype.Text{String: "needs_routing", Valid: true},
			Status:             pgtype.Text{String: "paused", Valid: true},
			ID:                 t.ID,
			UserID:             t.UserID,
		})
		if err != nil {
			log.Printf("Failed to halt router %s: %v", taskIDStr, err)
		}

		queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{
			Metadata:    nil,
			TaskID:      t.ID,
			ExecutionID: executionID,
			WorkerID:    workerID,
			StepName:    "Routing Halted (Ambiguous)",
			OutputData:  pgtype.Text{String: "AI requested human-in-the-loop routing.", Valid: true},
		})

		_ = PublishEvent(workerCtx, PubSubEvent{
			UserID:    t.UserID,
			EventType: "task_updated",
			Payload:   fmt.Sprintf(`{"task_id":"%s"}`, taskIDStr),
		})
		
		completeTask(workerCtx, t.UserID, taskIDStr, time.Time{}, true, "paused")
		return
	}

	// Verify chosen ID is valid
	targetTask, valid := validIDs[resultToken]
	if !valid {
		// Invalid response, fail back to HALT
		log.Printf("Router %s output invalid route ID: %s", taskIDStr, resultToken)
		queries.UpdateTaskApprovalStatusAndLastRun(workerCtx, db.UpdateTaskApprovalStatusAndLastRunParams{
			LastApprovalStatus: pgtype.Text{String: "needs_routing", Valid: true},
			Status:             pgtype.Text{String: "paused", Valid: true},
			ID:                 t.ID,
			UserID:             t.UserID,
		})

		queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{
			Metadata:    nil,
			TaskID:      t.ID,
			ExecutionID: executionID,
			WorkerID:    workerID,
			StepName:    "Routing Halted (Invalid Output)",
			OutputData:  pgtype.Text{String: fmt.Sprintf("AI returned invalid ID: %s", resultToken), Valid: true},
		})
		_ = PublishEvent(workerCtx, PubSubEvent{
			UserID:    t.UserID,
			EventType: "task_updated",
			Payload:   fmt.Sprintf(`{"task_id":"%s"}`, taskIDStr),
		})
		completeTask(workerCtx, t.UserID, taskIDStr, time.Time{}, true, "paused")
		return
	}

	// Valid route chosen, trigger the target task
	err = queries.UpdateTaskNextRun(workerCtx, db.UpdateTaskNextRunParams{
		Status:  pgtype.Text{String: "active", Valid: true},
		NextRun: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		ID:      targetTask.ID,
		UserID:  t.UserID,
	})
	if err != nil {
		failRouter(fmt.Errorf("failed to trigger target task %s: %v", resultToken, err))
		return
	}

	queries.CreateExecutionTrace(workerCtx, db.CreateExecutionTraceParams{
		Metadata:    nil,
		TaskID:      t.ID,
		ExecutionID: executionID,
		WorkerID:    workerID,
		StepName:    "Routing Complete",
		OutputData:  pgtype.Text{String: fmt.Sprintf("Successfully routed to: %s (%s)", targetTask.Name, resultToken), Valid: true},
	})
	
	// Mark router task itself as complete
	completeTask(workerCtx, t.UserID, taskIDStr, time.Time{}, true, "completed")
}
