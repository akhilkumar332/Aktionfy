package main

import (
	"context"
	"log"
	"time"
	"github.com/google/uuid"
)

// AcquireRedisLock attempts to acquire a distributed lock.
func AcquireRedisLock(ctx context.Context, lockKey string, ttl time.Duration) (string, bool) {
	if RedisClient == nil {
		return "", true // Fail-open
	}
	token := uuid.New().String()
	success, err := RedisClient.SetNX(ctx, lockKey, token, ttl).Result()
	if err != nil {
		log.Printf("WARNING: Failed to acquire Redis lock for %s: %v. Failing open.", lockKey, err)
		return "", true // Fail open on error to match unconfigured state
	}
	if !success {
		return "", false
	}
	return token, true
}

// ReleaseRedisLock releases a distributed lock using Lua script for safety.
func ReleaseRedisLock(ctx context.Context, lockKey, token string) {
	if RedisClient == nil {
		return
	}
	script := `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		else
			return 0
		end
	`
	RedisClient.Eval(ctx, script, []string{lockKey}, token)
}
