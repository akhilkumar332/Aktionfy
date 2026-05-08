package main

import (
	"sync"
	"time"
)

// rateLimiter struct to hold per-user token buckets
type rateLimiter struct {
	mu    sync.Mutex
	users map[string]*userRateLimit
}

type userRateLimit struct {
	tokens     float64
	lastRefill time.Time
}

// init starts a background goroutine to clean up stale rate limit entries
func init() {
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			globalRateLimiter.cleanup()
		}
	}()
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for userID, limit := range rl.users {
		// If user hasn't made a request in 10 minutes, remove them from memory
		if now.Sub(limit.lastRefill) > 10*time.Minute {
			delete(rl.users, userID)
		}
	}
}

// Allow limits to 5 requests per second, burst of 10
func (rl *rateLimiter) Allow(userID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	limit, ok := rl.users[userID]
	if !ok {
		rl.users[userID] = &userRateLimit{
			tokens:     10, // burst size
			lastRefill: now,
		}
		limit = rl.users[userID]
	}

	// Refill 5 tokens per second
	elapsed := now.Sub(limit.lastRefill).Seconds()
	limit.tokens += elapsed * 5.0
	if limit.tokens > 10 {
		limit.tokens = 10
	}
	limit.lastRefill = now

	if limit.tokens >= 1 {
		limit.tokens--
		return true
	}
	return false
}
