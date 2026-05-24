package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"aktionfy/db"
)

const (
	WorkspaceCacheTTL = 30 * time.Minute
)

// GetCachedWorkspaces retrieves user workspaces from Redis if present.
// It fails open, logging a warning and returning nil if Redis is offline or an error occurs.
func GetCachedWorkspaces(ctx context.Context, userID string) ([]db.Workspace, error) {
	if RedisClient == nil {
		return nil, nil // Fail open (cache miss)
	}

	key := fmt.Sprintf("cache:workspaces:%s", userID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		// Cache miss or network error
		return nil, nil
	}

	var workspaces []db.Workspace
	if err := json.Unmarshal([]byte(data), &workspaces); err != nil {
		log.Printf("Warning: failed to unmarshal cached workspaces for user %s: %v", userID, err)
		return nil, nil // Fail open
	}

	return workspaces, nil
}

// SetCachedWorkspaces commits user workspaces into Redis.
// It fails open, logging warning on failure.
func SetCachedWorkspaces(ctx context.Context, userID string, workspaces []db.Workspace) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:workspaces:%s", userID)
	bytes, err := json.Marshal(workspaces)
	if err != nil {
		log.Printf("Warning: failed to marshal workspaces for cache, user %s: %v", userID, err)
		return
	}

	err = RedisClient.Set(ctx, key, string(bytes), WorkspaceCacheTTL).Err()
	if err != nil {
		log.Printf("Warning: failed to set workspaces cache in Redis for user %s: %v", userID, err)
	}
}

// InvalidateCachedWorkspaces deletes the cached workspaces from Redis.
// It fails open, logging warning on failure.
func InvalidateCachedWorkspaces(ctx context.Context, userID string) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:workspaces:%s", userID)
	err := RedisClient.Del(ctx, key).Err()
	if err != nil {
		log.Printf("Warning: failed to invalidate workspaces cache in Redis for user %s: %v", userID, err)
	}
}
