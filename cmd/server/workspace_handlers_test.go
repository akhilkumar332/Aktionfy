package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestHandleGetWorkspaces(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/workspaces", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "test-user-id")

	err := handleGetWorkspaces(c)

	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status OK, got %d", rec.Code)
	}
}
