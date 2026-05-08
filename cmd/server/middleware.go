package main

import (
	"context"
	"net/http"
	"time"

	"github.com/mark3labs/mcp-go/server"
)

// sessionMiddleware extracts session_id from cookie and hydrates context
func sessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var userID, userRole string
		err = dbPool.QueryRow(r.Context(),
			"SELECT user_id, u.role FROM web_sessions s JOIN users u ON s.user_id = u.id WHERE s.id = $1 AND s.expires_at > $2",
			cookie.Value, time.Now(),
		).Scan(&userID, &userRole)

		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "user_id", userID)
		ctx = context.WithValue(ctx, "user_role", userRole)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole ensures the user has one of the required roles
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value("user_role").(string)
			if !ok {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			for _, role := range roles {
				if userRole == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, "Forbidden", http.StatusForbidden)
		})
	}
}

// authMiddleware ensures every request has a valid X-API-Key linked to a user
func authMiddleware(next http.Handler, mcpServer *server.MCPServer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiKey := r.Header.Get("X-API-Key")
		if apiKey == "" {
			http.Error(w, "Unauthorized: Missing X-API-Key", http.StatusUnauthorized)
			return
		}

		var userID, userTier string
		err := dbPool.QueryRow(r.Context(), "SELECT id, tier FROM users WHERE api_key = $1", apiKey).Scan(&userID, &userTier)
		if err != nil {
			http.Error(w, "Unauthorized: Invalid API Key", http.StatusUnauthorized)
			return
		}

		// Phase 4: Rate Limiting
		if !globalRateLimiter.Allow(r.Context(), userID) {
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Phase 6.2: Distributed Session Tracking via Redis
		// MaintainHeartbeat will block until r.Context() is cancelled (client disconnects)
		go GlobalSessionManager.MaintainHeartbeat(r.Context(), userID, mcpServer)

		// Add UserID and Tier to context for use in tools
		ctx := context.WithValue(r.Context(), "user_id", userID)
		ctx = context.WithValue(ctx, "user_tier", userTier)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
