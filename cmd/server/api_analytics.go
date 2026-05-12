package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
)

func handleGetSystemInsights(c echo.Context) error {
	// For now, mock aggregate data for the dashboard
	// In the next step, we would add these to queries.sql
	data := map[string]interface{}{
		"p99_latency": 1250,
		"success_rate": 98.4,
		"active_workers": 4,
		"daily_tasks": []map[string]interface{}{
			{"date": "2026-05-10", "count": 120},
			{"date": "2026-05-11", "count": 145},
			{"date": "2026-05-12", "count": 132},
		},
	}
	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: data})
}
