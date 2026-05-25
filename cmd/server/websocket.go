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
	mu   sync.Mutex
	conn *websocket.Conn
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
			// Write error implies broken pipe; close it so the read loop cleans up
			_ = client.conn.Close()
		}
		return true
	})
}

// HandleWebSocket manages the websocket connection
func HandleWebSocket(c echo.Context) error {
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	
	client := &WSClient{conn: ws}
	ActiveWebSockets.Store(client, true)
	defer ActiveWebSockets.Delete(client)
	defer client.conn.Close()

	// Track presence
	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		// Proceed without presence tracking if auth is not strictly present
	} else if RedisClient != nil {
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
