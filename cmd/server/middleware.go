package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"aktionfy/db"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// EchoSessionMiddleware extracts session_id from cookie and hydrates context
func EchoSessionMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		cookie, err := c.Cookie("session_id")
		if err != nil {
			if strings.HasPrefix(c.Request().URL.Path, "/api/") {
				return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
			}
			return next(c)
		}

		// Parse session ID into pgtype.UUID
		var sessionID pgtype.UUID
		if err := parseUUID(cookie.Value, &sessionID); err != nil {
			if strings.HasPrefix(c.Request().URL.Path, "/api/") {
				return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Invalid session"})
			}
			return next(c)
		}

		cachedUser, cacheErr := GetCachedUserBySession(c.Request().Context(), cookie.Value)
		if cacheErr != nil || cachedUser == nil {
			if strings.HasPrefix(c.Request().URL.Path, "/api/") {
				return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
			}
			return next(c)
		}
		
		u := *cachedUser

		if u.IsLocked.Bool {
			// Clear cookie to force signout
			c.SetCookie(&http.Cookie{
				Name:     "session_id",
				Value:    "",
				Path:     "/",
				MaxAge:   -1,
				HttpOnly: true,
			})
			if strings.HasPrefix(c.Request().URL.Path, "/api/") {
				return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "This account has been locked. Please contact support."})
			}
			return next(c)
		}

		var maxTasks *int
		if u.MaxTasksLimit.Valid {
			v := int(u.MaxTasksLimit.Int32)
			maxTasks = &v
		}
		var rateLimit *int
		if u.RateLimitOverride.Valid {
			v := int(u.RateLimitOverride.Int32)
			rateLimit = &v
		}

		user := &User{
			ID:                u.ID,
			Email:             u.Email.String,
			APIKey:            u.ApiKey,
			Role:              u.Role.String,
			Tier:              u.Tier.String,
			MaxTasksLimit:     maxTasks,
			RateLimitOverride: rateLimit,
			CreatedAt:         u.CreatedAt.Time,
		}

		log.Printf("Session Validated: UserID=%s, Email=%s, Role=%s", user.ID, user.Email, user.Role)

		// Record session metadata in Redis to update last active timestamp asynchronously
		go RecordActiveSession(context.Background(), u.ID, cookie.Value, c.RealIP(), c.Request().UserAgent())

		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Set("user_role", user.Role)

		// Check for masquerading original session
		origCookie, err := c.Cookie("original_session_id")
		if err == nil && origCookie.Value != "" {
			var origSessID pgtype.UUID
			if parseUUID(origCookie.Value, &origSessID) == nil {
				adminUser, err := queries.GetUserBySessionID(c.Request().Context(), db.GetUserBySessionIDParams{
					ID:        origSessID,
					ExpiresAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
				})
				if err == nil {
					c.Set("masquerader_id", adminUser.ID)
					c.Set("masquerader_email", adminUser.Email.String)
					user.MasqueraderEmail = &adminUser.Email.String
				}
			}
		}

		// Also add to request context for downstream non-echo handlers if any
		ctx := context.WithValue(c.Request().Context(), userKey, user)
		ctx = context.WithValue(ctx, userIDKey, user.ID)
		ctx = context.WithValue(ctx, userRoleKey, user.Role)
		c.SetRequest(c.Request().WithContext(ctx))

		return next(c)
	}
}

// EchoRequireRole ensures the user has one of the required roles
func EchoRequireRole(roles ...string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userRole, ok := c.Get("user_role").(string)
			if !ok || userRole == "" {
				log.Printf("RBAC Denial: No user_role found in context for %s", c.Request().URL.Path)
				if strings.HasPrefix(c.Request().URL.Path, "/api/") {
					return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
				}
				return echo.NewHTTPError(http.StatusForbidden, "Forbidden")
			}

			for _, role := range roles {
				if userRole == role {
					return next(c)
				}
			}

			log.Printf("RBAC Denial: User role '%s' not in allowed list %v for %s", userRole, roles, c.Request().URL.Path)
			if strings.HasPrefix(c.Request().URL.Path, "/api/") {
				return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden - Insufficient permissions"})
			}
			return echo.NewHTTPError(http.StatusForbidden, "Forbidden")
		}
	}
}

// EchoAuthMiddleware ensures every request has a valid X-API-Key linked to a user
func EchoAuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		apiKey := c.Request().Header.Get("X-API-Key")
		if apiKey == "" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized: Missing X-API-Key")
		}
		u, err := queries.GetUserByAPIKey(c.Request().Context(), apiKey)
		if err != nil {
			return echo.NewHTTPError(http.StatusUnauthorized, "Unauthorized: Invalid API Key")
		}

		if u.IsLocked.Bool {
			return echo.NewHTTPError(http.StatusForbidden, "Forbidden: This account has been locked.")
		}

		// Phase 4: Rate Limiting
		if !globalRateLimiter.Allow(c.Request().Context(), u.ID) {
			return echo.NewHTTPError(http.StatusTooManyRequests, "Too Many Requests")
		}

		// Add UserID and Tier to context for use in tools
		c.Set("user_id", u.ID)
		c.Set("user_tier", u.Tier.String)

		ctx := context.WithValue(c.Request().Context(), userIDKey, u.ID)
		ctx = context.WithValue(ctx, userTierKey, u.Tier.String)
		c.SetRequest(c.Request().WithContext(ctx))

		return next(c)
	}
}

