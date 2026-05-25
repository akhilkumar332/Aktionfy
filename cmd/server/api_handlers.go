package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"aktionfy/db"
	"github.com/gorilla/csrf"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/labstack/echo/v4"
)

type AuthInput struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	InviteToken string `json:"invite_token,omitempty"`
}

type APIResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message,omitempty"`
	Error     string      `json:"error,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	CSRFToken string      `json:"csrf_token,omitempty"`
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

	var invitedRole = "user"
	var invitedTier = "free"
	if input.InviteToken != "" {
		inv, err := queries.GetUserInvitationByToken(c.Request().Context(), input.InviteToken)
		if err != nil {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid or expired invitation token"})
		}
		if inv.ExpiresAt.Time.Before(time.Now()) {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invitation has expired"})
		}
		if !strings.EqualFold(inv.Email, input.Email) {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "This invitation belongs to a different email address"})
		}
		invitedRole = inv.Role
		invitedTier = inv.Tier
	}

	user, err := RegisterUser(c.Request().Context(), input.Email, input.Password)
	if err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: err.Error()})
	}

	if input.InviteToken != "" {
		_ = queries.UpdateUserRole(c.Request().Context(), db.UpdateUserRoleParams{
			Role: pgtype.Text{String: invitedRole, Valid: true},
			ID:   user.ID,
		})
		_ = queries.UpdateUserTier(c.Request().Context(), db.UpdateUserTierParams{
			Tier: pgtype.Text{String: invitedTier, Valid: true},
			ID:   user.ID,
		})
		user.Role = invitedRole
		user.Tier = invitedTier

		inv, _ := queries.GetUserInvitationByToken(c.Request().Context(), input.InviteToken)
		_ = queries.DeleteUserInvitation(c.Request().Context(), inv.ID)
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
		// Log failed login history if user exists
		info, getErr := queries.GetAuthInfoByEmail(c.Request().Context(), pgtype.Text{String: input.Email, Valid: true})
		if getErr == nil {
			writeLoginHistory(c.Request().Context(), info.ID, c.RealIP(), c.Request().UserAgent(), false)
		}

		if err.Error() == "account is locked" {
			return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "This account has been locked. Please contact support."})
		}
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

	// Fetch user info from Redis cache
	u, err := GetCachedUserBySession(c.Request().Context(), sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch user info from cache"})
	}

	// Update last login
	_ = queries.UpdateUserLastLogin(c.Request().Context(), u.ID)

	// Log successful login history
	writeLoginHistory(c.Request().Context(), u.ID, c.RealIP(), c.Request().UserAgent(), true)

	// Record active session in Redis
	RecordActiveSession(c.Request().Context(), u.ID, sessionID, c.RealIP(), c.Request().UserAgent())

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

	// Try reading dashboard data from cache first
	cachedDash, err := GetCachedDashboard(c.Request().Context(), user.ID)
	if err == nil && cachedDash != nil {
		return c.JSON(http.StatusOK, APIResponse{
			Success: true,
			Data:    cachedDash,
		})
	}

	taskCount, err := GetCachedTaskCount(c.Request().Context(), user.ID, func() (int64, error) {
		return queries.CountUserTasks(c.Request().Context(), user.ID)
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch task count"})
	}

	dashData := &CachedDashboardData{
		User:      user,
		TaskCount: taskCount,
	}

	// Cache dashboard in Redis
	SetCachedDashboard(c.Request().Context(), user.ID, dashData)

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    dashData,
	})
}

func apiSystemStatusHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	activeSessions, err := GlobalSessionManager.GetActiveSessionCount(c.Request().Context())
	if err != nil {
		log.Printf("Error counting active sessions: %v", err)
	}

	workerCount, err := queries.GetActiveWorkerCount(c.Request().Context())
	if err != nil {
		log.Printf("Error counting active workers: %v", err)
	}

	p99, err := queries.GetP99ExecutionLatency(c.Request().Context())
	if err != nil {
		log.Printf("Error fetching P99 latency: %v", err)
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"uptime_seconds":  time.Since(ServerStartTime).Seconds(),
			"active_sessions": activeSessions,
			"worker_count":    workerCount,
			"bridge_active":   GlobalSessionManager.IsOnline(c.Request().Context(), user.ID),
			"p99_latency_ms":  p99,
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
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to rotate API Key"})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "user.rotate_key",
		ResourceType: "user",
		ResourceID:   user.ID,
		Metadata: map[string]interface{}{
			"email": user.Email,
		},
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

	logs := make([]TaskLog, 0)
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
	search := c.QueryParam("search")
	searchPattern := "%" + search + "%"

	cacheKey := fmt.Sprintf("cache:admin:users:%s", search)
	if RedisClient != nil {
		if data, err := RedisClient.Get(c.Request().Context(), cacheKey).Result(); err == nil {
			var cachedUsers []User
			if json.Unmarshal([]byte(data), &cachedUsers) == nil {
				return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cachedUsers})
			}
		}
	}

	rows, err := queries.ListUsers(c.Request().Context(), pgtype.Text{String: searchPattern, Valid: true})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch users"})
	}

	users := make([]User, 0)
	for _, u := range rows {
		maskedKey := u.ApiKey
		if len(maskedKey) > 8 {
			maskedKey = maskedKey[:4] + "...." + maskedKey[len(maskedKey)-4:]
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

		users = append(users, User{
			ID:                u.ID,
			Email:             u.Email.String,
			APIKey:            maskedKey,
			Role:              u.Role.String,
			Tier:              u.Tier.String,
			IsLocked:          u.IsLocked.Bool,
			MaxTasksLimit:     maxTasks,
			RateLimitOverride: rateLimit,
			CreatedAt:         u.CreatedAt.Time,
		})
	}

	if RedisClient != nil {
		if bytes, err := json.Marshal(users); err == nil {
			_ = RedisClient.Set(c.Request().Context(), cacheKey, string(bytes), 30*time.Second).Err()
		}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: users})
}

func apiAdminLoginHistoryHandler(c echo.Context) error {
	limitStr := c.QueryParam("limit")
	offsetStr := c.QueryParam("offset")

	limit := int32(50)
	offset := int32(0)

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = int32(l)
		}
	}
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil {
			offset = int32(o)
		}
	}

	rows, err := queries.ListUserLoginHistory(c.Request().Context(), db.ListUserLoginHistoryParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to retrieve login history: " + err.Error()})
	}

	if rows == nil {
		rows = []db.ListUserLoginHistoryRow{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: rows})
}

type AdminUpdateUserInput struct {
	UserID            string `json:"user_id"`
	Role              string `json:"role"`
	Tier              string `json:"tier"`
	IsLocked          *bool  `json:"is_locked,omitempty"`
	MaxTasksLimit     *int   `json:"max_tasks_limit,omitempty"`
	RateLimitOverride *int   `json:"rate_limit_override,omitempty"`
}

type AdminSystemSettingsInput struct {
	WorkerPruneDays              int32 `json:"worker_prune_days"`
	JsTimeoutMs                  int32 `json:"js_timeout_ms"`
	ReaperStuckThresholdMinutes  int32 `json:"reaper_stuck_threshold_minutes"`
	SchedulerPollIntervalSeconds int32 `json:"scheduler_poll_interval_seconds"`
}

func apiAdminUpdateUserHandler(c echo.Context) error {
	var input AdminUpdateUserInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.UserID == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "user_id is required"})
	}

	// Verify user exists
	targetUser, err := queries.GetUser(c.Request().Context(), input.UserID)
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "User not found"})
	}

	adminUser := getUserFromEcho(c)
	if adminUser == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	if input.Role != "" {
		// Validate role
		validRole := false
		for _, r := range []string{"user", "staff", "admin"} {
			if input.Role == r {
				validRole = true
				break
			}
		}
		if !validRole {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid role"})
		}

		// Prevent self-demotion
		if targetUser.ID == adminUser.ID && input.Role != "admin" {
			return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Cannot demote yourself from admin"})
		}

		err := queries.UpdateUserRole(c.Request().Context(), db.UpdateUserRoleParams{
			Role: pgtype.Text{String: input.Role, Valid: true},
			ID:   input.UserID,
		})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user role"})
		}
	}

	if input.Tier != "" {
		// Validate tier
		validTier := false
		for _, t := range []string{"free", "plus", "pro"} {
			if input.Tier == t {
				validTier = true
				break
			}
		}
		if !validTier {
			return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid tier"})
		}

		err := queries.UpdateUserTier(c.Request().Context(), db.UpdateUserTierParams{
			Tier: pgtype.Text{String: input.Tier, Valid: true},
			ID:   input.UserID,
		})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user tier"})
		}
	}

	if input.IsLocked != nil {
		// Prevent locking yourself
		if targetUser.ID == adminUser.ID && *input.IsLocked {
			return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Cannot lock your own account"})
		}

		err := queries.UpdateUserLock(c.Request().Context(), db.UpdateUserLockParams{
			IsLocked: pgtype.Bool{Bool: *input.IsLocked, Valid: true},
			ID:       input.UserID,
		})
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user lock status"})
		}
	}

	if input.MaxTasksLimit != nil || input.RateLimitOverride != nil {
		params := db.UpdateUserQuotasParams{
			ID: input.UserID,
		}
		if input.MaxTasksLimit != nil {
			if *input.MaxTasksLimit < 0 {
				params.MaxTasksLimit = pgtype.Int4{Valid: false}
			} else {
				params.MaxTasksLimit = pgtype.Int4{Int32: int32(*input.MaxTasksLimit), Valid: true}
			}
		} else {
			params.MaxTasksLimit = targetUser.MaxTasksLimit
		}

		if input.RateLimitOverride != nil {
			if *input.RateLimitOverride < 0 {
				params.RateLimitOverride = pgtype.Int4{Valid: false}
			} else {
				params.RateLimitOverride = pgtype.Int4{Int32: int32(*input.RateLimitOverride), Valid: true}
			}
		} else {
			params.RateLimitOverride = targetUser.RateLimitOverride
		}

		err := queries.UpdateUserQuotas(c.Request().Context(), params)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update user quota overrides"})
		}
	}

	// Emit SSE update event for target user
	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    input.UserID,
		EventType: "user_updated",
		Payload:   "{}",
	})

	// Emit SSE update event for admin user to refresh their view in real-time
	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    adminUser.ID,
		EventType: "user_updated",
		Payload:   "{}",
	})

	adminID := adminUser.ID
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       adminID,
		Action:       "admin.update_user",
		ResourceType: "user",
		ResourceID:   input.UserID,
		Metadata: map[string]interface{}{
			"role":      input.Role,
			"tier":      input.Tier,
			"is_locked": input.IsLocked,
		},
	})
	InvalidateUserCaches(c.Request().Context(), input.UserID)
	InvalidateAdminUsersCache(c.Request().Context())

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "User updated successfully"})
}

func apiApproveTaskHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	idStr := c.Param("id")
	id, err := mustParseUUID(c, idStr)
	if err != nil {
		return err
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
	id, err := mustParseUUID(c, idStr)
	if err != nil {
		return err
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

	ctx := c.Request().Context()
	hasLeased := false
	if RedisClient != nil {
		allLeasesKey := fmt.Sprintf("secret:lease:all:%s", user.ID)
		leasedCount, _ := RedisClient.SCard(ctx, allLeasesKey).Result()
		if leasedCount > 0 {
			hasLeased = true
		}
	}

	// Attempt to resolve from Redis cache first (only if no leased secrets exist)
	if !hasLeased {
		cached, _ := GetCachedUserSecrets(ctx, user.ID)
		if cached != nil {
			return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cached})
		}
	}

	rows, err := queries.ListUserSecrets(ctx, user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch secrets"})
	}
	if rows == nil {
		rows = []db.ListUserSecretsRow{}
	}

	type secretResponse struct {
		ID        pgtype.UUID        `json:"id"`
		Name      string             `json:"name"`
		CreatedAt pgtype.Timestamptz `json:"created_at"`
		IsLeased  bool               `json:"is_leased"`
		TTL       int64              `json:"ttl"`
	}

	activeRows := []db.ListUserSecretsRow{}
	respData := []secretResponse{}

	if RedisClient != nil {
		allLeasesKey := fmt.Sprintf("secret:lease:all:%s", user.ID)
		for _, row := range rows {
			isLeased, err := RedisClient.SIsMember(ctx, allLeasesKey, row.Name).Result()
			if err == nil && isLeased {
				leaseKey := fmt.Sprintf("secret:lease:has:%s:%s", user.ID, row.Name)
				ttlDuration, err := RedisClient.TTL(ctx, leaseKey).Result()
				if err == nil {
					if ttlDuration <= 0 {
						// Expired! Lazily delete from DB
						_ = queries.DeleteUserSecret(ctx, db.DeleteUserSecretParams{
							UserID: user.ID,
							Name:   row.Name,
						})
						_ = RedisClient.SRem(ctx, allLeasesKey, row.Name).Err()
						continue
					}
					respData = append(respData, secretResponse{
						ID:        row.ID,
						Name:      row.Name,
						CreatedAt: row.CreatedAt,
						IsLeased:  true,
						TTL:       int64(ttlDuration.Seconds()),
					})
					activeRows = append(activeRows, row)
					continue
				}
			}
			respData = append(respData, secretResponse{
				ID:        row.ID,
				Name:      row.Name,
				CreatedAt: row.CreatedAt,
				IsLeased:  false,
				TTL:       0,
			})
			activeRows = append(activeRows, row)
		}
	} else {
		for _, row := range rows {
			respData = append(respData, secretResponse{
				ID:        row.ID,
				Name:      row.Name,
				CreatedAt: row.CreatedAt,
				IsLeased:  false,
				TTL:       0,
			})
			activeRows = append(activeRows, row)
		}
	}

	// Populate Redis cache for subsequent calls (only if no leased secrets exist)
	if !hasLeased {
		SetCachedUserSecrets(ctx, user.ID, activeRows)
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: respData})
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

	if RedisClient != nil {
		leaseKey := fmt.Sprintf("secret:lease:has:%s:%s", user.ID, name)
		_ = RedisClient.Del(c.Request().Context(), leaseKey).Err()

		allLeasesKey := fmt.Sprintf("secret:lease:all:%s", user.ID)
		_ = RedisClient.SRem(c.Request().Context(), allLeasesKey, name).Err()
	}

	// Invalidate secrets cache after deletion
	InvalidateCachedUserSecrets(c.Request().Context(), user.ID)

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    user.ID,
		EventType: "secret_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Secret deleted"})
}

type UpsertSecretInput struct {
	Name  string `json:"name"`
	Value string `json:"value"`
	TTL   int    `json:"ttl"` // optional lease TTL in seconds
}

func apiListWebhooksHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	rows, err := queries.ListOutboundWebhooks(c.Request().Context(), user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch webhooks"})
	}

	hooks := make([]WebhookSubscription, 0)
	for _, row := range rows {
		var eventTypes []string
		if len(row.EventTypes) > 0 {
			if err := json.Unmarshal(row.EventTypes, &eventTypes); err != nil {
				log.Printf("Warning: failed to unmarshal event types for webhook %s: %v", formatUUID(row.ID), err)
			}
		}

		hooks = append(hooks, WebhookSubscription{
			ID:          formatUUID(row.ID),
			EndpointURL: row.EndpointUrl,
			EventTypes:  eventTypes,
			IsActive:    row.IsActive,
			CreatedAt:   row.CreatedAt.Time,
		})
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
	eventTypesJSON, err := json.Marshal(input.EventTypes)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to process event types"})
	}

	row, err := queries.CreateOutboundWebhook(c.Request().Context(), db.CreateOutboundWebhookParams{
		UserID:                 user.ID,
		EndpointUrl:            input.EndpointURL,
		EventTypes:             eventTypesJSON,
		EncryptedSigningSecret: encryptedSecret,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create webhook"})
	}

	id := formatUUID(row.ID)
	createdAt := row.CreatedAt.Time

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

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    user.ID,
		EventType: "webhook_updated",
		Payload:   "{}",
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
	idStr := c.Param("id")
	id, err := mustParseUUID(c, idStr)
	if err != nil {
		return err
	}

	err = queries.DeleteOutboundWebhook(c.Request().Context(), db.DeleteOutboundWebhookParams{

		ID:     id,
		UserID: user.ID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete webhook"})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "webhook.delete",
		ResourceType: "webhook",
		ResourceID:   idStr,
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    user.ID,
		EventType: "webhook_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Webhook deleted"})
}

func apiWebhookDeliveriesHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	idStr := c.Param("id")
	id, err := mustParseUUID(c, idStr)
	if err != nil {
		return err
	}

	rows, err := queries.ListWebhookDeliveries(c.Request().Context(), db.ListWebhookDeliveriesParams{
		WebhookID: id,
		UserID:    user.ID,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch webhook deliveries"})
	}

	deliveries := make([]WebhookDelivery, 0)
	for _, row := range rows {
		var statusCode *int32
		if row.StatusCode.Valid {
			sc := row.StatusCode.Int32
			statusCode = &sc
		}
		var body *string
		if row.ResponseBody.Valid {
			b := row.ResponseBody.String
			body = &b
		}

		deliveries = append(deliveries, WebhookDelivery{
			ID:           formatUUID(row.ID),
			WebhookID:    formatUUID(row.WebhookID),
			EventType:    row.EventType,
			StatusCode:   statusCode,
			Success:      row.Success,
			ResponseBody: body,
			CreatedAt:    row.CreatedAt.Time,
		})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: deliveries})
}

func apiTestWebhookHandler(c echo.Context) error {
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	idStr := c.Param("id")
	id, err := mustParseUUID(c, idStr)
	if err != nil {
		return err
	}

	var endpointURL string
	var encryptedSigningSecret []byte
	err = dbPool.QueryRow(c.Request().Context(),
		"SELECT endpoint_url, encrypted_signing_secret FROM outbound_webhooks WHERE id = $1 AND user_id = $2",
		id, user.ID).Scan(&endpointURL, &encryptedSigningSecret)
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Webhook not found"})
	}

	secret, err := Decrypt(encryptedSigningSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to decrypt signing secret"})
	}

	mockEvent := PubSubEvent{
		UserID:    user.ID,
		EventType: "webhook_test",
		Payload:   "{\"message\": \"This is a test notification from Aktionfy!\", \"ping\": true}",
	}

	webhookID := formatUUID(id)
	err = deliverWebhookEvent(c.Request().Context(), webhookID, mockEvent, endpointURL, string(secret))
	if err != nil {
		return c.JSON(http.StatusOK, APIResponse{
			Success: false,
			Error:   fmt.Sprintf("Webhook delivery failed: %v", err),
		})
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Test payload delivered successfully",
	})
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

	// Basic validation: names should be alphanumeric or underscores
	nameRegex := `^[a-zA-Z0-9_-]+$`
	matched, _ := regexp.MatchString(nameRegex, input.Name)
	if !matched {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid secret name. Use alphanumeric characters, dashes, or underscores."})
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

	// Set lease in Redis if TTL > 0
	if RedisClient != nil && input.TTL > 0 {
		leaseKey := fmt.Sprintf("secret:lease:has:%s:%s", user.ID, input.Name)
		_ = RedisClient.Set(c.Request().Context(), leaseKey, "1", time.Duration(input.TTL)*time.Second).Err()

		allLeasesKey := fmt.Sprintf("secret:lease:all:%s", user.ID)
		_ = RedisClient.SAdd(c.Request().Context(), allLeasesKey, input.Name).Err()
	} else if RedisClient != nil && input.TTL == 0 {
		leaseKey := fmt.Sprintf("secret:lease:has:%s:%s", user.ID, input.Name)
		_ = RedisClient.Del(c.Request().Context(), leaseKey).Err()

		allLeasesKey := fmt.Sprintf("secret:lease:all:%s", user.ID)
		_ = RedisClient.SRem(c.Request().Context(), allLeasesKey, input.Name).Err()
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "secret.upsert",
		ResourceType: "secret",
		ResourceID:   input.Name,
	})

	// Invalidate secrets cache after upsert
	InvalidateCachedUserSecrets(c.Request().Context(), user.ID)

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    user.ID,
		EventType: "secret_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Secret stored successfully"})
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

	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
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

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    user.ID,
		EventType: "seo_updated",
		Payload:   "{}",
	})

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

	cacheKey := fmt.Sprintf("cache:admin:audit_logs:%d", limit)
	if RedisClient != nil {
		if data, err := RedisClient.Get(c.Request().Context(), cacheKey).Result(); err == nil {
			var cachedLogs []AuditLogEntry
			if json.Unmarshal([]byte(data), &cachedLogs) == nil {
				return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cachedLogs})
			}
		}
	}

	rows, err := queries.ListAuditLogs(c.Request().Context(), int32(limit))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch audit logs"})
	}

	logs := make([]AuditLogEntry, 0)
	for _, row := range rows {
		var entry AuditLogEntry
		entry.ID = formatUUID(row.ID)
		if row.UserID.Valid {
			uid := row.UserID.String
			entry.UserID = &uid
		}
		entry.Action = row.Action
		entry.ResourceType = row.ResourceType
		if row.ResourceID.Valid {
			rid := row.ResourceID.String
			entry.ResourceID = &rid
		}
		entry.CreatedAt = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		entry.Metadata = map[string]interface{}{}
		if len(row.Metadata) > 0 {
			if err := json.Unmarshal(row.Metadata, &entry.Metadata); err != nil {
				log.Printf("Warning: failed to unmarshal metadata for audit log %s: %v", formatUUID(row.ID), err)
			}
		}
		logs = append(logs, entry)
	}

	if RedisClient != nil {
		if bytes, err := json.Marshal(logs); err == nil {
			_ = RedisClient.Set(c.Request().Context(), cacheKey, string(bytes), 15*time.Second).Err()
		}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: logs})
}

func apiAdminUsageHandler(c echo.Context) error {
	cacheKey := "cache:admin:usage_metrics"
	if RedisClient != nil {
		if data, err := RedisClient.Get(c.Request().Context(), cacheKey).Result(); err == nil {
			var cachedMetrics map[string]int64
			if json.Unmarshal([]byte(data), &cachedMetrics) == nil {
				return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cachedMetrics})
			}
		}
	}

	metrics, err := queries.GetSystemUsageMetrics(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch metrics"})
	}

	res := map[string]int64{
		"users":            metrics.UserCount,
		"tasks":            metrics.TaskCount,
		"task_successes":   metrics.SuccessCount,
		"task_failures":    metrics.FailureCount,
		"task_missed":      metrics.MissedCount,
		"audit_log_events": metrics.AuditCount,
	}

	if RedisClient != nil {
		if bytes, err := json.Marshal(res); err == nil {
			_ = RedisClient.Set(c.Request().Context(), cacheKey, string(bytes), 1*time.Minute).Err()
		}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: res})
}

func apiAdminGetSettingsHandler(c echo.Context) error {
	cacheKey := "cache:admin:settings"
	if RedisClient != nil {
		if data, err := RedisClient.Get(c.Request().Context(), cacheKey).Result(); err == nil {
			var cachedSettings map[string]int32
			if json.Unmarshal([]byte(data), &cachedSettings) == nil {
				return c.JSON(http.StatusOK, APIResponse{Success: true, Data: cachedSettings})
			}
		}
	}

	var pruneDays, jsTimeout, reaperThreshold, pollInterval int32
	ctx := c.Request().Context()
	err := dbPool.QueryRow(ctx, "SELECT worker_prune_days, js_timeout_ms, reaper_stuck_threshold_minutes, scheduler_poll_interval_seconds FROM system_settings WHERE id = 1").Scan(&pruneDays, &jsTimeout, &reaperThreshold, &pollInterval)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch settings"})
	}

	res := map[string]int32{
		"worker_prune_days":              pruneDays,
		"js_timeout_ms":                  jsTimeout,
		"reaper_stuck_threshold_minutes": reaperThreshold,
		"scheduler_poll_interval_seconds": pollInterval,
	}

	if RedisClient != nil {
		if bytes, err := json.Marshal(res); err == nil {
			_ = RedisClient.Set(ctx, cacheKey, string(bytes), 5*time.Minute).Err()
		}
	}

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    res,
	})
}

func apiAdminUpdateSettingsHandler(c echo.Context) error {
	var input AdminSystemSettingsInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.WorkerPruneDays < 1 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Worker prune days must be at least 1"})
	}
	if input.JsTimeoutMs < 100 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "JS execution timeout must be at least 100ms"})
	}
	if input.ReaperStuckThresholdMinutes < 1 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Reaper threshold must be at least 1 minute"})
	}
	if input.SchedulerPollIntervalSeconds < 1 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Scheduler poll interval must be at least 1 second"})
	}

	ctx := c.Request().Context()
	_, err := dbPool.Exec(ctx, `
		UPDATE system_settings 
		SET worker_prune_days = $1, 
		    js_timeout_ms = $2, 
		    reaper_stuck_threshold_minutes = $3, 
		    scheduler_poll_interval_seconds = $4,
		    updated_at = NOW() 
		WHERE id = 1`,
		input.WorkerPruneDays,
		input.JsTimeoutMs,
		input.ReaperStuckThresholdMinutes,
		input.SchedulerPollIntervalSeconds,
	)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to update settings"})
	}

	if RedisClient != nil {
		_ = RedisClient.Del(ctx, "cache:admin:settings").Err()
		_ = RedisClient.Del(ctx, "sys:settings").Err()
	}
	// Sync local setting cache immediately from DB (since Redis was just cleared)
	syncSettings(ctx)

	// Notify all other nodes to sync their in-memory settings immediately
	PublishEvent(ctx, PubSubEvent{
		UserID:    "system",
		EventType: "settings_updated",
		Payload:   "{}",
	})
	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	writeAuditLog(ctx, AuditEvent{
		UserID:       user.ID,
		Action:       "admin.update_settings",
		ResourceType: "system_settings",
		Metadata: map[string]interface{}{
			"worker_prune_days":                input.WorkerPruneDays,
			"js_timeout_ms":                    input.JsTimeoutMs,
			"reaper_stuck_threshold_minutes":   input.ReaperStuckThresholdMinutes,
			"scheduler_poll_interval_seconds": input.SchedulerPollIntervalSeconds,
		},
	})

	_ = PublishEvent(ctx, PubSubEvent{
		UserID:    user.ID,
		EventType: "settings_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Settings updated successfully"})
}

func apiAdminPruneNowHandler(c echo.Context) error {
	days, err := queries.GetSystemSettings(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to fetch settings"})
	}

	if days <= 0 {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid pruning threshold in settings"})
	}

	res, err := dbPool.Exec(c.Request().Context(), "DELETE FROM worker_heartbeats WHERE last_heartbeat < NOW() - ($1::int * INTERVAL '1 day')", days)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to prune workers: " + err.Error()})
	}

	rowsAffected := res.RowsAffected()

	user := getUserFromEcho(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       user.ID,
		Action:       "admin.prune_workers",
		ResourceType: "system",
		Metadata: map[string]interface{}{
			"pruned_count": rowsAffected,
		},
	})

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    user.ID,
		EventType: "worker_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("Cleanup complete. %d zombie nodes terminated.", rowsAffected),
		Data: map[string]interface{}{
			"pruned_count": rowsAffected,
		},
	})
}

func apiAdminImpersonateUserHandler(c echo.Context) error {
	var input ImpersonateRequest
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	admin := getUserFromEcho(c)
	if admin == nil || admin.Role != "admin" {
		return c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "Forbidden: Root admin credentials required"})
	}

	target, err := queries.GetUser(c.Request().Context(), input.UserID)
	if err != nil {
		return c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: "Target user not found"})
	}

	if target.ID == admin.ID {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Cannot impersonate yourself"})
	}

	expiry := time.Now().Add(1 * time.Hour)
	sessID, err := queries.CreateWebSession(c.Request().Context(), db.CreateWebSessionParams{
		UserID:    pgtype.Text{String: target.ID, Valid: true},
		ExpiresAt: pgtype.Timestamptz{Time: expiry, Valid: true},
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to establish impersonation session"})
	}

	// Store admin's current session cookie so we can restore it on stop-impersonate
	adminCookie, err := c.Cookie("session_id")
	if err == nil {
		c.SetCookie(&http.Cookie{
			Name:     "original_session_id",
			Value:    adminCookie.Value,
			Path:     "/",
			HttpOnly: true,
			Secure:   appConfig.secureCookies(),
			SameSite: http.SameSiteLaxMode,
			Expires:  time.Now().Add(24 * time.Hour),
		})
	}

	// Set session cookie to target user
	c.SetCookie(&http.Cookie{
		Name:     "session_id",
		Value:    sessID.String(),
		Path:     "/",
		HttpOnly: true,
		Secure:   appConfig.secureCookies(),
		SameSite: http.SameSiteLaxMode,
		Expires:  expiry,
	})

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       admin.ID,
		Action:       "admin.impersonate_start",
		ResourceType: "user",
		ResourceID:   target.ID,
		Metadata: map[string]interface{}{
			"impersonated_email": target.Email.String,
		},
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Impersonation session established"})
}

func apiAdminStopImpersonateHandler(c echo.Context) error {
	origCookie, err := c.Cookie("original_session_id")
	if err != nil || origCookie.Value == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "No active impersonation session found"})
	}

	// Restore original session ID cookie
	c.SetCookie(&http.Cookie{
		Name:     "session_id",
		Value:    origCookie.Value,
		Path:     "/",
		HttpOnly: true,
		Secure:   appConfig.secureCookies(),
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(24 * time.Hour),
	})

	// Clear original_session_id cookie
	c.SetCookie(&http.Cookie{
		Name:     "original_session_id",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   appConfig.secureCookies(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Impersonation session terminated"})
}

func apiAdminRevokeSessionsHandler(c echo.Context) error {
	var input struct {
		UserID string `json:"user_id"`
	}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if RedisClient == nil {
		return c.JSON(http.StatusServiceUnavailable, APIResponse{Success: false, Error: "Redis is offline"})
	}

	ctx := c.Request().Context()
	// Delete user sessions from Redis
	_ = RedisClient.Del(ctx, fmt.Sprintf("session:%s", input.UserID)).Err()
	_ = RedisClient.Del(ctx, fmt.Sprintf("bridge:session:%s", input.UserID)).Err()
	_ = RedisClient.Del(ctx, fmt.Sprintf("conn_count:%s", input.UserID)).Err()

	// Push session revocation event to user's stream
	_ = PublishEvent(ctx, PubSubEvent{
		UserID:    input.UserID,
		EventType: "user_sessions_revoked",
		Payload:   "{}",
	})

	admin := getUserFromEcho(c)
	if admin != nil {
		writeAuditLog(ctx, AuditEvent{
			UserID:       admin.ID,
			Action:       "admin.revoke_sessions",
			ResourceType: "user",
			ResourceID:   input.UserID,
		})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "All active sessions and bridge heartbeats revoked successfully"})
}

func apiAdminRolloverKeyHandler(c echo.Context) error {
	var input struct {
		UserID string `json:"user_id"`
	}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	newKey, err := RotateAPIKey(c.Request().Context(), input.UserID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to rollover API key: " + err.Error()})
	}

	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    input.UserID,
		EventType: "user_updated",
		Payload:   "{}",
	})

	admin := getUserFromEcho(c)
	if admin != nil {
		writeAuditLog(c.Request().Context(), AuditEvent{
			UserID:       admin.ID,
			Action:       "admin.rollover_api_key",
			ResourceType: "user",
			ResourceID:   input.UserID,
		})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "API Key rotated successfully", Data: map[string]string{"api_key": newKey}})
}

func apiAdminCreateInvitationHandler(c echo.Context) error {
	var input CreateInvitationInput
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	if input.Email == "" || input.Role == "" || input.Tier == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "All fields are required"})
	}

	// Generate secure invitation token
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	token := hex.EncodeToString(b)

	admin := getUserFromEcho(c)
	if admin == nil {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}

	expiry := time.Now().Add(7 * 24 * time.Hour) // 7 days default expiration
	err := queries.CreateUserInvitation(c.Request().Context(), db.CreateUserInvitationParams{
		Email:       input.Email,
		Role:        input.Role,
		Tier:        input.Tier,
		InviteToken: token,
		ExpiresAt:   pgtype.Timestamptz{Time: expiry, Valid: true},
		CreatedBy:   pgtype.Text{String: admin.ID, Valid: true},
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to create invitation: " + err.Error()})
	}

	writeAuditLog(c.Request().Context(), AuditEvent{
		UserID:       admin.ID,
		Action:       "admin.create_invitation",
		ResourceType: "invitation",
		ResourceID:   input.Email,
	})

	// Emit SSE updates for admin users
	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    admin.ID,
		EventType: "invitations_updated",
		Payload:   "{}",
	})

	return c.JSON(http.StatusCreated, APIResponse{Success: true, Message: "Invitation successfully pre-registered", Data: map[string]string{"token": token}})
}

func apiAdminListInvitationsHandler(c echo.Context) error {
	invites, err := queries.ListUserInvitations(c.Request().Context())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to retrieve invitations: " + err.Error()})
	}

	if len(invites) == 0 {
		invites = []db.ListUserInvitationsRow{}
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: invites})
}

func apiAdminDeleteInvitationHandler(c echo.Context) error {
	idStr := c.Param("id")
	var id pgtype.UUID
	if err := parseUUID(idStr, &id); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid invitation ID"})
	}

	err := queries.DeleteUserInvitation(c.Request().Context(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to delete invitation"})
	}

	admin := getUserFromEcho(c)
	if admin != nil {
		writeAuditLog(c.Request().Context(), AuditEvent{
			UserID:       admin.ID,
			Action:       "admin.delete_invitation",
			ResourceType: "invitation",
			ResourceID:   idStr,
		})

		_ = PublishEvent(c.Request().Context(), PubSubEvent{
			UserID:    admin.ID,
			EventType: "invitations_updated",
			Payload:   "{}",
		})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Invitation successfully revoked"})
}

func apiListSessionsHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	sessions := GetActiveSessions(c.Request().Context(), userID)
	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: sessions})
}

func apiRevokeSessionHandler(c echo.Context) error {
	userID := getUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "Unauthorized"})
	}
	sessionID := c.Param("id")
	if sessionID == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Session ID required"})
	}

	if err := RevokeActiveSession(c.Request().Context(), userID, sessionID); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to revoke session: " + err.Error()})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Session revoked successfully"})
}

func apiAdminToggleMaintenanceHandler(c echo.Context) error {
	ctx := c.Request().Context()
	if RedisClient == nil {
		return c.JSON(http.StatusServiceUnavailable, APIResponse{Success: false, Error: "Redis offline"})
	}

	var input struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.Bind(&input); err != nil {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "Invalid request body"})
	}

	admin := getUserFromEcho(c)
	if input.Enabled {
		err := RedisClient.Set(ctx, "sys:maintenance", "true", 0).Err()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to enable maintenance mode"})
		}
		if admin != nil {
			writeAuditLog(ctx, AuditEvent{
				UserID:       admin.ID,
				Action:       "admin.enable_maintenance",
				ResourceType: "system",
				ResourceID:   "maintenance",
			})
		}
		_ = PublishEvent(ctx, PubSubEvent{
			UserID:    "system",
			EventType: "maintenance_mode_changed",
			Payload:   "{\"status\":\"enabled\"}",
		})
	} else {
		err := RedisClient.Del(ctx, "sys:maintenance").Err()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to disable maintenance mode"})
		}
		if admin != nil {
			writeAuditLog(ctx, AuditEvent{
				UserID:       admin.ID,
				Action:       "admin.disable_maintenance",
				ResourceType: "system",
				ResourceID:   "maintenance",
			})
		}
		_ = PublishEvent(ctx, PubSubEvent{
			UserID:    "system",
			EventType: "maintenance_mode_changed",
			Payload:   "{\"status\":\"disabled\"}",
		})
	}

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: fmt.Sprintf("Maintenance mode set to %v", input.Enabled)})
}

func apiGetMaintenanceStatusHandler(c echo.Context) error {
	if RedisClient == nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true, Data: map[string]interface{}{"enabled": false}})
	}
	exists, err := RedisClient.Exists(c.Request().Context(), "sys:maintenance").Result()
	if err != nil {
		return c.JSON(http.StatusOK, APIResponse{Success: true, Data: map[string]interface{}{"enabled": false}})
	}
	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: map[string]interface{}{"enabled": exists > 0}})
}

func apiAdminListSessionsHandler(c echo.Context) error {
	userID := c.Param("id")
	if userID == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "User ID required"})
	}
	sessions := GetActiveSessions(c.Request().Context(), userID)
	return c.JSON(http.StatusOK, APIResponse{Success: true, Data: sessions})
}

func apiAdminRevokeSessionHandler(c echo.Context) error {
	userID := c.Param("id")
	sessionID := c.Param("session_id")
	if userID == "" || sessionID == "" {
		return c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: "User ID and Session ID required"})
	}

	if err := RevokeActiveSession(c.Request().Context(), userID, sessionID); err != nil {
		return c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: "Failed to revoke session: " + err.Error()})
	}

	// Trigger SSE session revocation event for user
	_ = PublishEvent(c.Request().Context(), PubSubEvent{
		UserID:    userID,
		EventType: "session_revoked",
		Payload:   fmt.Sprintf("{\"session_id\":\"%s\"}", sessionID),
	})

	return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "Session revoked successfully"})
}


