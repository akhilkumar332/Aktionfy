package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestUserRateLimitMiddleware_FailOpen(t *testing.T) {
	RedisClient = nil

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("user_id", "test_user")

	handler := UserRateLimitMiddleware(func(c echo.Context) error {
		return c.String(http.StatusOK, "test")
	})

	if err := handler(c); err != nil {
		t.Errorf("Expected nil error, got %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", rec.Code)
	}
}
