package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mark3labs/mcp-go/server"
	"schedule-mcp/db"
)

// sessionMiddleware extracts session_id from cookie and hydrates context
func sessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_id")
		if err != nil {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				sendJSON(w, http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		// Parse session ID into pgtype.UUID
		var sessionID pgtype.UUID
		if err := parseUUID(cookie.Value, &sessionID); err != nil {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				sendJSON(w, http.StatusUnauthorized, APIResponse{Success: false, Error: "Invalid session"})
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		u, err := queries.GetUserBySessionID(r.Context(), db.GetUserBySessionIDParams{
			ID:        sessionID,
			ExpiresAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		})

		if err != nil {
			if strings.HasPrefix(r.URL.Path, "/api/") {
				sendJSON(w, http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
				return
			}
			next.ServeHTTP(w, r)
			return
		}

		user := &User{
			ID:        u.ID,
			Email:     u.Email.String,
			APIKey:    u.ApiKey,
			Role:      u.Role.String,
			Tier:      u.Tier.String,
			CreatedAt: u.CreatedAt.Time,
		}

		ctx := context.WithValue(r.Context(), "user", user)
		ctx = context.WithValue(ctx, "user_id", user.ID)
		ctx = context.WithValue(ctx, "user_role", user.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole ensures the user has one of the required roles
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := r.Context().Value("user_role").(string)
			if !ok {
				if strings.HasPrefix(r.URL.Path, "/api/") {
					sendJSON(w, http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
					return
				}
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			for _, role := range roles {
				if userRole == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			if strings.HasPrefix(r.URL.Path, "/api/") {
				sendJSON(w, http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden"})
				return
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

		u, err := queries.GetUserByAPIKey(r.Context(), apiKey)
		if err != nil {
			http.Error(w, "Unauthorized: Invalid API Key", http.StatusUnauthorized)
			return
		}

		// Phase 4: Rate Limiting
		if !globalRateLimiter.Allow(r.Context(), u.ID) {
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Add UserID and Tier to context for use in tools
		ctx := context.WithValue(r.Context(), "user_id", u.ID)
		ctx = context.WithValue(ctx, "user_tier", u.Tier.String)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
