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
	"github.com/redis/go-redis/v9"
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

// --- Task Caching ---

const (
	TaskCacheTTL      = 10 * time.Minute
	DashboardCacheTTL = 1 * time.Minute
)

// GetCachedTasks retrieves user tasks from Redis if present.
func GetCachedTasks(ctx context.Context, userID string) ([]db.ListUserTasksRow, error) {
	if RedisClient == nil {
		return nil, nil
	}

	key := fmt.Sprintf("cache:tasks:%s", userID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil // Cache miss or network error
	}

	var tasks []db.ListUserTasksRow
	if err := json.Unmarshal([]byte(data), &tasks); err != nil {
		log.Printf("Warning: failed to unmarshal cached tasks for user %s: %v", userID, err)
		return nil, nil
	}

	return tasks, nil
}

// SetCachedTasks stores user tasks in Redis.
func SetCachedTasks(ctx context.Context, userID string, tasks []db.ListUserTasksRow) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:tasks:%s", userID)
	bytes, err := json.Marshal(tasks)
	if err != nil {
		log.Printf("Warning: failed to marshal tasks for cache, user %s: %v", userID, err)
		return
	}

	err = RedisClient.Set(ctx, key, string(bytes), TaskCacheTTL).Err()
	if err != nil {
		log.Printf("Warning: failed to set tasks cache in Redis for user %s: %v", userID, err)
	}
}

// InvalidateCachedTasks clears cached tasks and dashboard for a user.
func InvalidateCachedTasks(ctx context.Context, userID string) {
	if RedisClient == nil {
		return
	}

	keys := []string{
		fmt.Sprintf("cache:tasks:%s", userID),
		fmt.Sprintf("cache:dashboard:%s", userID),
	}
	err := RedisClient.Del(ctx, keys...).Err()
	if err != nil {
		log.Printf("Warning: failed to invalidate tasks/dashboard cache in Redis for user %s: %v", userID, err)
	}
}

// --- Dashboard Caching ---

type CachedDashboardData struct {
	User      interface{} `json:"user"`
	TaskCount int64       `json:"taskCount"`
}

// GetCachedDashboard retrieves user dashboard stats from Redis if present.
func GetCachedDashboard(ctx context.Context, userID string) (*CachedDashboardData, error) {
	if RedisClient == nil {
		return nil, nil
	}

	key := fmt.Sprintf("cache:dashboard:%s", userID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil
	}

	var dash CachedDashboardData
	if err := json.Unmarshal([]byte(data), &dash); err != nil {
		log.Printf("Warning: failed to unmarshal cached dashboard for user %s: %v", userID, err)
		return nil, nil
	}

	return &dash, nil
}

// SetCachedDashboard stores user dashboard stats in Redis.
func SetCachedDashboard(ctx context.Context, userID string, dash *CachedDashboardData) {
	if RedisClient == nil {
		return
	}

	key := fmt.Sprintf("cache:dashboard:%s", userID)
	bytes, err := json.Marshal(dash)
	if err != nil {
		log.Printf("Warning: failed to marshal dashboard for cache, user %s: %v", userID, err)
		return
	}

	err = RedisClient.Set(ctx, key, string(bytes), DashboardCacheTTL).Err()
	if err != nil {
		log.Printf("Warning: failed to set dashboard cache in Redis for user %s: %v", userID, err)
	}
}

// --- Analytics & Insights Caching ---

const (
	InsightsCacheTTL = 1 * time.Minute
	TrendsCacheTTL   = 5 * time.Minute
)

// GetCachedInsights retrieves the system insights from Redis.
func GetCachedInsights(ctx context.Context) (string, error) {
	if RedisClient == nil {
		return "", nil
	}
	return RedisClient.Get(ctx, "cache:admin:insights").Result()
}

// SetCachedInsights stores the system insights in Redis.
func SetCachedInsights(ctx context.Context, data string) {
	if RedisClient == nil {
		return
	}
	_ = RedisClient.Set(ctx, "cache:admin:insights", data, InsightsCacheTTL).Err()
}

// InvalidateCachedInsights clears the cached system insights.
func InvalidateCachedInsights(ctx context.Context) {
	if RedisClient == nil {
		return
	}
	_ = RedisClient.Del(ctx, "cache:admin:insights").Err()
}

// GetCachedTrends retrieves analytics trends from Redis.
func GetCachedTrends(ctx context.Context) (string, error) {
	if RedisClient == nil {
		return "", nil
	}
	return RedisClient.Get(ctx, "cache:admin:trends").Result()
}

