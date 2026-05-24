package main

import (
	"aktionfy/db"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

type PubSubEvent struct {
	UserID       string            `json:"user_id"`
	EventType    string            `json:"event_type"` // e.g., "task_status_changed"
	Payload      string            `json:"payload"`
	TraceContext map[string]string `json:"trace_context,omitempty"`
}

func PublishEvent(ctx context.Context, event PubSubEvent) error {
	if RedisClient == nil {
		log.Printf("Aktionfy warning: RedisClient is uninitialized. Event '%s' skipped.", event.EventType)
		return nil
	}

	if event.TraceContext == nil {
		event.TraceContext = make(map[string]string)
	}
	otel.GetTextMapPropagator().Inject(ctx, propagation.MapCarrier(event.TraceContext))

	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	
	// Publish to global channel for internal node sync (e.g., reaper)
	RedisClient.Publish(ctx, "sys:events", data)
	
	// Publish to user-specific channel for dashboard SSE streams
	return RedisClient.Publish(ctx, fmt.Sprintf("user:events:%s", event.UserID), data).Err()
}

func SubscribeToEvents(ctx context.Context, onEvent func(context.Context, PubSubEvent)) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			if RedisClient == nil {
				log.Printf("Aktionfy warning: RedisClient is uninitialized. Retrying subscription in 5s...")
				timer := time.NewTimer(5 * time.Second)
				select {
				case <-ctx.Done():
					timer.Stop()
					return
				case <-timer.C:
					continue
				}
			}

			pubsub := RedisClient.Subscribe(ctx, "sys:events")
			log.Printf("Subscribed to global Redis events (sys:events)")

			ch := pubsub.Channel()
			for msg := range ch {
				var event PubSubEvent
				if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
					log.Printf("Error unmarshaling event: %v", err)
					continue
				}

				// Extract trace context
				parentCtx := otel.GetTextMapPropagator().Extract(ctx, propagation.MapCarrier(event.TraceContext))
				_, span := otel.Tracer("aktionfy").Start(parentCtx, "Redis Subscription")

				onEvent(parentCtx, event)
				span.End()
			}

			pubsub.Close()
			log.Printf("Redis system_events channel closed. Retrying in 5s...")

			timer := time.NewTimer(5 * time.Second)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-timer.C:
				// retry
			}
		}
	}
}

// publishTrace emits a live trace event for real-time terminal streaming
func publishTrace(ctx context.Context, userID string, trace db.ExecutionTrace, err error) {
	if err == nil {
		PublishTraceEvent(ctx, userID, trace)
	}
}

// PublishTraceEvent publishes a live execution trace event to the user's event stream
func PublishTraceEvent(ctx context.Context, userID string, trace db.ExecutionTrace) {
	payload, err := json.Marshal(trace)
	if err != nil {
		log.Printf("Error marshaling trace event for %s: %v", userID, err)
		return
	}

	PublishEvent(ctx, PubSubEvent{
		UserID:    userID,
		EventType: "trace_created",
		Payload:   string(payload),
	})
}
