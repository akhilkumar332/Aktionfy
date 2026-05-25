package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type SearchResult struct {
	Type    string `json:"type"`
	ID      string `json:"id"`
	Name    string `json:"name"`
	Subtext string `json:"subtext"`
}

func apiSearchHandler(c echo.Context) error {
	q := c.QueryParam("q")
	if q == "" {
		return c.JSON(http.StatusOK, APIResponse{Success: true, Data: []SearchResult{}})
	}

	userID := c.Get("user_id").(string)
	userRole := c.Get("user_role").(string)

	cacheKey := fmt.Sprintf("cache:search:%s:%s", userID, q)
	if RedisClient != nil {
		if data, err := RedisClient.Get(c.Request().Context(), cacheKey).Result(); err == nil {
			var cached []SearchResult
			if err := json.Unmarshal([]byte(data), &cached); err == nil {
				return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cached})
			}
		}
	}

	results := []SearchResult{}

	// 1. Search Tasks (User specific)
	taskRows, err := queries.SearchUserTasks(c.Request().Context(), db.SearchUserTasksParams{
		UserID:    userID,
		Search:    q,
		Status:    "",
		LimitVal:  10,
		OffsetVal: 0,
	})
	if err == nil {
		for _, t := range taskRows {
			results = append(results, SearchResult{
				Type:    "task",
				ID:      formatUUID(t.ID),
				Name:    t.Name,
				Subtext: fmt.Sprintf("Status: %s", t.Status.String),
			})
		}
	}

	// 2. Search Blueprints/Templates (Public templates)
	templateRows, err := queries.ListPublicTemplates(c.Request().Context(), "%"+q+"%")
	if err == nil {
		for _, t := range templateRows {
			results = append(results, SearchResult{
				Type:    "blueprint",
				ID:      formatUUID(t.ID),
				Name:    t.Name,
				Subtext: t.Description.String,
			})
		}
	}

	// 3. Search Users (Admin only)
	if userRole == "admin" || userRole == "staff" {
		userRows, err := queries.ListUsers(c.Request().Context(), pgtype.Text{String: "%" + q + "%", Valid: true})
		if err == nil {
			for _, u := range userRows {
				results = append(results, SearchResult{
					Type:    "user",
					ID:      u.ID,
					Name:    u.Email.String,
					Subtext: fmt.Sprintf("Role: %s, Tier: %s", u.Role.String, u.Tier.String),
				})
			}
		}
	}

	// Cache frequent search results for 5 minutes in Redis
	if RedisClient != nil {
		bytes, _ := json.Marshal(results)
		_ = RedisClient.Set(c.Request().Context(), cacheKey, string(bytes), 5*time.Minute).Err()
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: results})
}