// SetCachedTrends stores analytics trends in Redis.
func SetCachedTrends(ctx context.Context, data string) {
	if RedisClient == nil {
		return
	}
	_ = RedisClient.Set(ctx, "cache:admin:trends", data, TrendsCacheTTL).Err()
}

// InvalidateCachedTrends clears the cached analytics trends.
func InvalidateCachedTrends(ctx context.Context) {
	if RedisClient == nil {
		return
	}
	_ = RedisClient.Del(ctx, "cache:admin:trends").Err()
}

// AcquireTaskLock attempts to acquire a distributed lock for a task in Redis using SETNX.
// Returns true if the lock was acquired, and a release function.
func AcquireTaskLock(ctx context.Context, taskID string, ttl time.Duration) (bool, func()) {
	if RedisClient == nil {
		// If Redis is offline, fail-open to allow execution but log warning
		log.Printf("Warning: Redis offline, bypassing distributed lock for task %s", taskID)
		return true, func() {}
	}

	key := fmt.Sprintf("lock:task:run:%s", taskID)
	val := workerID
	if val == "" {
		val = "unknown-worker"
	}

	acquired, err := RedisClient.SetNX(ctx, key, val, ttl).Result()
	if err != nil {
		log.Printf("Warning: failed to communicate with Redis for lock %s: %v. Failing open.", key, err)
		return true, func() {}
	}

	if !acquired {
		return false, nil
	}

	releaseFunc := func() {
		// Release lock only if we own it (Lua script to guarantee atomicity)
		releaseScript := redis.NewScript(`
			if redis.call("get", KEYS[1]) == ARGV[1] then
				return redis.call("del", KEYS[1])
			else
				return 0
			end
		`)
		_, _ = releaseScript.Run(context.Background(), RedisClient, []string{key}, val).Result()
	}

	return true, releaseFunc
}

// RecordTaskExecutionTelemetry logs task execution status and timestamp to Redis ZSETs for hourly analytics.
func RecordTaskExecutionTelemetry(ctx context.Context, userID string, taskID string, status string) {
	if RedisClient == nil {
		return
	}
	now := time.Now().UTC()
	timestamp := now.Unix()
	member := fmt.Sprintf("%s:%s:%d:%d", taskID, status, timestamp, now.UnixNano())

	// ZAdd into global, user, and task-specific sorted sets
	keyUser := fmt.Sprintf("analytics:runs:%s", userID)
	keyGlobal := "analytics:runs:global"
	keyTask := fmt.Sprintf("analytics:runs:task:%s", taskID)

	_ = RedisClient.ZAdd(ctx, keyUser, redis.Z{Score: float64(timestamp), Member: member}).Err()
	_ = RedisClient.ZAdd(ctx, keyGlobal, redis.Z{Score: float64(timestamp), Member: member}).Err()
	_ = RedisClient.ZAdd(ctx, keyTask, redis.Z{Score: float64(timestamp), Member: member}).Err()

	// Keep only the last 30 days of data in Redis to prevent memory leaks
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour).Unix()
	_ = RedisClient.ZRemRangeByScore(ctx, keyUser, "-inf", fmt.Sprintf("%d", thirtyDaysAgo)).Err()
	_ = RedisClient.ZRemRangeByScore(ctx, keyGlobal, "-inf", fmt.Sprintf("%d", thirtyDaysAgo)).Err()
	_ = RedisClient.ZRemRangeByScore(ctx, keyTask, "-inf", fmt.Sprintf("%d", thirtyDaysAgo)).Err()
}

// --- User Auth & Session Caching ---

const (
	UserCacheTTL = 2 * time.Minute
)

// GetCachedUserBySession retrieves the user session data from Redis.
func GetCachedUserBySession(ctx context.Context, sessionID string) (*db.GetUserBySessionIDRow, error) {
	if RedisClient == nil {
		return nil, nil
	}
	key := fmt.Sprintf("cache:user:session:%s", sessionID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil // Cache miss
	}
	var row db.GetUserBySessionIDRow
	if err := json.Unmarshal([]byte(data), &row); err != nil {
		log.Printf("Warning: failed to unmarshal cached user by session: %v", err)
		return nil, nil
	}
	return &row, nil
}

