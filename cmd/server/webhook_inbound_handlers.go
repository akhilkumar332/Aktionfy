package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func handleInboundWebhook(c echo.Context) error {
	token := c.Param("token")

	// Get task by token
	task, err := queries.GetTaskByWebhookToken(c.Request().Context(), token)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Invalid webhook token"})
	}

	taskID := formatUUID(task.ID)

	// Trigger the task immediately
	err = RedisClient.Publish(c.Request().Context(), "task_claimed", taskID).Err()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to trigger task"})
	}

	return c.JSON(http.StatusOK, map[string]string{"status": "task triggered", "task_id": taskID})
}
