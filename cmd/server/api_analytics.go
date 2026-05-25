package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
)

func handleGetSystemInsights(c echo.Context) error {
	ctx := c.Request().Context()

	// Try reading insights from Redis cache first
	if cachedStr, err := GetCachedInsights(ctx); err == nil && cachedStr != "" {
		return c.Blob(http.StatusOK, "application/json", []byte(cachedStr))
	}

	p99, err := queries.GetP99ExecutionLatency(ctx)
	if err != nil {
		p99 = 0
	}

	successRateRaw, err := queries.GetGlobalSuccessRate(ctx)
	if err != nil {
		successRateRaw = 100.0
	}

	activeSessions, err := GlobalSessionManager.GetActiveSessionCount(ctx)
	if err != nil {
		activeSessions = 0
	}

	workerCount, err := queries.GetActiveWorkerCount(ctx)
	if err != nil {
		workerCount = 0
	}

	trends, err := queries.GetDailyExecutionTrends(ctx)
	if err != nil {
		trends = []db.GetDailyExecutionTrendsRow{}
	}

	// Map trends to expected format
	dailyTasks := []map[string]interface{}{}
	for _, t := range trends {
		dailyTasks = append(dailyTasks, map[string]interface{}{
			"date":  t.Date,
			"count": t.Count,
		})
	}

	// Type assertion for successRateRaw which is interface{} from sqlc
	var successRate float64
	switch v := successRateRaw.(type) {
	case float64:
		successRate = v
	case float32:
		successRate = float64(v)
	case int64:
		successRate = float64(v)
	case int32:
		successRate = float64(v)
	default:
		successRate = 100.0
	}

	data := map[string]interface{}{
		"p99_latency":     int64(p99),
		"success_rate":    successRate,
		"active_workers":  activeSessions, // Map sessions to "Active Actors" in UI
		"worker_count":    workerCount,    // Actual background worker nodes
		"active_sessions": activeSessions,
		"daily_tasks":     dailyTasks,
	}

	resp := APIResponse{Success: true, Data: data}
	if bytes, err := json.Marshal(resp); err == nil {
		SetCachedInsights(ctx, string(bytes))
	}

	return c.JSON(http.StatusOK, resp)
}

func handleGetTrends(c echo.Context) error {
	ctx := c.Request().Context()

	// Try reading trends from Redis cache first
	if cachedStr, err := GetCachedTrends(ctx); err == nil && cachedStr != "" {
		return c.Blob(http.StatusOK, "application/json", []byte(cachedStr))
	}

	now := time.Now().UTC()
	thirtyDaysAgo := now.Add(-30 * 24 * time.Hour)
	sixtyDaysAgo := now.Add(-60 * 24 * time.Hour)

	// 1. Total Tasks Trends
	currentTasks, err := queries.GetCountTracesAfter(ctx, pgtype.Timestamptz{Time: thirtyDaysAgo, Valid: true})
	if err != nil {
		log.Printf("Trends: failed to fetch current tasks: %v", err)
	}
	prevTasks, err := queries.GetCountTracesBetween(ctx, db.GetCountTracesBetweenParams{
		StartTime:   pgtype.Timestamptz{Time: sixtyDaysAgo, Valid: true},
		StartTime_2: pgtype.Timestamptz{Time: thirtyDaysAgo, Valid: true},
	})
	if err != nil {
		log.Printf("Trends: failed to fetch prev tasks: %v", err)
	}

	// 2. Success Rate Trends
	currentSuccess, err := queries.GetSuccessRateAfter(ctx, pgtype.Timestamptz{Time: thirtyDaysAgo, Valid: true})
	if err != nil {
		log.Printf("Trends: failed to fetch current success: %v", err)
		currentSuccess = 100.0
	}
	prevSuccess, err := queries.GetSuccessRateBetween(ctx, db.GetSuccessRateBetweenParams{
		StartTime:   pgtype.Timestamptz{Time: sixtyDaysAgo, Valid: true},
		StartTime_2: pgtype.Timestamptz{Time: thirtyDaysAgo, Valid: true},
	})
	if err != nil {
		log.Printf("Trends: failed to fetch prev success: %v", err)
		prevSuccess = 100.0
	}

	// 3. User Growth
	currentUsers, err := queries.GetCountUsersAfter(ctx, pgtype.Timestamptz{Time: thirtyDaysAgo, Valid: true})
	if err != nil {
		log.Printf("Trends: failed to fetch current users: %v", err)
	}
	prevUsers, err := queries.GetCountUsersBetween(ctx, db.GetCountUsersBetweenParams{
		CreatedAt:   pgtype.Timestamptz{Time: sixtyDaysAgo, Valid: true},
		CreatedAt_2: pgtype.Timestamptz{Time: thirtyDaysAgo, Valid: true},
	})
	if err != nil {
		log.Printf("Trends: failed to fetch prev users: %v", err)
	}

	calcGrowth := func(curr, prev float64) string {
		if prev == 0 {
			if curr > 0 {
				return "+100%"
			}
			return "0%"
		}
		growth := ((curr - prev) / prev) * 100
		if growth >= 0 {
			return fmt.Sprintf("+%.1f%%", growth)
		}
		return fmt.Sprintf("%.1f%%", growth)
	}

	resp := APIResponse{
		Success: true,
		Data: map[string]string{
			"tasks_growth":   calcGrowth(float64(currentTasks), float64(prevTasks)),
			"success_growth": calcGrowth(currentSuccess, prevSuccess),
			"users_growth":   calcGrowth(float64(currentUsers), float64(prevUsers)),
		},
	}

	if bytes, err := json.Marshal(resp); err == nil {
		SetCachedTrends(ctx, string(bytes))
	}

	return c.JSON(http.StatusOK, resp)
}