// SetCachedUserBySession stores the user session data in Redis and tracks the session ID for user-scoped invalidation.
func SetCachedUserBySession(ctx context.Context, sessionID string, row db.GetUserBySessionIDRow) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:user:session:%s", sessionID)
	bytes, err := json.Marshal(row)
	if err != nil {
		log.Printf("Warning: failed to marshal user session row: %v", err)
		return
	}
	_ = RedisClient.Set(ctx, key, string(bytes), UserCacheTTL).Err()

	// Track this session ID for the user to support user-scoped invalidation
	setKey := fmt.Sprintf("cache:user:session-ids:%s", row.ID)
	_ = RedisClient.SAdd(ctx, setKey, sessionID).Err()
	_ = RedisClient.Expire(ctx, setKey, UserCacheTTL).Err()
}

// InvalidateCachedUserBySession deletes the cached user session data from Redis.
func InvalidateCachedUserBySession(ctx context.Context, sessionID string) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:user:session:%s", sessionID)
	_ = RedisClient.Del(ctx, key).Err()
}

// GetCachedUserByAPIKey retrieves the user API key row from Redis.
func GetCachedUserByAPIKey(ctx context.Context, apiKey string) (*db.GetUserByAPIKeyRow, error) {
	if RedisClient == nil {
		return nil, nil
	}
	key := fmt.Sprintf("cache:user:apikey:%s", apiKey)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil // Cache miss
	}
	var row db.GetUserByAPIKeyRow
	if err := json.Unmarshal([]byte(data), &row); err != nil {
		log.Printf("Warning: failed to unmarshal cached user by apiKey: %v", err)
		return nil, nil
	}
	return &row, nil
}

// SetCachedUserByAPIKey stores the user API key row in Redis.
func SetCachedUserByAPIKey(ctx context.Context, apiKey string, row db.GetUserByAPIKeyRow) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:user:apikey:%s", apiKey)
	bytes, err := json.Marshal(row)
	if err != nil {
		log.Printf("Warning: failed to marshal user api key row: %v", err)
		return
	}
	_ = RedisClient.Set(ctx, key, string(bytes), UserCacheTTL).Err()
}

// InvalidateCachedUserByAPIKey deletes the cached API key lookup from Redis.
func InvalidateCachedUserByAPIKey(ctx context.Context, apiKey string) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:user:apikey:%s", apiKey)
	_ = RedisClient.Del(ctx, key).Err()
}

// GetCachedUser retrieves db.GetUserRow from Redis.
func GetCachedUser(ctx context.Context, userID string) (*db.GetUserRow, error) {
	if RedisClient == nil {
		return nil, nil
	}
	key := fmt.Sprintf("cache:user:profile:%s", userID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil // Cache miss
	}
	var u db.GetUserRow
	if err := json.Unmarshal([]byte(data), &u); err != nil {
		log.Printf("Warning: failed to unmarshal cached user profile: %v", err)
		return nil, nil
	}
	return &u, nil
}

// SetCachedUser stores db.GetUserRow in Redis.
func SetCachedUser(ctx context.Context, userID string, u db.GetUserRow) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:user:profile:%s", userID)
	bytes, err := json.Marshal(u)
	if err != nil {
		log.Printf("Warning: failed to marshal user profile: %v", err)
		return
	}
	_ = RedisClient.Set(ctx, key, string(bytes), UserCacheTTL).Err()
}

// InvalidateCachedUser deletes the cached db.GetUserRow from Redis.
func InvalidateCachedUser(ctx context.Context, userID string) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:user:profile:%s", userID)
	_ = RedisClient.Del(ctx, key).Err()
}

// InvalidateUserCaches invalidates all API key, session, and profile caches associated with a user ID.
func InvalidateUserCaches(ctx context.Context, userID string) {
	if RedisClient == nil {
		return
	}
	// 1. Get user details from DB to find current API key
	u, err := queries.GetUser(ctx, userID)
	if err == nil {
		InvalidateCachedUserByAPIKey(ctx, u.ApiKey)
	}
	InvalidateCachedUser(ctx, userID)

	// 2. Get all tracked session IDs for the user and delete their cache keys
	setKey := fmt.Sprintf("cache:user:session-ids:%s", userID)
	sessionIDs, err := RedisClient.SMembers(ctx, setKey).Result()
	if err == nil {
		for _, sessID := range sessionIDs {
			InvalidateCachedUserBySession(ctx, sessID)
		}
	}
	_ = RedisClient.Del(ctx, setKey).Err()
}

// InvalidateAdminUsersCache clears all admin users cache using a key SCAN.
func InvalidateAdminUsersCache(ctx context.Context) {
	if RedisClient == nil {
		return
	}
	iter := RedisClient.Scan(ctx, 0, "cache:admin:users:*", 100).Iterator()
	for iter.Next(ctx) {
		_ = RedisClient.Del(ctx, iter.Val()).Err()
	}
}

