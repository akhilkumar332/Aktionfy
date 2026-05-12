package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func handleGetWorkspaces(c echo.Context) error {
	userID := c.Get("user_id").(string)
	
	if queries == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch workspaces"})
	}

	workspaces, err := queries.GetUserWorkspaces(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch workspaces"})
	}
	return c.JSON(http.StatusOK, workspaces)
}
