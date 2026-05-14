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