func handleGetWorkers(c echo.Context) error {
	ctx := c.Request().Context()
	
	type workerInfo struct {
		WorkerID      string    `json:"worker_id"`
		Hostname      string    `json:"hostname"`
		LastHeartbeat time.Time `json:"last_heartbeat"`
		Status        string    `json:"status"`
		TaskCount     int32     `json:"task_count"`
	}
	var data []workerInfo

	// 1. Try fetching from Redis Hashes (Real-time)
	if RedisClient != nil {
		keys, _, _ := RedisClient.Scan(ctx, 0, "sys:worker:*", 100).Result()
		for _, key := range keys {
			fields, err := RedisClient.HGetAll(ctx, key).Result()
			if err == nil && len(fields) > 0 {
				lastHb, _ := time.Parse(time.RFC3339, fields["updated_at"])
				taskCnt, _ := strconv.Atoi(fields["task_count"])
				data = append(data, workerInfo{
					WorkerID:      fields["id"],
					Hostname:      fields["hostname"],
					LastHeartbeat: lastHb,
					Status:        fields["status"],
					TaskCount:     int32(taskCnt),
				})
			}
		}
	}

	// 2. Fallback to DB if Redis is empty or offline
	if len(data) == 0 {
		workers, err := queries.ListWorkerHeartbeats(ctx)
		if err == nil {
			now := time.Now().UTC()
			for _, w := range workers {
				status := "offline"
				if w.LastHeartbeat.Valid && w.LastHeartbeat.Time.After(now.Add(-2*time.Minute)) {
					status = "online"
				}

				data = append(data, workerInfo{
					WorkerID:      w.WorkerID,
					Hostname:      w.Hostname.String,
					LastHeartbeat: w.LastHeartbeat.Time,
					Status:        status,
					TaskCount:     w.TaskCount.Int32,
				})
			}
		}
	}

	if data == nil {
		data = []workerInfo{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: data})
}

// handleGetHourlyHeatmap fetches the global hourly task execution counts from Redis ZSET.
func handleGetHourlyHeatmap(c echo.Context) error {
	ctx := c.Request().Context()
	
	heatmap, err := getHeatmapForZset(ctx, "analytics:runs:global")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to generate hourly heatmap"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: heatmap})
}

// handleGetTaskHourlyHeatmap fetches the task-specific hourly task execution counts from Redis ZSET.
func handleGetTaskHourlyHeatmap(c echo.Context) error {
	ctx := c.Request().Context()
	taskIDStr := c.Param("id")
	
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	key := fmt.Sprintf("analytics:runs:task:%s", taskIDStr)
	heatmap, err := getHeatmapForZset(ctx, key)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to generate task hourly heatmap"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: heatmap})
}

