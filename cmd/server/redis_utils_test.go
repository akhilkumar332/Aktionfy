package main

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestAcquireRedisLock_FailOpen(t *testing.T) {
	RedisClient = nil
	token, ok := AcquireRedisLock(context.Background(), "test_lock", time.Second)
	if !ok {
		t.Errorf("Expected true for fail-open, got false")
	}
	if token != "" {
		t.Errorf("Expected empty token, got %s", token)
	}
}

func TestAcquireRedisLock_Error(t *testing.T) {
	// Point to a non-existent redis server
	RedisClient = redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:12345",
	})
	
	// Fast timeout so it doesn't hang
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	token, ok := AcquireRedisLock(ctx, "test_lock", time.Second)
	if !ok {
		t.Errorf("Expected true for connection error (fail open), got false")
	}
	if token != "" {
		t.Errorf("Expected empty token on error, got %s", token)
	}
}

func TestReleaseRedisLock_NilClient(t *testing.T) {
	RedisClient = nil
	// Should not panic
	ReleaseRedisLock(context.Background(), "test_lock", "token")
}
