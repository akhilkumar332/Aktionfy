package main

import (
	"html/template"
	"sync"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

var (
	dbPool            *pgxpool.Pool
	redisClient       *redis.Client
	templates         *template.Template
	workerID          string
	workerWG          sync.WaitGroup
	globalRateLimiter = &rateLimiter{}
)
