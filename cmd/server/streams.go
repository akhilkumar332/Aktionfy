package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync/atomic"
	"time"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
)

const (
	TaskTriggerStream = "sys:task:triggers"
	TaskTriggerGroup  = "task-trigger-group"
)

// ProduceTaskTrigger writes a task trigger request to the Redis Stream.
func ProduceTaskTrigger(ctx context.Context, userID, taskID string, payload map[string]interface{}) error {
	if RedisClient == nil {
		return fmt.Errorf("redis client not initialized")
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	err = RedisClient.XAdd(ctx, &redis.XAddArgs{
		Stream: TaskTriggerStream,
		Values: map[string]interface{}{
			"user_id": userID,
			"task_id": taskID,
			"payload": string(payloadJSON),
		},
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to add task trigger to stream: %w", err)
	}

	return nil
}

// StartStreamConsumer runs the Redis Stream consumer loop.
func StartStreamConsumer(ctx context.Context) {
	if RedisClient == nil {
		log.Printf("Redis client not initialized, stream consumer not started")
		return
	}

	// Ensure group exists
	err := RedisClient.XGroupCreateMkStream(ctx, TaskTriggerStream, TaskTriggerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Printf("Error creating consumer group %s: %v", TaskTriggerGroup, err)
	}

	log.Printf("Starting Redis Stream consumer %s for stream %s", workerID, TaskTriggerStream)

	for {
		select {
		case <-ctx.Done():
			log.Printf("Stream consumer shutting down...")
			return
		default:
			// Read from stream
			streams, err := RedisClient.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    TaskTriggerGroup,
				Consumer: workerID,
				Streams:  []string{TaskTriggerStream, ">"},
				Count:    10,
				Block:    5 * time.Second,
			}).Result()

			if err != nil {
				if err != redis.Nil {
					log.Printf("XReadGroup error: %v", err)
					time.Sleep(2 * time.Second)
				}
				continue
			}

			for _, stream := range streams {
				for _, message := range stream.Messages {
					workerWG.Add(1)
					atomic.AddInt32(&activeWorkerTasks, 1)
					go handleStreamMessage(ctx, message)
				}
			}
		}
	}
}

func handleStreamMessage(ctx context.Context, message redis.XMessage) {
	defer workerWG.Done()
	defer atomic.AddInt32(&activeWorkerTasks, -1)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Panic in handleStreamMessage: %v", r)
		}
	}()

	userID, _ := message.Values["user_id"].(string)
	taskIDStr, _ := message.Values["task_id"].(string)
	payloadStr, _ := message.Values["payload"].(string)

	if userID == "" || taskIDStr == "" {
		log.Printf("Invalid message from stream: missing userID or taskID")
		// ACK anyway to clear it
		RedisClient.XAck(ctx, TaskTriggerStream, TaskTriggerGroup, message.ID)
		return
	}

	var payload map[string]interface{}
	if payloadStr != "" && payloadStr != "null" {
		if err := json.Unmarshal([]byte(payloadStr), &payload); err != nil {
			log.Printf("Error unmarshaling stream payload for task %s: %v", taskIDStr, err)
		}
	}

	var taskID pgtype.UUID
	if err := parseUUID(taskIDStr, &taskID); err != nil {
		log.Printf("Invalid task ID format in stream: %s", taskIDStr)
		RedisClient.XAck(ctx, TaskTriggerStream, TaskTriggerGroup, message.ID)
		return
	}

	// Fetch task from DB to ensure it exists and we have current state
	t, err := queries.GetTaskByID(ctx, db.GetTaskByIDParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		log.Printf("Error fetching task %s for stream execution: %v", taskIDStr, err)
		// If task is not found, ACK to clear it from stream
		if strings.Contains(err.Error(), "no rows") {
			RedisClient.XAck(ctx, TaskTriggerStream, TaskTriggerGroup, message.ID)
		}
		return
	}

	// Acquire task lock for singleton execution
	acquired, release := AcquireTaskLock(ctx, taskIDStr, 60*time.Second)
	if !acquired {
		// Log but don't ACK, let another consumer or retry pick it up if needed?
		// Actually, if another consumer has it, they will ACK it.
		return
	}
	defer release()

	// Execute task
	log.Printf("Stream consumer %s triggering task %s", workerID, taskIDStr)
	handleDispatchTask(ctx, t, payload)

	// Acknowledge message
	err = RedisClient.XAck(ctx, TaskTriggerStream, TaskTriggerGroup, message.ID).Err()
	if err != nil {
		log.Printf("Error ACKing message %s: %v", message.ID, err)
	}
}
