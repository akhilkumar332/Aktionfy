package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"aktionfy/db"
)

const (
	WorkspaceCacheTTL = 30 * time.Minute
	TemplateCacheTTL  = 10 * time.Minute
	SecretsCacheTTL   = 15 * time.Minute
)

// --- Workspace Caching ---

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

// --- Public Templates Caching ---

// normalizeSearchKey sanitizes and lowercases a search term for consistent cache keys.
func normalizeSearchKey(search string) string {
	return strings.ToLower(strings.TrimSpace(search))
}

// GetCachedPublicTemplates retrieves public templates from Redis keyed by search query.
// It fails open, returning nil on cache miss or error.
func GetCachedPublicTemplates(ctx context.Context, search string) ([]db.Template, error) {
	if RedisClient == nil {
		return nil, nil
	}

	key := fmt.Sprintf("cache:templates:public:%s", normalizeSearchKey(search))
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil
	}

	var templates []db.Template
	if err := json.Unmarshal([]byte(data), &templates); err != nil {
		log.Printf("Warning: failed to unmarshal cached templates for search '%s': %v", search, err)
		return nil, nil
	}

	return templates, nil
}

// SetCachedPublicTemplates stores public templates in Redis keyed by search query.
// It fails open, logging warning on failure.
func SetCachedPublicTemplates(ctx context.Context, search string, templates []db.Template) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:templates:public:%s", normalizeSearchKey(search))
	bytes, err := json.Marshal(templates)
	if err != nil {
		log.Printf("Warning: failed to marshal templates for cache, search '%s': %v", search, err)
		return
	}

	err = RedisClient.Set(ctx, key, string(bytes), TemplateCacheTTL).Err()
	if err != nil {
		log.Printf("Warning: failed to set templates cache in Redis for search '%s': %v", search, err)
	}
}

// InvalidateCachedPublicTemplates clears all public template caches using key-prefix scan.
// This is used on template creation/mutation to ensure freshness.
// It fails open, logging warning on failure.
func InvalidateCachedPublicTemplates(ctx context.Context) {
	if RedisClient == nil {
		return
	}

	// Use SCAN with pattern to find and delete all template cache keys
	iter := RedisClient.Scan(ctx, 0, "cache:templates:public:*", 100).Iterator()
	for iter.Next(ctx) {
		if err := RedisClient.Del(ctx, iter.Val()).Err(); err != nil {
			log.Printf("Warning: failed to delete template cache key %s: %v", iter.Val(), err)
		}
	}
	if err := iter.Err(); err != nil {
		log.Printf("Warning: failed to scan template cache keys for invalidation: %v", err)
	}
}

// --- User Secrets Caching ---

// GetCachedUserSecrets retrieves the user's secret list from Redis if present.
// It fails open, returning nil on cache miss or error.
func GetCachedUserSecrets(ctx context.Context, userID string) ([]db.ListUserSecretsRow, error) {
	if RedisClient == nil {
		return nil, nil
	}

	key := fmt.Sprintf("cache:secrets:%s", userID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil
	}

	var secrets []db.ListUserSecretsRow
	if err := json.Unmarshal([]byte(data), &secrets); err != nil {
		log.Printf("Warning: failed to unmarshal cached secrets for user %s: %v", userID, err)
		return nil, nil
	}

	return secrets, nil
}

// SetCachedUserSecrets stores the user's secret listing in Redis.
// It fails open, logging warning on failure.
func SetCachedUserSecrets(ctx context.Context, userID string, secrets []db.ListUserSecretsRow) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:secrets:%s", userID)
	bytes, err := json.Marshal(secrets)
	if err != nil {
		log.Printf("Warning: failed to marshal secrets for cache, user %s: %v", userID, err)
		return
	}

	err = RedisClient.Set(ctx, key, string(bytes), SecretsCacheTTL).Err()
	if err != nil {
		log.Printf("Warning: failed to set secrets cache in Redis for user %s: %v", userID, err)
	}
}

// InvalidateCachedUserSecrets deletes the cached secrets list for a user.
// It fails open, logging warning on failure.
func InvalidateCachedUserSecrets(ctx context.Context, userID string) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:secrets:%s", userID)
	err := RedisClient.Del(ctx, key).Err()
	if err != nil {
		log.Printf("Warning: failed to invalidate secrets cache in Redis for user %s: %v", userID, err)
	}
}
