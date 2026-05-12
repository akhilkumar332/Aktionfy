package main

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func handleGetWorkspaces(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}

	workspaces, err := queries.GetUserWorkspaces(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch workspaces"})
	}
	return c.JSON(http.StatusOK, workspaces)
}
