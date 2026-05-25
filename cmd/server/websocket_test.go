package main

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

func TestHandleWebSocket(t *testing.T) {
	e := echo.New()
	
	e.GET("/api/v1/ws", func(c echo.Context) error {
		c.Set("user_id", "test-user-id")
		return HandleWebSocket(c)
	})

	server := httptest.NewServer(e)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/ws"

	ws, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to websocket: %v", err)
	}
	defer ws.Close()
}
