package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/csrf"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
	"schedule-mcp/db"
)

type AuthInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type APIResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	CSRFToken string      `json:"csrfToken,omitempty"`
}

func apiCSRFHandler(c echo.Context) error {
	return c.JSON(http.StatusOK, APIResponse{
		Success:   true,
		CSRFToken: csrf.Token(c.Request()),
	})
}

func apiSignupHandler(c echo.Context) error {
	var input AuthInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}
	input.Email = strings.TrimSpace(input.Email)
	if input.Email == "" || input.Password == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Email and password are required"})
	}

	user, err := RegisterUser(c.Request().Context(), input.Email, input.Password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: err.Error()})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "auth.signup",
		ResourceType: "user",
		ResourceID:   user.ID,
		Metadata: map[string]interface{}{
			"email": user.Email,
		},
	})

	return c.JSON(http.StatusCreated, APIResponse{
		Success:   true,
		Data:      user,
		CSRFToken: csrf.Token(c.Request()),
	})
}

func apiLoginHandler(c echo.Context) error {
	var input AuthInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}
	input.Email = strings.TrimSpace(input.Email)
	if input.Email == "" || input.Password == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Email and password are required"})
	}

	sessionID, err := LoginUser(c.Request().Context(), input.Email, input.Password)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Invalid email or password"})
	}

	// Determine if we should use Secure cookies.
	useSecure := appConfig.secureCookies()

	c.SetCookie(&http.Cookie{
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
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Internal Error"})
	}

	// Fetch user info to return
	u, err := queries.GetUserBySessionID(c.Request().Context(), db.GetUserBySessionIDParams{
		ID:        sessID,
		ExpiresAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	})

	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch user info"})
	}

	user := &User{
		ID:        u.ID,
		Email:     u.Email.String,
		APIKey:    u.ApiKey,
		Role:      u.Role.String,
		Tier:      u.Tier.String,
		CreatedAt: u.CreatedAt.Time,
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "auth.login",
		ResourceType: "session",
		ResourceID:   sessionID,
	})

	return c.JSON(http.StatusOK, APIResponse{
		Success:   true,
		Data:      user,
		CSRFToken: csrf.Token(c.Request()),
	})
}

func apiLogoutHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	cookie, err := c.Cookie("session_id")
	if err == nil && cookie.Value != "" {
		var sessID pgtype.UUID
		if err := parseUUID(cookie.Value, &sessID); err == nil {
			_ = queries.DeleteWebSession(c.Request().Context(), sessID)
		}
	}

	// Determine if we should use Secure cookies.
	useSecure := appConfig.secureCookies()

	c.SetCookie(&http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   useSecure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	if user != nil && err == nil && cookie.Value != "" {
		writeAuditLog(c.Request().Context(), AuditEvent{
			UserID:       user.ID,
			Action:       "auth.logout",
			ResourceType: "session",
			ResourceID:   cookie.Value,
		})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Logged out successfully"})
}

func apiDashboardHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	taskCount, err := queries.CountUserTasks(c.Request().Context(), user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch task count"})
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"user":      user,
			"taskCount": taskCount,
		},
	})
}

func apiRotateAPIKeyHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	newKey, err := RotateAPIKey(c.Request().Context(), user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to rotate API key"})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "user.rotate_api_key",
		ResourceType: "user",
		ResourceID:   user.ID,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: map[string]string{"api_key": newKey}})
}

func apiExportTasksHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	tasks, err := exportUserTasks(c.Request().Context(), user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to export tasks"})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "task.export",
		ResourceType: "task_bundle",
		Metadata: map[string]interface{}{
			"count": len(tasks),
		},
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: map[string]interface{}{
		"tasks":           tasks,
		"exported_at":     time.Now().UTC().Format(time.RFC3339),
		"includesSecrets": false,
	}})
}

func apiImportTasksHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	var input ImportTasksRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}
	if len(input.Tasks) == 0 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "At least one task is required"})
	}

	mapping, err := importUserTasks(c.Request().Context(), user.ID, input.Tasks)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: err.Error()})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "task.import",
		ResourceType: "task_bundle",
		Metadata: map[string]interface{}{
			"count": len(input.Tasks),
		},
	})

	return c.JSON(http.StatusCreated, APIResponse{Success: true, Data: map[string]interface{}{
		"imported_count": len(input.Tasks),
		"legacy_to_new":  mapping,
	}})
}

func apiMonitorHandler(c echo.Context) error {
	rows, err := queries.GetTaskLogs(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch logs"})
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

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: logs})
}

func apiAdminUsersHandler(c echo.Context) error {
	rows, err := queries.ListUsers(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch users"})
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

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: users})
}

type AdminUpdateUserInput struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	Tier   string `json:"tier"`
}

func apiAdminUpdateUserHandler(c echo.Context) error {
	var input AdminUpdateUserInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.Role != "" {
		err := queries.UpdateUserRole(c.Request().Context(), db.UpdateUserRoleParams{
			Role: pgtype.Text{String: input.Role, Valid: true},
			ID:   input.UserID,
		})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user role"})
		}
	}

	if input.Tier != "" {
		err := queries.UpdateUserTier(c.Request().Context(), db.UpdateUserTierParams{
			Tier: pgtype.Text{String: input.Tier, Valid: true},
			ID:   input.UserID,
		})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user tier"})
		}
	}
	adminUser := getUserFromEcho(c)
	adminID := ""
	if adminUser != nil {
		adminID = adminUser.ID
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       adminID,
		Action:       "admin.update_user",
		ResourceType: "user",
		ResourceID:   input.UserID,
		Metadata: map[string]interface{}{
			"role": input.Role,
			"tier": input.Tier,
		},
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "User updated successfully"})
}

func apiApproveTaskHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	idStr := c.Param("id")
	var id pgtype.UUID
	if err := parseUUID(idStr, &id); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
	}
	exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
		ID:     id,
		UserID: user.ID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to verify task ownership"})
	}
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	err = queries.UpdateTaskApprovalStatus(c.Request().Context(), db.UpdateTaskApprovalStatusParams{
		LastApprovalStatus: pgtype.Text{String: "approved", Valid: true},
		Status:             pgtype.Text{String: StatusActive, Valid: true},
		ID:                 id,
		UserID:             user.ID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to approve task"})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "task.approve",
		ResourceType: "task",
		ResourceID:   idStr,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task approved"})
}

func apiDenyTaskHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	idStr := c.Param("id")
	var id pgtype.UUID
	if err := parseUUID(idStr, &id); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid task ID"})
	}
	exists, err := queries.CheckTaskOwnership(c.Request().Context(), db.CheckTaskOwnershipParams{
		ID:     id,
		UserID: user.ID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to verify task ownership"})
	}
	if !exists {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Task not found"})
	}

	err = queries.UpdateTaskApprovalStatus(c.Request().Context(), db.UpdateTaskApprovalStatusParams{
		LastApprovalStatus: pgtype.Text{String: "denied", Valid: true},
		Status:             pgtype.Text{String: StatusPaused, Valid: true},
		ID:                 id,
		UserID:             user.ID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to deny task"})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "task.deny",
		ResourceType: "task",
		ResourceID:   idStr,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Task denied"})
}

func apiListSecretsHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	rows, err := queries.ListUserSecrets(c.Request().Context(), user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch secrets"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: rows})
}

func apiDeleteSecretHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	name := c.Param("name")

	err := queries.DeleteUserSecret(c.Request().Context(), db.DeleteUserSecretParams{
		UserID: user.ID,
		Name:   name,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete secret"})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "secret.delete",
		ResourceType: "secret",
		ResourceID:   name,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Secret deleted"})
}

type UpsertSecretInput struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

func apiListWebhooksHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	rows, err := dbPool.Query(c.Request().Context(), `
SELECT id::text, endpoint_url, event_types::text, is_active, created_at
FROM outbound_webhooks
WHERE user_id = $1
ORDER BY created_at DESC
`, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch webhooks"})
	}
	defer rows.Close()

	var hooks []WebhookSubscription
	for rows.Next() {
		var hook WebhookSubscription
		var eventTypesJSON string
		if err := rows.Scan(&hook.ID, &hook.EndpointURL, &eventTypesJSON, &hook.IsActive, &hook.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to scan webhooks"})
		}
		_ = json.Unmarshal([]byte(eventTypesJSON), &hook.EventTypes)
		hooks = append(hooks, hook)
	}
	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read webhooks"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: hooks})
}

func apiCreateWebhookHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	var input WebhookCreateInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}
	if input.EndpointURL == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "endpoint_url is required"})
	}
	if len(input.EventTypes) == 0 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "event_types are required"})
	}
	secret := input.SigningSecret
	if secret == "" {
		generated, err := generateSigningSecret()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to generate signing secret"})
		}
		secret = generated
	}
	encryptedSecret, err := Encrypt([]byte(secret))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to encrypt signing secret"})
	}
	eventTypesJSON, _ := json.Marshal(input.EventTypes)

	var id string
	var createdAt time.Time
	if err := dbPool.QueryRow(c.Request().Context(), `
INSERT INTO outbound_webhooks (user_id, endpoint_url, event_types, encrypted_signing_secret)
VALUES ($1, $2, $3::jsonb, $4)
RETURNING id::text, created_at
`, user.ID, input.EndpointURL, string(eventTypesJSON), encryptedSecret).Scan(&id, &createdAt); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create webhook"})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "webhook.create",
		ResourceType: "webhook",
		ResourceID:   id,
		Metadata: map[string]interface{}{
			"endpoint_url": input.EndpointURL,
			"event_types":  input.EventTypes,
		},
	})

	return c.JSON(http.StatusCreated, APIResponse{Success: true, Data: map[string]interface{}{
		"id":             id,
		"endpoint_url":   input.EndpointURL,
		"event_types":    input.EventTypes,
		"is_active":      true,
		"created_at":     createdAt.UTC().Format(time.RFC3339),
		"signing_secret": secret,
	}})
}

func apiDeleteWebhookHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	id := c.Param("id")
	tag, err := dbPool.Exec(c.Request().Context(), `
DELETE FROM outbound_webhooks
WHERE id = $1::uuid AND user_id = $2
`, id, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete webhook"})
	}
	if tag.RowsAffected() == 0 {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Webhook not found"})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "webhook.delete",
		ResourceType: "webhook",
		ResourceID:   id,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Webhook deleted"})
}

func apiWebhookDeliveriesHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	id := c.Param("id")

	rows, err := dbPool.Query(c.Request().Context(), `
SELECT wd.id::text, wd.webhook_id::text, wd.event_type, wd.status_code, wd.success, wd.response_body, wd.created_at
FROM webhook_deliveries wd
INNER JOIN outbound_webhooks ow ON wd.webhook_id = ow.id
WHERE wd.webhook_id = $1::uuid AND ow.user_id = $2
ORDER BY wd.created_at DESC
LIMIT 100
`, id, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch webhook deliveries"})
	}
	defer rows.Close()

	var deliveries []WebhookDelivery
	for rows.Next() {
		var d WebhookDelivery
		var body *string
		if err := rows.Scan(&d.ID, &d.WebhookID, &d.EventType, &d.StatusCode, &d.Success, &body, &d.CreatedAt); err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to scan webhook deliveries"})
		}
		d.ResponseBody = body
		deliveries = append(deliveries, d)
	}
	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read webhook deliveries"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: deliveries})
}

func apiUpsertSecretHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	var input UpsertSecretInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.Name == "" || input.Value == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Name and value are required"})
	}

	encrypted, err := Encrypt([]byte(input.Value))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Encryption error"})
	}

	_, err = queries.UpsertUserSecret(c.Request().Context(), db.UpsertUserSecretParams{
		UserID:         user.ID,
		Name:           input.Name,
		EncryptedValue: encrypted,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to store secret"})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "secret.upsert",
		ResourceType: "secret",
		ResourceID:   input.Name,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Secret stored successfully"})
}

func getUserFromEcho(c echo.Context) *User {
	user, _ := c.Get("user").(*User)
	return user
}

type SEOUpdateInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Keywords    string `json:"keywords"`
	OGImage     string `json:"og_image"`
}

func apiGetSEOHandler(c echo.Context) error {
	settings, err := queries.GetSEOSettings(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch SEO settings"})
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    settings,
	})
}

func apiUpdateSEOHandler(c echo.Context) error {
	var input SEOUpdateInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	err := queries.UpdateSEOSettings(c.Request().Context(), db.UpdateSEOSettingsParams{
		Title:       input.Title,
		Description: input.Description,
		Keywords:    input.Keywords,
		OgImage:     pgtype.Text{String: input.OGImage, Valid: input.OGImage != ""},
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update SEO settings"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "SEO settings updated successfully"})
}

func apiAdminAuditLogsHandler(c echo.Context) error {
	limit := 100
	if raw := c.QueryParam("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 || parsed > 500 {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "limit must be between 1 and 500"})
		}
		limit = parsed
	}

	rows, err := dbPool.Query(c.Request().Context(), `
SELECT id::text, user_id, action, resource_type, resource_id, metadata::text, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT $1
`, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch audit logs"})
	}
	defer rows.Close()

	var logs []AuditLogEntry
	for rows.Next() {
		var entry AuditLogEntry
		var userID *string
		var resourceID *string
		var metadataText string
		var createdAt time.Time
		if err := rows.Scan(&entry.ID, &userID, &entry.Action, &entry.ResourceType, &resourceID, &metadataText, &createdAt); err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to scan audit logs"})
		}
		entry.UserID = userID
		entry.ResourceID = resourceID
		entry.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		entry.Metadata = map[string]interface{}{}
		_ = json.Unmarshal([]byte(metadataText), &entry.Metadata)
		logs = append(logs, entry)
	}
	if err := rows.Err(); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to read audit logs"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: logs})
}

func apiAdminUsageHandler(c echo.Context) error {
	var userCount, taskCount, successCount, failureCount, missedCount, auditCount int64
	if err := dbPool.QueryRow(c.Request().Context(), "SELECT COUNT(*) FROM users").Scan(&userCount); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count users"})
	}
	if err := dbPool.QueryRow(c.Request().Context(), "SELECT COUNT(*) FROM tasks").Scan(&taskCount); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count tasks"})
	}
	if err := dbPool.QueryRow(c.Request().Context(), "SELECT COUNT(*) FROM task_logs WHERE status = 'success'").Scan(&successCount); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count success logs"})
	}
	if err := dbPool.QueryRow(c.Request().Context(), "SELECT COUNT(*) FROM task_logs WHERE status = 'failure'").Scan(&failureCount); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count failure logs"})
	}
	if err := dbPool.QueryRow(c.Request().Context(), "SELECT COUNT(*) FROM task_logs WHERE status = 'missed'").Scan(&missedCount); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count missed logs"})
	}
	if err := dbPool.QueryRow(c.Request().Context(), "SELECT COUNT(*) FROM audit_logs").Scan(&auditCount); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to count audit logs"})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: map[string]int64{
		"users":            userCount,
		"tasks":            taskCount,
		"task_successes":   successCount,
		"task_failures":    failureCount,
		"task_missed":      missedCount,
		"audit_log_events": auditCount,
	}})
}
