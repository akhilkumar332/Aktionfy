package main

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/csrf"
	"github.com/jackc/pgx/v5/pgtype"
	"schedule-mcp/db"
)

type AuthInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

type APIResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	CSRFToken string      `json:"csrfToken,omitempty"`
}

func apiCSRFHandler(w http.ResponseWriter, r *http.Request) {
	sendJSON(w, http.StatusOK, APIResponse{
		Success:   true,
		CSRFToken: csrf.Token(r),
	})
}

func apiSignupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method Not Allowed"})
		return
	}

	var input AuthInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		sendJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	user, err := RegisterUser(r.Context(), input.Email, input.Password)
	if err != nil {
		sendJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: err.Error()})
		return
	}

	sendJSON(w, http.StatusCreated, APIResponse{
		Success:   true,
		Data:      user,
		CSRFToken: csrf.Token(r),
	})
}

func apiLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method Not Allowed"})
		return
	}

	var input AuthInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		sendJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	sessionID, err := LoginUser(r.Context(), input.Email, input.Password)
	if err != nil {
		sendJSON(w, http.StatusUnauthorized, APIResponse{Success: false, Error: "Invalid email or password"})
		return
	}

	// Determine if we should use Secure cookies.
	useSecure := os.Getenv("ENV") == "production"
	if os.Getenv("LOCAL_DEV") == "true" {
		useSecure = false
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   useSecure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().UTC().Add(24 * time.Hour),
	})

	// Parse session ID into pgtype.UUID
	var sessID pgtype.UUID
	if err := parseUUID(sessionID, &sessID); err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Internal Error"})
		return
	}

	// Fetch user info to return
	u, err := queries.GetUserBySessionID(r.Context(), db.GetUserBySessionIDParams{
		ID:        sessID,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	})

	if err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch user info"})
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

	sendJSON(w, http.StatusOK, APIResponse{
		Success:   true,
		Data:      user,
		CSRFToken: csrf.Token(r),
	})
}

func apiLogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err == nil && cookie.Value != "" {
		var sessID pgtype.UUID
		if err := parseUUID(cookie.Value, &sessID); err == nil {
			_ = queries.DeleteWebSession(r.Context(), sessID)
		}
	}

	// Determine if we should use Secure cookies.
	useSecure := os.Getenv("ENV") == "production"
	if os.Getenv("LOCAL_DEV") == "true" {
		useSecure = false
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   useSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Message: "Logged out successfully"})
}

func apiDashboardHandler(w http.ResponseWriter, r *http.Request) {
	user := getUser(r)

	taskCount, err := queries.CountUserTasks(r.Context(), user.ID)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch task count"})
		return
	}

	sendJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"user":      user,
			"taskCount": taskCount,
		},
	})
}

func apiRotateAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method Not Allowed"})
		return
	}
	user := getUser(r)

	newKey, err := RotateAPIKey(r.Context(), user.ID)
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to rotate API key"})
		return
	}

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Data: map[string]string{"api_key": newKey}})
}

func apiMonitorHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := queries.GetTaskLogs(r.Context())
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch logs"})
		return
	}

	var logs []TaskLog
	for _, l := range rows {
		var llmResp, errMsg *string
		if l.LlmResponse.Valid {
			llmResp = &l.LlmResponse.String
		}
		if l.ErrorMessage.Valid {
			errMsg = &l.ErrorMessage.String
		}
		logs = append(logs, TaskLog{
			ID:            formatUUID(l.ID),
			TaskID:        formatUUID(l.TaskID),
			UserID:        l.UserID,
			ExecutionTime: l.ExecutionTime.Time,
			Status:        l.Status,
			LLMResponse:   llmResp,
			ErrorMessage:  errMsg,
			TaskName:      l.TaskName,
			UserEmail:     l.UserEmail.String,
		})
	}

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Data: logs})
}

func apiAdminUsersHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := queries.ListUsers(r.Context())
	if err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch users"})
		return
	}

	var users []User
	for _, u := range rows {
		users = append(users, User{
			ID:        u.ID,
			Email:     u.Email.String,
			APIKey:    u.ApiKey,
			Role:      u.Role.String,
			Tier:      u.Tier.String,
			CreatedAt: u.CreatedAt.Time,
		})
	}

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Data: users})
}

type AdminUpdateUserInput struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	Tier   string `json:"tier"`
}

func apiAdminUpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		sendJSON(w, http.StatusMethodNotAllowed, APIResponse{Success: false, Error: "Method Not Allowed"})
		return
	}

	var input AdminUpdateUserInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		sendJSON(w, http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
		return
	}

	if input.Role != "" {
		err := queries.UpdateUserRole(r.Context(), db.UpdateUserRoleParams{
			Role: pgtype.Text{String: input.Role, Valid: true},
			ID:   input.UserID,
		})
		if err != nil {
			sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user role"})
			return
		}
	}

	if input.Tier != "" {
		err := queries.UpdateUserTier(r.Context(), db.UpdateUserTierParams{
			Tier: pgtype.Text{String: input.Tier, Valid: true},
			ID:   input.UserID,
		})
		if err != nil {
			sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user tier"})
			return
		}
	}

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Message: "User updated successfully"})
}