// handleGetTaskDurations fetches the recent duration data for a task to plot on a line chart.
func handleGetTaskDurations(c echo.Context) error {
	ctx := c.Request().Context()
	taskIDStr := c.Param("id")

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	taskID, err := mustParseUUID(c, taskIDStr)
	if err != nil {
		return err
	}

	// Check ownership
	exists, _ := queries.CheckTaskOwnership(ctx, db.CheckTaskOwnershipParams{ID: taskID, UserID: userID})
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	query := `
		SELECT start_time, duration_ms 
		FROM execution_traces 
		WHERE task_id = $1 AND duration_ms IS NOT NULL
		ORDER BY start_time DESC 
		LIMIT 50
	`
	rows, err := dbPool.Query(ctx, query, taskID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch task durations"})
	}
	defer rows.Close()

	type durationPoint struct {
		Time     string `json:"time"`
		Duration int    `json:"duration"`
	}

	var data []durationPoint
	for rows.Next() {
		var startTime time.Time
		var durationMs int
		if err := rows.Scan(&startTime, &durationMs); err == nil {
			data = append(data, durationPoint{
				Time:     startTime.Format("15:04"),
				Duration: durationMs,
			})
		}
	}

	// Reverse to get chronological order for Recharts
	for i, j := 0, len(data)-1; i < j; i, j = i+1, j-1 {
		data[i], data[j] = data[j], data[i]
	}

	if data == nil {
		data = []durationPoint{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: data})
}

// getHeatmapForZset is a helper that parses and aggregates ZSET logs into hourly buckets for the last 24 hours.
func getHeatmapForZset(ctx context.Context, key string) ([]map[string]interface{}, error) {
	if RedisClient == nil {
		// Redis offline, fail-open with empty list
		return []map[string]interface{}{}, nil
	}

	now := time.Now().UTC()
	start := now.Add(-24 * time.Hour).Unix()
	end := now.Unix()

	results, err := RedisClient.ZRangeByScore(ctx, key, &redis.ZRangeBy{
		Min: fmt.Sprintf("%d", start),
		Max: fmt.Sprintf("%d", end),
	}).Result()
	if err != nil {
		return nil, err
	}

	// Initialize hourly buckets for the last 24 hours
	hourlyBuckets := make(map[string]int)
	for i := 0; i < 24; i++ {
		t := now.Add(-time.Duration(i) * time.Hour)
		hourStr := t.Format("2006-01-02 15:00")
		hourlyBuckets[hourStr] = 0
	}

	// Parse members and increment buckets
	for _, member := range results {
		parts := strings.Split(member, ":")
		if len(parts) >= 3 {
			var ts int64
			_, _ = fmt.Sscanf(parts[2], "%d", &ts)
			if ts > 0 {
				t := time.Unix(ts, 0).UTC()
				hourStr := t.Format("2006-01-02 15:00")
				if _, exists := hourlyBuckets[hourStr]; exists {
					hourlyBuckets[hourStr]++
				}
			}
		}
	}

	// Format output in chronological order
	heatmap := []map[string]interface{}{}
	for i := 23; i >= 0; i-- {
		t := now.Add(-time.Duration(i) * time.Hour)
		hourStr := t.Format("2006-01-02 15:00")
		displayHour := t.Format("15:00")
		heatmap = append(heatmap, map[string]interface{}{
			"time":  hourStr,
			"label": displayHour,
			"count": hourlyBuckets[hourStr],
		})
	}

	return heatmap, nil
}

// handleGetRecentActivities fetches the last 50 activity events for the user from Redis.
func handleGetRecentActivities(c echo.Context) error {
	ctx := c.Request().Context()
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	if RedisClient == nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true, Data: []PubSubEvent{}})
	}

	key := fmt.Sprintf("user:activities:%s", userID)
	results, err := RedisClient.LRange(ctx, key, 0, 49).Result()
	if err != nil {
		log.Printf("Error fetching recent activities: %v", err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch activities"})
	}

	var events []PubSubEvent
	for _, raw := range results {
		var event PubSubEvent
		if err := json.Unmarshal([]byte(raw), &event); err == nil {
			events = append(events, event)
		}
	}

	if events == nil {
		events = []PubSubEvent{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: events})
}

// handleGetOnlineUsers returns a list of user IDs currently connected via WebSockets.
func handleGetOnlineUsers(c echo.Context) error {
	ctx := c.Request().Context()
	if RedisClient == nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true, Data: []string{}})
	}

	results, err := RedisClient.SMembers(ctx, "presence:online").Result()
	if err != nil {
		log.Printf("Error fetching online presence: %v", err)
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch online presence"})
	}

	if results == nil {
		results = []string{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: results})
}


