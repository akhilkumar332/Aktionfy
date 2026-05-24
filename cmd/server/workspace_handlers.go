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

func handleGetWorkspaces(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	// Attempt to resolve from Redis cache first
	cached, _ := GetCachedWorkspaces(c.Request().Context(), userID)
	if cached != nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cached})
	}

	workspaces, err := queries.GetUserWorkspaces(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch workspaces"})
	}
	if workspaces == nil {
		workspaces = []db.Workspace{}
	}

	// Populate Redis cache for subsequent calls
	SetCachedWorkspaces(c.Request().Context(), userID, workspaces)

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: workspaces})
}

func handleCreateWorkspace(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	var input struct {
		Name string `json:"name"`
	}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.Name == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Workspace name is required"})
	}

	workspace, err := queries.CreateWorkspace(c.Request().Context(), db.CreateWorkspaceParams{
		Name:    input.Name,
		OwnerID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create workspace"})
	}

	// Invalidate cache immediately on new workspace creation
	InvalidateCachedWorkspaces(c.Request().Context(), userID)

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "workspace_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusCreated, APIResponse{Success: true, Data: workspace})
}

func handleListWorkspaceEnvVars(c echo.Context) error {
	workspaceIDStr := c.Param("id")
	var workspaceID pgtype.UUID
	if err := parseUUID(workspaceIDStr, &workspaceID); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid workspace ID"})
	}

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	// Verify access
	hasAccess, err := queries.CheckWorkspaceAccess(c.Request().Context(), db.CheckWorkspaceAccessParams{
		ID:      workspaceID,
		OwnerID: userID,
	})
	if err != nil || !hasAccess {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	envVars, err := queries.ListWorkspaceEnvVars(c.Request().Context(), workspaceID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch environment variables"})
	}
	if envVars == nil {
		envVars = []db.WorkspaceEnvVar{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: envVars})
}

func handleUpsertWorkspaceEnvVar(c echo.Context) error {
	workspaceIDStr := c.Param("id")
	var workspaceID pgtype.UUID
	if err := parseUUID(workspaceIDStr, &workspaceID); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid workspace ID"})
	}

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	// Verify access
	hasAccess, err := queries.CheckWorkspaceAccess(c.Request().Context(), db.CheckWorkspaceAccessParams{
		ID:      workspaceID,
		OwnerID: userID,
	})
	if err != nil || !hasAccess {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	var input struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.Name == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Name is required"})
	}

	envVar, err := queries.UpsertWorkspaceEnvVar(c.Request().Context(), db.UpsertWorkspaceEnvVarParams{
		WorkspaceID: workspaceID,
		Name:        input.Name,
		Value:       input.Value,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to upsert environment variable"})
	}

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "workspace_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: envVar})
}

func handleDeleteWorkspaceEnvVar(c echo.Context) error {
	workspaceIDStr := c.Param("id")
	var workspaceID pgtype.UUID
	if err := parseUUID(workspaceIDStr, &workspaceID); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid workspace ID"})
	}

	name := c.Param("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Name is required"})
	}

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	// Verify access
	hasAccess, err := queries.CheckWorkspaceAccess(c.Request().Context(), db.CheckWorkspaceAccessParams{
		ID:      workspaceID,
		OwnerID: userID,
	})
	if err != nil || !hasAccess {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	err = queries.DeleteWorkspaceEnvVar(c.Request().Context(), db.DeleteWorkspaceEnvVarParams{
		WorkspaceID: workspaceID,
		Name:        name,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete environment variable"})
	}

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "workspace_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Environment variable deleted"})
}

type workspacePresence struct {
	UserID       string    `json:"user_id"`
	Email        string    `json:"email"`
	ActiveTaskID string    `json:"active_task_id"`
	LastSeen     time.Time `json:"last_seen"`
}

func handleWorkspacePresenceHeartbeat(c echo.Context) error {
	workspaceIDStr := c.Param("id")
	var workspaceID pgtype.UUID
	if err := parseUUID(workspaceIDStr, &workspaceID); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid workspace ID"})
	}

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	var input struct {
		ActiveTaskID string `json:"active_task_id"`
	}
	_ = c.Bind(&input)

	// Fetch user details for email
	user, err := queries.GetUser(c.Request().Context(), userID)
	email := "anonymous@aktionfy"
	if err == nil {
		if user.Email.Valid {
			email = user.Email.String
		} else {
			email = userID
		}
	}

	presence := workspacePresence{
		UserID:       userID,
		Email:        email,
		ActiveTaskID: input.ActiveTaskID,
		LastSeen:     time.Now().UTC(),
	}

	if RedisClient != nil {
		key := fmt.Sprintf("presence:workspace:%s", workspaceIDStr)
		bytes, _ := json.Marshal(presence)
		_ = RedisClient.HSet(c.Request().Context(), key, userID, string(bytes)).Err()
		_ = RedisClient.Expire(c.Request().Context(), key, 5*time.Minute).Err()
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true})
}

func handleGetWorkspacePresence(c echo.Context) error {
	workspaceIDStr := c.Param("id")
	var workspaceID pgtype.UUID
	if err := parseUUID(workspaceIDStr, &workspaceID); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid workspace ID"})
	}

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	presenceList := []workspacePresence{}

	if RedisClient != nil {
		key := fmt.Sprintf("presence:workspace:%s", workspaceIDStr)
		results, err := RedisClient.HGetAll(c.Request().Context(), key).Result()
		if err == nil {
			now := time.Now().UTC()
			for fieldUserID, jsonStr := range results {
				var p workspacePresence
				if err := json.Unmarshal([]byte(jsonStr), &p); err == nil {
					// Filter out stale users (older than 30 seconds)
					if now.Sub(p.LastSeen) < 30*time.Second {
						presenceList = append(presenceList, p)
					} else {
						// Clean up stale field
						_ = RedisClient.HDel(c.Request().Context(), key, fieldUserID).Err()
					}
				}
			}
		}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: presenceList})
}

func handleDeleteWorkspace(c echo.Context) error {
	workspaceIDStr := c.Param("id")
	var workspaceID pgtype.UUID
	if err := parseUUID(workspaceIDStr, &workspaceID); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid workspace ID"})
	}

	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	// Verify access / ownership
	hasAccess, err := queries.CheckWorkspaceAccess(c.Request().Context(), db.CheckWorkspaceAccessParams{
		ID:      workspaceID,
		OwnerID: userID,
	})
	if err != nil || !hasAccess {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
	}

	ctx := c.Request().Context()
	_, err = dbPool.Exec(ctx, "DELETE FROM workspaces WHERE id = $1 AND owner_id = $2", workspaceID, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete workspace"})
	}

	// Invalidate cache immediately
	InvalidateCachedWorkspaces(ctx, userID)

	_ = PublishEvent(ctx, PubSubEvent{
		UserID:    userID,
		EventType: "workspace_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Workspace deleted successfully"})
}
