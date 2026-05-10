package main

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"schedule-mcp/db"
)

func apiListTasksHandler(c echo.Context) error {
	userID := c.Get("user_id").(string)
	
	tasks, err := queries.ListUserTasks(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to list tasks"})
	}
	
	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: tasks})
}

func apiPauseTaskHandler(c echo.Context) error {
	userID := c.Get("user_id").(string)
	taskIDStr := c.Param("id")
	
	var taskID pgtype.UUID
	err := parseUUID(taskIDStr, &taskID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
	}

	err = queries.UpdateTaskStatusByUserID(c.Request().Context(), db.UpdateTaskStatusByUserIDParams{
		Status: pgtype.Text{String: "paused", Valid: true},
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to pause task"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task paused"})
}

func apiResumeTaskHandler(c echo.Context) error {
	userID := c.Get("user_id").(string)
	taskIDStr := c.Param("id")
	var taskID pgtype.UUID
	err := parseUUID(taskIDStr, &taskID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
	}

	err = queries.UpdateTaskStatusByUserID(c.Request().Context(), db.UpdateTaskStatusByUserIDParams{
		Status: pgtype.Text{String: "active", Valid: true},
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to resume task"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task resumed"})
}

func apiDeleteTaskHandler(c echo.Context) error {
	userID := c.Get("user_id").(string)
	taskIDStr := c.Param("id")
	var taskID pgtype.UUID
	err := parseUUID(taskIDStr, &taskID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
	}

	err = queries.DeleteTask(c.Request().Context(), db.DeleteTaskParams{
		ID:     taskID,
		UserID: userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete task"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task deleted"})
}

type UpdateTaskRequest struct {
	AgentPrompt      string `json:"agent_prompt"`
	MissedTaskPolicy string `json:"missed_task_policy"`
}

func apiUpdateTaskHandler(c echo.Context) error {
	userID := c.Get("user_id").(string)
	taskIDStr := c.Param("id")
	var taskID pgtype.UUID
	err := parseUUID(taskIDStr, &taskID)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
	}

	var req UpdateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	err = queries.UpdateTaskAgentPromptAndPolicy(c.Request().Context(), db.UpdateTaskAgentPromptAndPolicyParams{
		AgentPrompt:      req.AgentPrompt,
		MissedTaskPolicy: pgtype.Text{String: req.MissedTaskPolicy, Valid: true},
		ID:               taskID,
		UserID:           userID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update task"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task updated"})
}
