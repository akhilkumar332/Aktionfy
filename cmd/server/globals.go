package main

import (
	"encoding/hex"
	"fmt"
	"html/template"
	"strings"
	"sync"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"schedule-mcp/db"
)

var (
	dbPool            *pgxpool.Pool
	queries           *db.Queries
	RedisClient       *redis.Client
	templates         *template.Template
	workerID          string
	workerWG          sync.WaitGroup
	globalRateLimiter = &rateLimiter{}
)

func formatUUID(id pgtype.UUID) string {
	var idStr [36]byte
	hex.Encode(idStr[:8], id.Bytes[:4])
	idStr[8] = '-'
	hex.Encode(idStr[9:13], id.Bytes[4:6])
	idStr[13] = '-'
	hex.Encode(idStr[14:18], id.Bytes[6:8])
	idStr[18] = '-'
	hex.Encode(idStr[19:23], id.Bytes[8:10])
	idStr[23] = '-'
	hex.Encode(idStr[24:], id.Bytes[10:])
	return string(idStr[:])
}

func parseUUID(src string, dst *pgtype.UUID) error {
	src = strings.ReplaceAll(src, "-", "")
	if len(src) != 32 {
		return fmt.Errorf("invalid uuid length")
	}
	data, err := hex.DecodeString(src)
	if err != nil {
		return err
	}
	copy(dst.Bytes[:], data)
	dst.Valid = true
	return nil
}
