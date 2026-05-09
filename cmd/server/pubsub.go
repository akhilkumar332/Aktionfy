package main

import (
	"context"
	"encoding/json"
	"log"
)

type PubSubEvent struct {
	UserID    string `json:"user_id"`
	EventType string `json:"event_type"` // e.g., "task_status_changed"
	Payload   string `json:"payload"`
}

func PublishEvent(ctx context.Context, event PubSubEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return RedisClient.Publish(ctx, "system_events", data).Err()
}

func SubscribeToEvents(ctx context.Context, onEvent func(PubSubEvent)) {
	pubsub := RedisClient.Subscribe(ctx, "system_events")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var event PubSubEvent
		if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
			log.Printf("Error unmarshaling event: %v", err)
			continue
		}
		onEvent(event)
	}
}
