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

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type EditingNodePayload struct {
	UserID    string `json:"user_id"`
	UserEmail string `json:"user_email"`
	TaskID    string `json:"task_id"`
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

// BroadcastExcludeSender sends a JSON message to all connected clients EXCEPT the sender
func BroadcastExcludeSender(msg interface{}, sender *WSClient) {
	ActiveWebSockets.Range(func(key, value interface{}) bool {
		client := key.(*WSClient)
		if client == sender {
			return true
		}
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
	userObj, _ := c.Get("user").(*User)
	userEmail := ""
	if userObj != nil {
		userEmail = userObj.Email
	}
	
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
		var msg WSMessage
		err := client.conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		// Handle editing_node events
		if msg.Type == "editing_node" {
			payload, ok := msg.Payload.(map[string]interface{})
			if ok {
				// Inject user details from the session into the broadcasted message
				payload["user_id"] = userID
				payload["user_email"] = userEmail
				msg.Payload = payload
				BroadcastExcludeSender(msg, client)
			}
		}
	}
	return nil
}
