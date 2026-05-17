package main

import (
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
)

func apiEventsHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	c.Response().Header().Set(echo.HeaderContentType, "text/event-stream")
	c.Response().Header().Set(echo.HeaderCacheControl, "no-cache")
	c.Response().Header().Set(echo.HeaderConnection, "keep-alive")

	ctx := c.Request().Context()
	pubsub := RedisClient.Subscribe(ctx, fmt.Sprintf("user:events:%s", userID))
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return nil
		case msg := <-ch:
			// No filtering needed here anymore as we subscribe to user-specific channel
			fmt.Fprintf(c.Response(), "data: %s\n\n", msg.Payload)
			c.Response().Flush()
		}
	}
}