// ActiveSessionMeta stores user-agent, IP, and activity time for a session.
type ActiveSessionMeta struct {
	SessionID  string `json:"session_id"`
	IPAddress  string `json:"ip_address"`
	UserAgent  string `json:"user_agent"`
	LastActive string `json:"last_active"`
}

// RecordActiveSession stores/updates session metadata in Redis.
func RecordActiveSession(ctx context.Context, userID string, sessionID string, ip string, userAgent string) {
	if RedisClient == nil {
		return
	}
	metaKey := fmt.Sprintf("session:meta:%s:%s", userID, sessionID)
	data := map[string]string{
		"session_id":  sessionID,
		"ip_address":  ip,
		"user_agent":  userAgent,
		"last_active": time.Now().UTC().Format(time.RFC3339),
	}
	_ = RedisClient.HMSet(ctx, metaKey, data).Err()
	_ = RedisClient.Expire(ctx, metaKey, 24*time.Hour).Err()

	// Track in active session IDs set
	idsKey := fmt.Sprintf("cache:user:session-ids:%s", userID)
	_ = RedisClient.SAdd(ctx, idsKey, sessionID).Err()
	_ = RedisClient.Expire(ctx, idsKey, 24*time.Hour).Err()
}

// GetActiveSessions returns all active session metadata for a user.
func GetActiveSessions(ctx context.Context, userID string) []ActiveSessionMeta {
	if RedisClient == nil {
		return []ActiveSessionMeta{}
	}
	idsKey := fmt.Sprintf("cache:user:session-ids:%s", userID)
	sessionIDs, err := RedisClient.SMembers(ctx, idsKey).Result()
	if err != nil {
		return []ActiveSessionMeta{}
	}

	var active []ActiveSessionMeta
	for _, sessID := range sessionIDs {
		metaKey := fmt.Sprintf("session:meta:%s:%s", userID, sessID)
		fields, err := RedisClient.HGetAll(ctx, metaKey).Result()
		if err == nil && len(fields) > 0 {
			active = append(active, ActiveSessionMeta{
				SessionID:  fields["session_id"],
				IPAddress:  fields["ip_address"],
				UserAgent:  fields["user_agent"],
				LastActive: fields["last_active"],
			})
		}
	}
	return active
}

// RevokeActiveSession deletes session from Redis cache and database.
func RevokeActiveSession(ctx context.Context, userID string, sessionID string) error {
	// 1. Delete from Redis
	if RedisClient != nil {
		metaKey := fmt.Sprintf("session:meta:%s:%s", userID, sessionID)
		_ = RedisClient.Del(ctx, metaKey).Err()
		idsKey := fmt.Sprintf("cache:user:session-ids:%s", userID)
		_ = RedisClient.SRem(ctx, idsKey, sessionID).Err()
		
		// Invalidate cached user session too
		sessCacheKey := fmt.Sprintf("cache:user:session:%s", sessionID)
		_ = RedisClient.Del(ctx, sessCacheKey).Err()
	}

	// 2. Delete from DB
	var pgSessID pgtype.UUID
	if err := parseUUID(sessionID, &pgSessID); err == nil {
		return queries.DeleteWebSession(ctx, pgSessID)
	}
	return nil
}

// GetCachedTask retrieves a single task from Redis.
func GetCachedTask(ctx context.Context, taskID string) (*db.Task, error) {
	if RedisClient == nil {
		return nil, nil
	}
	key := fmt.Sprintf("cache:task:%s", taskID)
	data, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		return nil, nil
	}
	var t db.Task
	if err := json.Unmarshal([]byte(data), &t); err != nil {
		log.Printf("Warning: failed to unmarshal cached task %s: %v", taskID, err)
		return nil, nil
	}
	return &t, nil
}

// SetCachedTask stores a single task in Redis.
func SetCachedTask(ctx context.Context, taskID string, t db.Task) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:task:%s", taskID)
	bytes, err := json.Marshal(t)
	if err != nil {
		log.Printf("Warning: failed to marshal task %s for cache: %v", taskID, err)
		return
	}
	_ = RedisClient.Set(ctx, key, string(bytes), 10*time.Minute).Err()
}

// InvalidateCachedTask deletes a single task cache.
func InvalidateCachedTask(ctx context.Context, taskID string) {
	if RedisClient == nil {
		return
	}
	key := fmt.Sprintf("cache:task:%s", taskID)
	_ = RedisClient.Del(ctx, key).Err()
}