// EchoRateLimitMiddleware applies the global rate limiter based on the user ID in context
func EchoRateLimitMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := getUserID(c)
		if userID != "" {
			if !globalRateLimiter.Allow(c.Request().Context(), userID) {
				return c.JSON(http.StatusTooManyRequests, APIResponse{Success: false, Error: "Too Many Requests"})
			}
		}
		return next(c)
	}
}

// IPRateLimitMiddleware applies the global rate limiter based on the request IP
func IPRateLimitMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ip := c.RealIP()
		if !globalRateLimiter.Allow(c.Request().Context(), "ip:"+ip) {
			return c.JSON(http.StatusTooManyRequests, APIResponse{Success: false, Error: "Too Many Requests"})
		}
		return next(c)
	}
}

func getUserFromEcho(c echo.Context) *User {
	user, _ := c.Get("user").(*User)
	return user
}

func getUserID(c echo.Context) string {
	if user := getUserFromEcho(c); user != nil {
		return user.ID
	}
	id, _ := c.Get("user_id").(string)
	return id
}

func getUserTier(c echo.Context) string {
	if user := getUserFromEcho(c); user != nil {
		return user.Tier
	}
	tier, _ := c.Get("user_tier").(string)
	if tier == "" {
		return TierFree
	}
	return tier
}

// NetHttpAuthMiddleware is a wrapper to use authentication logic for standard library handlers (SSE/Message).
// It supports both X-API-Key header and session_id cookie.
func NetHttpAuthMiddleware(next http.Handler, mcpServer *server.MCPServer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := ""
		userTier := ""
		isBridge := false
		// 1. Try API Key Header
		apiKey := r.Header.Get("X-API-Key")
		if apiKey != "" {
			var u db.GetUserByAPIKeyRow
			var err error
			cachedUser, cacheErr := GetCachedUserByAPIKey(r.Context(), apiKey)
			if cacheErr == nil && cachedUser != nil {
				u = *cachedUser
			} else {
				u, err = queries.GetUserByAPIKey(r.Context(), apiKey)
				if err == nil {
					SetCachedUserByAPIKey(r.Context(), apiKey, u)
				}
			}
			if err == nil || cachedUser != nil {
				if u.IsLocked.Bool {
					http.Error(w, "Forbidden: This account has been locked", http.StatusForbidden)
					return
				}
				userID = u.ID
				userTier = u.Tier.String
				isBridge = true
			}
		}

		// 2. Try Session Cookie if API key failed
		if userID == "" {
			cookie, err := r.Cookie("session_id")
			if err == nil && cookie.Value != "" {
				cachedUser, cacheErr := GetCachedUserBySession(r.Context(), cookie.Value)
				if cacheErr == nil && cachedUser != nil {
					u := *cachedUser
					if u.IsLocked.Bool {
						http.Error(w, "Forbidden: This account has been locked", http.StatusForbidden)
						return
					}
					userID = u.ID
					userTier = u.Tier.String
				}
			}
		}

		if userID == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if !globalRateLimiter.Allow(r.Context(), userID) {
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		ctx = context.WithValue(ctx, userTierKey, userTier)
		ctx = context.WithValue(ctx, isBridgeKey, isBridge)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// SamplingInterceptorMiddleware peeks at incoming POST messages to see if they are responses to our sampling requests.
func SamplingInterceptorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			next.ServeHTTP(w, r)
			return
		}

		// Peek at the body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		// Restore body for the next handler
		r.Body = io.NopCloser(bytes.NewBuffer(body))

		var msg struct {
			ID     json.RawMessage          `json:"id"`
			Result *mcp.CreateMessageResult `json:"result"`
			Error  *struct {
				Code    int    `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}

		if err := json.Unmarshal(body, &msg); err == nil && len(msg.ID) > 0 && (msg.Result != nil || msg.Error != nil) {
			// Extract ID as string (strip quotes if string, keep literal if number)
			idStr := strings.Trim(string(msg.ID), "\"")

			log.Printf("[SAMPLING] Intercepted response for ID %s", idStr)

			errStr := ""
			if msg.Error != nil {
				errStr = msg.Error.Message
				if errStr == "" {
					errStr = fmt.Sprintf("MCP error %d", msg.Error.Code)
				}
				log.Printf("[SAMPLING] Intercepted error for ID %s: %s", idStr, errStr)
			}

			// Check if this ID is one of our pending sampling requests
			if GlobalSessionManager.HandleSamplingResponse(idStr, msg.Result, errStr) {
				log.Printf("[SAMPLING] Successfully routed response for ID %s", idStr)
				// We handled it! Return 202 Accepted (matches SSEServer behavior)
				w.WriteHeader(http.StatusAccepted)
				return
			} else {
				log.Printf("[SAMPLING] No pending request found for ID %s", idStr)
			}
		}

		next.ServeHTTP(w, r)
	})
}

// EchoMaintenanceModeMiddleware checks if global maintenance mode is active in Redis.
func EchoMaintenanceModeMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if RedisClient == nil {
			return next(c)
		}

		// Check if maintenance mode is active in Redis
		isMaintenance, err := RedisClient.Exists(c.Request().Context(), "sys:maintenance").Result()
		if err == nil && isMaintenance > 0 {
			// Get user from context
			user, _ := c.Get("user").(*User)
			if user != nil && user.Role == "admin" {
				return next(c)
			}
			return c.JSON(http.StatusServiceUnavailable, APIResponse{
				Success: false,
				Error:   "Aktionfy is currently undergoing scheduled maintenance. Please try again later.",
			})
		}

		return next(c)
	}
}

