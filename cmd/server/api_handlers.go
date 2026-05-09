package main

import (
	"encoding/json"
	"net/http"
	"os"
	"time"
)

func sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type AuthInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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

	sendJSON(w, http.StatusCreated, APIResponse{Success: true, Data: user})
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

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   os.Getenv("ENV") == "production",
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().UTC().Add(24 * time.Hour),
	})

	// Fetch user info to return
	var user User
	err = dbPool.QueryRow(r.Context(),
		"SELECT id, email, api_key, role, tier, created_at FROM users WHERE id = (SELECT user_id FROM web_sessions WHERE id = $1)",
		sessionID,
	).Scan(&user.ID, &user.Email, &user.APIKey, &user.Role, &user.Tier, &user.CreatedAt)

	if err != nil {
		sendJSON(w, http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch user info"})
		return
	}

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Data: user})
}

func apiLogoutHandler(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_id")
	if err == nil && cookie.Value != "" {
		_, err = dbPool.Exec(r.Context(), "DELETE FROM web_sessions WHERE id = $1", cookie.Value)
		if err != nil {
			// log.Printf("Error deleting session: %v", err)
		}
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   os.Getenv("ENV") == "production",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	sendJSON(w, http.StatusOK, APIResponse{Success: true, Message: "Logged out successfully"})
}
