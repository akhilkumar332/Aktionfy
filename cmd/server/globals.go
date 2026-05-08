package main

import (
	"sync"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var (
	dbPool            *pgxpool.Pool
	redisClient       *redis.Client
	workerID          string
	workerWG          sync.WaitGroup
	globalRateLimiter = &rateLimiter{}
)
