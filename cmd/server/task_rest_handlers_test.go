package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestApiCreateTaskHandler(t *testing.T) {
	if queries == nil {
		t.Skip("Skipping test: queries is nil")
	}
	e := echo.New()

	taskData := `{
		"name": "Test Task",
		"trigger_type": "cron",
		"trigger_config": {"cron": "0 0 * * *"},
		"agent_prompt": "Hello",
		"task_type": "native",
		"native_code": "print('hello')",
		"requires_approval": true,
		"missed_task_policy": "skip"
	}`

	req := httptest.NewRequest(http.MethodPost, "/api/tasks", strings.NewReader(taskData))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	// Set user ID in context
	c.Set(string(userIDKey), "user-123")

	// This should fail to compile initially because apiCreateTaskHandler is not defined
	err := apiCreateTaskHandler(c)

	if err != nil {
		t.Fatalf("apiCreateTaskHandler returned error: %v", err)
	}

	if rec.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d", rec.Code)
	}

	var resp APIResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success true, got false. Error: %s", resp.Error)
	}
}

func TestApiUpdateTaskHandler(t *testing.T) {
	if queries == nil || dbPool == nil {
		t.Skip("Skipping test: queries or dbPool is nil")
	}
	e := echo.New()

	taskData := `{
		"agent_prompt": "Updated Prompt",
		"missed_task_policy": "retry",
		"ui_coordinates": {"x": 100, "y": 200}
	}`

	req := httptest.NewRequest(http.MethodPatch, "/api/tasks/550e8400-e29b-41d4-a716-446655440000", strings.NewReader(taskData))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("550e8400-e29b-41d4-a716-446655440000")

	// Set user ID in context
	c.Set(string(userIDKey), "user-123")

	err := apiUpdateTaskHandler(c)

	if err != nil {
		t.Fatalf("apiUpdateTaskHandler returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp APIResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success true, got false. Error: %s", resp.Error)
	}
}

func TestApiRestoreTaskVersionHandler(t *testing.T) {
	if queries == nil || dbPool == nil {
		t.Skip("Skipping test: queries or dbPool is nil")
	}
	e := echo.New()

	req := httptest.NewRequest(http.MethodPost, "/api/tasks/550e8400-e29b-41d4-a716-446655440000/restore/550e8400-e29b-41d4-a716-446655440001", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "version_id")
	c.SetParamValues("550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001")

	// Set user ID in context
	c.Set(string(userIDKey), "user-123")

	err := apiRestoreTaskVersionHandler(c)

	if err != nil {
		t.Fatalf("apiRestoreTaskVersionHandler returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp APIResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success true, got false. Error: %s", resp.Error)
	}
}
