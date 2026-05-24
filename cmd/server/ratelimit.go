package main

import (
	"context"
	"log"
	"strings"
	"time"

	"aktionfy/db"
	"github.com/redis/go-redis/v9"
)

const (
	// RateTokensPerSec is the rate at which tokens are added to the bucket (5 tokens/sec)
	RateTokensPerSec = 5.0
	// BurstCapacity is the maximum number of tokens in the bucket (10 burst)
	BurstCapacity = 10.0
)

var rateLimitScript = redis.NewScript(`
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = 1

local bucket = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
	tokens = capacity
	last_refill = now
end

local elapsed = now - last_refill
local refill = (elapsed / 1000.0) * rate
tokens = math.min(capacity, tokens + refill)

if tokens >= requested then
	tokens = tokens - requested
	redis.call("HSET", key, "tokens", tokens, "last_refill", now)
	redis.call("EXPIRE", key, math.ceil(capacity / rate) + 1)
	return 1
else
	redis.call("HSET", key, "tokens", tokens, "last_refill", last_refill)
	redis.call("EXPIRE", key, math.ceil(capacity / rate) + 1)
	return 0
end
`)

type rateLimiter struct {
	client *redis.Client
}

func (rl *rateLimiter) Allow(ctx context.Context, userID string) bool {
	if rl.client == nil {
		log.Printf("WARNING: Rate limiter client is nil for user %s. Failing open.", userID)
		return true
	}

	rate := RateTokensPerSec
	capacity := BurstCapacity

	// Check for user-specific rate overrides
	if !strings.HasPrefix(userID, "ip:") {
		var u db.GetUserRow
		var err error
		cachedUser, cacheErr := GetCachedUser(ctx, userID)
		if cacheErr == nil && cachedUser != nil {
			u = *cachedUser
		} else {
			u, err = queries.GetUser(ctx, userID)
			if err == nil {
				SetCachedUser(ctx, userID, u)
			}
		}
		if (err == nil || cachedUser != nil) && u.RateLimitOverride.Valid {
			rate = float64(u.RateLimitOverride.Int32)
			capacity = float64(u.RateLimitOverride.Int32 * 2)
		}
	}

	now := time.Now().UTC().UnixMilli()
	key := "ratelimit:" + userID

	ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()

	result, err := rateLimitScript.Run(ctx, rl.client, []string{key}, rate, capacity, now).Result()
	if err != nil {
		log.Printf("WARNING: Rate limit Lua script error for user %s: %v. Failing open.", userID, err)
		return true
	}

	allowed, ok := result.(int64)
	if !ok {
		log.Printf("WARNING: Rate limit result type assertion failed for user %s: expected int64, got %T. Failing open.", userID, result)
		return true
	}
	return allowed == 1
}
