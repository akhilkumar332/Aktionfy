package main

import (
	"aktionfy/db"
	"encoding/hex"
	"fmt"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
	"net/http"
	"regexp"
	"strings"
	"sync"
)

var (
	dbPool            *pgxpool.Pool
	queries           *db.Queries
	RedisClient       *redis.Client
	appConfig         runtimeConfig
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

func mustParseUUID(c echo.Context, src string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := parseUUID(src, &id); err != nil {
		return id, c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid ID format"})
	}
	return id, nil
}

// maskSensitiveData looks for common secret patterns and masks them for UI safety.
func maskSensitiveData(input string) string {
	// Mask potential API keys, passwords, etc.
	// This is a simple heuristic-based masker for production UI safety.
	sensitivePatterns := []struct {
		regex *regexp.Regexp
		repl  string
	}{
		{regexp.MustCompile(`(?i)(api_key|password|secret|token|auth)["']?\s*[:=]\s*["']?([a-zA-Z0-9-_]{8,})["']?`), `$1: ********`},
		{regexp.MustCompile(`(?i)(Bearer\s+)([a-zA-Z0-9._-]{10,})`), `$1********`},
	}

	result := input
	for _, p := range sensitivePatterns {
		result = p.regex.ReplaceAllString(result, p.repl)
	}
	return result
}
