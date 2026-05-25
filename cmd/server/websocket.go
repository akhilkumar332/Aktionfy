package main

import (
	"context"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
)

// WSClient wraps a websocket connection with a mutex to prevent concurrent writes
type WSClient struct {
	mu       sync.Mutex
	conn     *websocket.Conn
	userID   string
	userRole string
}

// ActiveWebSockets maintains a registry of connected clients to enable hub broadcasting functionality
var ActiveWebSockets sync.Map

var upgrader = websocket.Upgrader{
	// Trust all origins per original task specification (dev/local environment reliability)
	CheckOrigin: func(r *http.Request) bool { return true },
}

// BroadcastWebSocketMessage sends a JSON message to all connected websocket clients safely
func BroadcastWebSocketMessage(msg interface{}) {
	ActiveWebSockets.Range(func(key, value interface{}) bool {
		client := key.(*WSClient)
		client.mu.Lock()
		err := client.conn.WriteJSON(msg)
		client.mu.Unlock()
		if err != nil {
			_ = client.conn.Close()
		}
		return true
	})
}

// BroadcastToAdmins sends a JSON message ONLY to admin/staff websocket clients
func BroadcastToAdmins(msg interface{}) {
	ActiveWebSockets.Range(func(key, value interface{}) bool {
		client := key.(*WSClient)
		if client.userRole != "admin" && client.userRole != "staff" {
			return true
		}
		client.mu.Lock()
		_ = client.conn.WriteJSON(msg)
		client.mu.Unlock()
		return true
	})
}

// HandleWebSocket manages the websocket connection
func HandleWebSocket(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}

	userID, _ := c.Get("user_id").(string)
	userRole, _ := c.Get("user_role").(string)
	
	client := &WSClient{
		conn:     ws,
		userID:   userID,
		userRole: userRole,
	}
	ActiveWebSockets.Store(client, true)
	defer ActiveWebSockets.Delete(client)
	defer client.conn.Close()

	// Track presence
	if userID != "" && RedisClient != nil {
		RedisClient.SAdd(c.Request().Context(), "presence:online", userID)
		defer RedisClient.SRem(context.Background(), "presence:online", userID)
	}

	for {
		_, _, err := client.conn.ReadMessage()
		if err != nil {
			break
		}
	}
	return nil
}
