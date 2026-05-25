package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"aktionfy/db"
	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
)

const (
	// DefaultRateLimitSec is the default allowed requests per second
	DefaultRateLimitSec = 5.0
	// WindowSizeMs is the sliding window size in milliseconds (10 seconds)
	WindowSizeMs = 10000.0
)

var slidingRateLimitScript = redis.NewScript(`
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local window = tonumber(ARGV[3])
local member = ARGV[4]

-- Remove timestamps older than the sliding window
redis.call("ZREMRANGEBYSCORE", key, "-inf", now - window)

-- Count remaining requests in the window
local count = redis.call("ZCARD", key)

if count < limit then
	redis.call("ZADD", key, now, member)
	redis.call("EXPIRE", key, math.ceil(window / 1000.0) + 1)
	return 1
else
	redis.call("EXPIRE", key, math.ceil(window / 1000.0) + 1)
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

	rateSec := DefaultRateLimitSec

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
			rateSec = float64(u.RateLimitOverride.Int32)
		}
	}

	limit := int64(rateSec * (WindowSizeMs / 1000.0))
	now := time.Now().UTC().UnixMilli()
	member := fmt.Sprintf("%d:%d", now, time.Now().UnixNano())
	key := "ratelimit:zset:" + userID

	ctx, cancel := context.WithTimeout(ctx, 100*time.Millisecond)
	defer cancel()

	result, err := slidingRateLimitScript.Run(ctx, rl.client, []string{key}, limit, now, WindowSizeMs, member).Result()
	if err != nil {
		log.Printf("WARNING: Sliding rate limit Lua script error for user %s: %v. Failing open.", userID, err)
		return true
	}

	allowed, ok := result.(int64)
	if !ok {
		log.Printf("WARNING: Sliding rate limit result type assertion failed for user %s: expected int64, got %T. Failing open.", userID, result)
		return true
	}
	return allowed == 1
}

// UserRateLimitMiddleware is a simple token bucket implementation
func UserRateLimitMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID, ok := c.Get("user_id").(string)
		if !ok || userID == "" {
			return next(c)
		}
		if RedisClient != nil {
			key := "rate:" + userID
			count, err := RedisClient.Incr(c.Request().Context(), key).Result()
			if err != nil {
				log.Printf("WARNING: Rate limit Incr failed for user %s: %v", userID, err)
			} else {
				if count == 1 {
					RedisClient.Expire(c.Request().Context(), key, time.Minute)
				}
				if count > 100 { // 100 req per min
					return c.JSON(http.StatusTooManyRequests, APIResponse{Success: false, Error: "Rate limit exceeded"})
				}
			}
		}
		return next(c)
	}
}
