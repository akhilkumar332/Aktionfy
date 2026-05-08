package main

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
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
local refill = elapsed * rate
tokens = math.min(capacity, tokens + refill)

if tokens >= requested then
	tokens = tokens - requested
	redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
	redis.call("EXPIRE", key, math.ceil(capacity / rate) + 1)
	return 1
else
	redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
	redis.call("EXPIRE", key, math.ceil(capacity / rate) + 1)
	return 0
end
`)

type rateLimiter struct {
	client *redis.Client
}

func (rl *rateLimiter) Allow(userID string) bool {
	if rl.client == nil {
		// Fallback if redis is not ready
		return false
	}
	
	now := time.Now().UnixMilli()
	// rate: 5 tokens/sec = 0.005 tokens/ms
	// capacity: 10 burst
	key := "ratelimit:" + userID
	
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	result, err := rateLimitScript.Run(ctx, rl.client, []string{key}, 0.005, 10, now).Result()
	if err != nil {
		return false // Default deny on error
	}
	
	allowed, _ := result.(int64)
	return allowed == 1
}

func (rl *rateLimiter) cleanup() {
	// No-op: Redis EXPIRE handles cleanup
}
