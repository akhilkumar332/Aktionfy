# Redis Architecture & Live Pub/Sub Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Redis for Pub/Sub and centralize global state to support distributed live updates.

**Architecture:** Introduce a Redis client in the Go backend. Create a Pub/Sub module that allows worker nodes to publish task execution events, and the web server to subscribe and push those events down to connected users via Server-Sent Events (SSE).

**Tech Stack:** Go, Redis, go-redis/redis/v8, SSE

---

### Task 1: Add Redis to Infrastructure

**Files:**
- Modify: `docker-compose.yml`
- Modify: `go.mod`

- [ ] **Step 1: Add Redis to docker-compose**

Add the redis service to `docker-compose.yml`.

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

- [ ] **Step 2: Add go-redis dependency**

Run: `go get github.com/go-redis/redis/v8`
Expected: downloads and adds to go.mod

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml go.mod go.sum
git commit -m "chore: add redis infrastructure and dependencies"
```

### Task 2: Centralize State and Redis Initialization

**Files:**
- Modify: `cmd/server/globals.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Update globals.go with Redis client**

```go
package main

import (
	"github.com/go-redis/redis/v8"
)

var (
	RedisClient *redis.Client
)
```

- [ ] **Step 2: Initialize Redis in main.go**

In `cmd/server/main.go`, add Redis initialization before starting the server.

```go
package main

import (
	"context"
	"log"
	"os"
	"github.com/go-redis/redis/v8"
)

func initRedis() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	RedisClient = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	
	_, err := RedisClient.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis")
}

// Inside func main()
// initRedis()
```

- [ ] **Step 3: Commit**

```bash
git add cmd/server/globals.go cmd/server/main.go
git commit -m "feat: initialize redis client"
```

### Task 3: Implement Pub/Sub Module

**Files:**
- Create: `cmd/server/pubsub.go`

- [ ] **Step 1: Write Pub/Sub logic**

```go
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
```

- [ ] **Step 2: Commit**

```bash
git add cmd/server/pubsub.go
git commit -m "feat: implement redis pub/sub module"
```

### Task 4: Integrate Pub/Sub with SSE

**Files:**
- Modify: `cmd/server/main.go` or `cmd/server/session.go` (where SSE connections are managed)

- [ ] **Step 1: Start global subscriber in main.go**

```go
// Inside func main(), after initRedis():
go func() {
	SubscribeToEvents(context.Background(), func(event PubSubEvent) {
		// Route event to active SSE connection if present in GlobalSessionManager
		// Assuming GlobalSessionManager exists and has a method to SendData
		// e.g., GlobalSessionManager.SendToUser(event.UserID, event.Payload)
        log.Printf("Received event for user %s: %s", event.UserID, event.EventType)
	})
}()
```

- [ ] **Step 2: Build and Verify**

Run: `go build -o server_bin ./cmd/server`
Expected: builds successfully

- [ ] **Step 3: Commit**

```bash
git add cmd/server/main.go
git commit -m "feat: start global redis event subscriber"
```