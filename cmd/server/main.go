package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"aktionfy/db"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/gorilla/csrf"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/mark3labs/mcp-go/server"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"

	"github.com/exaring/otelpgx"
	"go.opentelemetry.io/contrib/instrumentation/github.com/labstack/echo/otelecho"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func initRedis(redisUrl string) {
	if redisUrl == "" {
		redisUrl = "redis://localhost:6379/0"
	}
	opts, err := redis.ParseURL(redisUrl)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	RedisClient = redis.NewClient(opts)

	_, err = RedisClient.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis")
}

func initTracer(ctx context.Context) func(context.Context) error {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" || endpoint == "off" {
		log.Println("OTEL_EXPORTER_OTLP_ENDPOINT not set or off. Tracing disabled.")
		return func(context.Context) error { return nil }
	}

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(endpoint),
	)
	if err != nil {
		log.Printf("Failed to create OTLP trace exporter: %v", err)
		return func(context.Context) error { return nil }
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("aktionfy"),
			semconv.ServiceVersionKey.String("1.0.0"),
		),
	)
	if err != nil {
		log.Printf("Failed to create resource: %v", err)
		return func(context.Context) error { return nil }
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))

	return func(ctx context.Context) error {
		return tp.Shutdown(ctx)
	}
}

func syncSettings(ctx context.Context) {
	var js, reaper, poll int
	
	// 1. Try to fetch from Redis first
	if RedisClient != nil {
		data, err := RedisClient.Get(ctx, "sys:settings").Result()
		if err == nil {
			var settings map[string]int
			if json.Unmarshal([]byte(data), &settings) == nil {
				CurrentSystemSettings.Update(settings["js_timeout_ms"], settings["reaper_stuck_threshold_minutes"], settings["scheduler_poll_interval_seconds"])
				return
			}
		}
	}

	// 2. Fallback to DB
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	
	// We also fetch worker_prune_days to cache it, though CurrentSystemSettings doesn't use it
	var pruneDays int
	err := dbPool.QueryRow(timeoutCtx, "SELECT js_timeout_ms, reaper_stuck_threshold_minutes, scheduler_poll_interval_seconds, worker_prune_days FROM system_settings WHERE id = 1").Scan(&js, &reaper, &poll, &pruneDays)
	if err != nil {
		log.Printf("Error syncing system settings: %v", err)
		return
	}
	
	// 3. Update memory
	CurrentSystemSettings.Update(js, reaper, poll)
	
	// 4. Update Redis cache
	if RedisClient != nil {
		res := map[string]int{
			"js_timeout_ms":                  js,
			"reaper_stuck_threshold_minutes": reaper,
			"scheduler_poll_interval_seconds": poll,
			"worker_prune_days":              pruneDays,
		}
		if bytes, err := json.Marshal(res); err == nil {
			// Cache indefinitely, it gets cleared on update
			_ = RedisClient.Set(ctx, "sys:settings", string(bytes), 0).Err()
		}
	}
}

func main() {
	ServerStartTime = time.Now().UTC()
	hostname, _ := os.Hostname()
	workerID = fmt.Sprintf("%s-%d", hostname, time.Now().UTC().UnixNano())

	cfg, err := loadRuntimeConfigFromEnv()
	if err != nil {
		log.Fatalf("Invalid runtime configuration: %v", err)
	}
	appConfig = cfg

	// 0. Initialize Encryption
	initCrypto()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	shutdownTracer := initTracer(ctx)
	defer shutdownTracer(ctx)

	// 1. Initialize PostgreSQL Connection Pool
	dbUrl := os.Getenv("DATABASE_URL")
	if dbUrl == "" {
		dbUrl = "postgres://postgres:postgres@localhost:5432/mcp?sslmode=disable"
	}

	pgxCfg, err := pgxpool.ParseConfig(dbUrl)
	if err != nil {
		log.Fatalf("Unable to parse database URL: %v", err)
	}
	pgxCfg.ConnConfig.Tracer = otelpgx.NewTracer()

	dbPool, err = pgxpool.NewWithConfig(ctx, pgxCfg)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer dbPool.Close()

	// Initialize and run migrations using golang-migrate
	// Ensure the migrations path is correct relative to the executable.
	// If running from inside a container, it might need adjustment.
	// For this example, we assume './migrations' relative to the executable.
	// The DB URL should be derived from environment variables.
	// Ensure database connection is valid before attempting migrations
	ctxForMigrations := context.Background() // Use a background context for migrations
	if err := dbPool.Ping(ctxForMigrations); err != nil {
		log.Fatalf("Database not available for migrations: %v", err)
	}

	// Use migrate.New with the database URL for simplicity
	m, err := migrate.New(
		"file://migrations", // Path to migration files
		dbUrl,               // Database connection URL
	)

	if err != nil {
		log.Fatalf("Failed to create migration instance: %v", err)
	}

	// Apply pending migrations
	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		// If migration fails, log the error and consider stopping the application startup
		// depending on whether migrations are critical for startup.
		log.Fatalf("Failed to apply migrations: %v", err)
	} else if err == migrate.ErrNoChange {
		log.Println("No pending migrations to apply.")
	} else {
		log.Println("Migrations applied successfully.")
	}

	// Optional: You can also implement rollback logic or version checking here if needed.
	// For example, to check current version:
	// version, dirty, err := m.Version()
	// if err != nil && err != migrate.ErrNilVersion {
	//     log.Printf("Failed to get migration version: %v", err)
	// } else {
	//     log.Printf("Current migration version: %d, dirty: %t", version, dirty)
	// }

	queries = &queriesWrapper{db.New(dbPool)}

	// 1.5 Initialize Redis Client
	initRedis(cfg.RedisURL)
	defer RedisClient.Close()

	workerWG.Add(1)
	go func() {
		defer workerWG.Done()
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic recovered in event subscriber: %v", r)
			}
		}()
		// Subscribe to events using the main cancellable context
		SubscribeToEvents(ctx, func(ctx context.Context, event PubSubEvent) {
			handleSystemEvent(ctx, event)
		})
	}()

	globalRateLimiter.client = RedisClient
	GlobalSessionManager.Init(RedisClient)

	// 2. Initialize MCP Server
	mcpServer := server.NewMCPServer("aktionfy", "1.0.0", server.WithHooks(&server.Hooks{}))
	mcpServer.EnableSampling()

	// Initialize SSE Server earlier so it can be used in hooks
	sseServer := server.NewSSEServer(mcpServer)

	mcpServer.GetHooks().AddOnRegisterSession(func(ctx context.Context, session server.ClientSession) {
		userID, ok := ctx.Value(userIDKey).(string)
		if ok && userID != "" {
			log.Printf("MCP Session registered for user %s (ID: %s)", userID, session.SessionID())
			// Wrap session with sampling support
			wrapped := &SamplingSSESession{
				ClientSession: session,
				sseServer:     sseServer,
			}
			GlobalSessionManager.AddMCPSession(userID, wrapped)
		}
	})

	mcpServer.GetHooks().AddOnUnregisterSession(func(ctx context.Context, session server.ClientSession) {
		userID, ok := ctx.Value(userIDKey).(string)
		if ok && userID != "" {
			log.Printf("MCP Session unregistered for user %s (ID: %s)", userID, session.SessionID())
			GlobalSessionManager.RemoveMCPSession(userID, session.SessionID())
		}
	})

	// Register Tools
	registerTools(mcpServer)

	// 3. Setup Echo Server
	e := echo.New()
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		code := http.StatusInternalServerError
		if he, ok := err.(*echo.HTTPError); ok {
			code = he.Code
		}
		if code == http.StatusInternalServerError {
			log.Printf("CRITICAL SERVER ERROR [%s %s]: %v", c.Request().Method, c.Request().URL.Path, err)
		}
		e.DefaultHTTPErrorHandler(err, c)
	}

	// URL Fix Middleware must be at the very top for CSRF same-origin check
	e.Pre(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			r := c.Request()

			// Force populate r.URL Host/Scheme from request headers if missing
			// gorilla/csrf's same-origin check requires these to be present.
			if r.URL.Host == "" {
				r.URL.Host = r.Host
			}
			if r.URL.Scheme == "" {
				if c.IsTLS() || r.Header.Get("X-Forwarded-Proto") == "https" {
					r.URL.Scheme = "https"
				} else {
					r.URL.Scheme = "http"
				}
			}

			// Special case for local dev: if Origin matches Host, ensure they are string-identical
			// to bypass any subtle gorilla/csrf comparison issues.
			if cfg.LocalDev {
				origin := r.Header.Get("Origin")
				if origin != "" {
					if u, err := url.Parse(origin); err == nil {
						// If the origin host matches our request host, align them perfectly
						if u.Host == r.Host {
							r.URL.Host = u.Host
							r.URL.Scheme = u.Scheme
						}
					}
				}
			}

			return next(c)
		}
	})

	// Standard Echo Middleware
	e.Use(otelecho.Middleware("aktionfy"))
	//lint:ignore SA1019 simple logger is sufficient
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.RequestID())
	e.Use(middleware.BodyLimit("2M")) // Prevent DoS via large payloads
	e.Use(prometheusMiddleware)

	// 3.5 Health Check (Public)
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok", "version": "1.0.0"})
	}, IPRateLimitMiddleware)

	// CSRF Setup
	csrfKey := cfg.CSRFKey
	if len(csrfKey) < 32 {
		csrfKey = defaultCSRFKey // non-production fallback
	}
	useSecure := cfg.secureCookies()
	trustedOrigins := cfg.csrfTrustedOrigins()
	log.Printf("CSRF Protection enabled. Secure: %v, Trusted Origins: %v", useSecure, trustedOrigins)

	csrfCore := csrf.Protect(
		[]byte(csrfKey),
		csrf.Secure(useSecure),
		csrf.SameSite(csrf.SameSiteLaxMode),
		csrf.Path("/"),
		csrf.TrustedOrigins(trustedOrigins),
		csrf.ErrorHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			failureReason := csrf.FailureReason(r)
			origin := r.Header.Get("Origin")
			referer := r.Header.Get("Referer")
			host := r.Host

			log.Printf("CSRF Failure for %s %s: %v", r.Method, r.URL.Path, failureReason)
			log.Printf("CSRF Debug - Origin: %q, Referer: %q, Host: %q, RequestURL: %q", origin, referer, host, r.URL.String())

			errorMessage := fmt.Sprintf("Forbidden - CSRF error: %v", failureReason)
			if strings.Contains(failureReason.Error(), "Origin") {
				errorMessage = fmt.Sprintf("CSRF Origin mismatch: %q is not in trusted list. Host is %q, RequestURL is %q.", origin, host, r.URL.String())
			} else if strings.Contains(failureReason.Error(), "token") {
				errorMessage = "CSRF token missing or mismatch. Ensure cookies are enabled and the X-CSRF-Token header is set."
			}

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(APIResponse{
				Success: false,
				Error:   errorMessage,
			})
		})),
	)

	// Wrap CSRF with absolute reliability for local development
	csrfMiddleware := func(next echo.HandlerFunc) echo.HandlerFunc {
		// Initialize the standard handler
		csrfHandler := echo.WrapMiddleware(func(handler http.Handler) http.Handler {
			return csrfCore(handler)
		})(next)

		return func(c echo.Context) error {
			r := c.Request()

			if cfg.LocalDev {
				origin := r.Header.Get("Origin")
				// If origin is local, skip the check entirely in dev.
				// This is the only way to reliably bypass gorilla/csrf's strict internal checks in complex Docker/network setups.
				isLocalOrigin := origin == "" ||
					strings.Contains(origin, "localhost") ||
					strings.Contains(origin, "127.0.0.1") ||
					strings.Contains(origin, "192.168.") ||
					strings.Contains(origin, "10.") ||
					strings.Contains(origin, "172.17.") ||
					strings.Contains(origin, "172.18.") ||
					strings.Contains(origin, "172.19.") ||
					strings.Contains(origin, "172.20.") ||
					strings.Contains(origin, "172.21.") ||
					strings.Contains(origin, "172.22.") ||
					strings.Contains(origin, "172.23.") ||
					strings.Contains(origin, "172.24.") ||
					strings.Contains(origin, "172.25.") ||
					strings.Contains(origin, "172.26.") ||
					strings.Contains(origin, "172.27.") ||
					strings.Contains(origin, "172.28.") ||
					strings.Contains(origin, "172.29.") ||
					strings.Contains(origin, "172.30.") ||
					strings.Contains(origin, "172.31.")

				if isLocalOrigin {
					// gorilla/csrf supports skipping the check via UnsafeSkipCheck
					c.SetRequest(csrf.UnsafeSkipCheck(r))
				}
			}

			return csrfHandler(c)
		}
	}

	// MCP SSE Handlers (using net/http compatible wrappers)
	e.GET("/sse", echo.WrapHandler(NetHttpAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value(userIDKey).(string)
		if !ok || userID == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		go GlobalSessionManager.MaintainHeartbeat(r.Context(), userID, mcpServer, true)
		sseServer.SSEHandler().ServeHTTP(w, r)
	}), mcpServer)))
	e.POST("/message", echo.WrapHandler(NetHttpAuthMiddleware(SamplingInterceptorMiddleware(sseServer.MessageHandler()), mcpServer)))

	// Telemetry & Observability
	e.GET("/metrics", echo.WrapHandler(promhttp.Handler()), EchoSessionMiddleware, EchoRequireRole("admin"))
	e.GET("/api/healthz", func(c echo.Context) error {
		if err := dbPool.Ping(c.Request().Context()); err != nil {
			return c.JSON(http.StatusServiceUnavailable, APIResponse{Success: false, Error: "Database unavailable"})
		}
		if err := RedisClient.Ping(c.Request().Context()).Err(); err != nil {
			return c.JSON(http.StatusServiceUnavailable, APIResponse{Success: false, Error: "Redis unavailable"})
		}
		return c.JSON(http.StatusOK, APIResponse{Success: true, Message: "OK"})
	}, IPRateLimitMiddleware)

	// Static files
	e.Static("/static", "static")
	e.Static("/assets", "frontend/dist/assets")

	// Auth API Handlers
	authGroup := e.Group("/api/auth", csrfMiddleware, IPRateLimitMiddleware)
	authGroup.GET("/csrf", apiCSRFHandler)
	authGroup.POST("/signup", apiSignupHandler)
	authGroup.POST("/login", apiLoginHandler)
	authGroup.POST("/logout", apiLogoutHandler)

	// Unified V1 API
	v1 := e.Group("/api/v1")
	v1.POST("/webhooks/inbound/:token", handleInboundWebhook, IPRateLimitMiddleware)
	v1.GET("/public/maintenance", apiGetMaintenanceStatusHandler)

	// Protected API Handlers (v1)
	api := v1.Group("", csrfMiddleware, EchoSessionMiddleware, EchoMaintenanceModeMiddleware, EchoRateLimitMiddleware)
	api.GET("/sessions", apiListSessionsHandler)
	api.DELETE("/sessions/:id", apiRevokeSessionHandler)
	api.GET("/dashboard", apiDashboardHandler)
	api.GET("/dashboard/activities", handleGetRecentActivities)
	api.GET("/system/status", apiSystemStatusHandler)
	api.POST("/rotate-api-key", apiRotateAPIKeyHandler)
	api.GET("/tasks", apiListTasksHandler)
	api.POST("/tasks", apiCreateTaskHandler)
	api.GET("/tasks/export", apiExportTasksHandler)
	api.POST("/tasks/import", apiImportTasksHandler)
	api.POST("/tasks/bulk", apiBulkTasksHandler)
	api.GET("/tasks/:id", apiGetTaskHandler)
	api.POST("/tasks/:id/link", apiLinkTaskHandler)
	api.POST("/tasks/:id/trigger", apiTriggerTaskHandler)
	api.POST("/tasks/:id/pause", apiPauseTaskHandler)
	api.POST("/tasks/:id/resume", apiResumeTaskHandler)
	api.DELETE("/tasks/:id", apiDeleteTaskHandler)
	api.PATCH("/tasks/:id", apiUpdateTaskHandler)
	api.GET("/tasks/:id/versions", apiListTaskVersionsHandler)
	api.GET("/tasks/:id/executions", apiListTaskExecutionsHandler)
	api.GET("/tasks/:id/traces/:execution_id", apiGetExecutionTracesHandler)
	api.POST("/tasks/:id/restore/:version_id", apiRestoreTaskVersionHandler)
	api.POST("/tasks/:id/approve", apiApproveTaskHandler)
	api.POST("/tasks/:id/deny", apiDenyTaskHandler)
	api.POST("/tasks/:id/route", apiManualRouteHandler)
	api.GET("/tasks/:id/analytics/hourly-heatmap", handleGetTaskHourlyHeatmap)
	api.GET("/tasks/:id/lock", apiLockTaskHandler)
	api.POST("/tasks/:id/unlock", apiUnlockTaskHandler)
	api.GET("/search", apiSearchHandler)
	api.GET("/events", apiEventsHandler)
	api.GET("/ws", HandleWebSocket)
	api.GET("/secrets", apiListSecretsHandler)
	api.POST("/secrets", apiUpsertSecretHandler)
	api.DELETE("/secrets/:name", apiDeleteSecretHandler)
	api.GET("/webhooks", apiListWebhooksHandler)
	api.POST("/webhooks", apiCreateWebhookHandler)
	api.DELETE("/webhooks/:id", apiDeleteWebhookHandler)
	api.GET("/webhooks/:id/deliveries", apiWebhookDeliveriesHandler)
	api.POST("/webhooks/:id/test", apiTestWebhookHandler)

	// Additional v1 routes moved from legacy v1 block
	api.GET("/workspaces", handleGetWorkspaces)
	api.POST("/workspaces", handleCreateWorkspace)
	api.PATCH("/workspaces/:id", handleUpdateWorkspace)
	api.DELETE("/workspaces/:id", handleDeleteWorkspace)
	api.GET("/workspaces/:id/members", handleListWorkspaceMembers)
	api.POST("/workspaces/:id/members", handleAddWorkspaceMember)
	api.DELETE("/workspaces/:id/members/:user_id", handleRemoveWorkspaceMember)
	api.GET("/workspaces/:id/env", handleListWorkspaceEnvVars)
	api.POST("/workspaces/:id/env", handleUpsertWorkspaceEnvVar)
	api.DELETE("/workspaces/:id/env/:name", handleDeleteWorkspaceEnvVar)
	api.GET("/workspaces/:id/presence", handleGetWorkspacePresence)
	api.POST("/workspaces/:id/presence", handleWorkspacePresenceHeartbeat)
	api.GET("/templates", handleListPublicTemplates)
	api.GET("/templates/me", handleListUserTemplates)
	api.GET("/templates/trending", handleGetTrendingTemplates)
	api.POST("/templates", handleCreateTemplate)
	api.PATCH("/templates/:id", handleUpdateTemplate)
	api.DELETE("/templates/:id", handleDeleteTemplate)
	api.POST("/templates/:id/increment-uses", handleIncrementTemplateUses)
	api.POST("/blueprints/deploy", apiDeployBlueprintHandler)

	// Phase 8: The Monetization API (Billing)
	api.POST("/billing/create-checkout-session", apiCreateCheckoutSession)

	staff := api.Group("", EchoRequireRole("staff", "admin"))
	staff.GET("/monitor", apiMonitorHandler)

	admin := api.Group("/admin", EchoRequireRole("admin"))
	admin.GET("/users", apiAdminUsersHandler)
	admin.GET("/users/:id/sessions", apiAdminListSessionsHandler)
	admin.DELETE("/users/:id/sessions/:session_id", apiAdminRevokeSessionHandler)
	admin.POST("/users/update", apiAdminUpdateUserHandler)
	admin.GET("/login-history", apiAdminLoginHistoryHandler)
	admin.GET("/audit-logs", apiAdminAuditLogsHandler)
	admin.GET("/usage", apiAdminUsageHandler)
	admin.GET("/presence", handleGetOnlineUsers)
	admin.GET("/insights", handleGetSystemInsights)
	admin.GET("/analytics/trends", handleGetTrends)
	admin.GET("/analytics/hourly-heatmap", handleGetHourlyHeatmap)
	admin.GET("/workers", handleGetWorkers)
	admin.GET("/seo", apiGetSEOHandler)
	admin.POST("/seo", apiUpdateSEOHandler)
	admin.GET("/settings", apiAdminGetSettingsHandler)
	admin.POST("/settings", apiAdminUpdateSettingsHandler)
	admin.POST("/prune", apiAdminPruneNowHandler)
	admin.POST("/workers/prune", apiAdminPruneNowHandler)
	admin.POST("/users/impersonate", apiAdminImpersonateUserHandler)
	admin.POST("/users/stop-impersonate", apiAdminStopImpersonateHandler)
	admin.POST("/users/revoke-sessions", apiAdminRevokeSessionsHandler)
	admin.POST("/users/rollover-key", apiAdminRolloverKeyHandler)
	admin.GET("/invitations", apiAdminListInvitationsHandler)
	admin.POST("/invitations", apiAdminCreateInvitationHandler)
	admin.DELETE("/invitations/:id", apiAdminDeleteInvitationHandler)
	admin.POST("/maintenance", apiAdminToggleMaintenanceHandler)

	e.POST("/webhooks/stripe", apiStripeWebhook)

	// Catch-all handler for React SPA
	e.GET("/*", func(c echo.Context) error {
		path := c.Request().URL.Path
		if path == "/" {
			return c.File("frontend/dist/index.html")
		}

		// Clean the path to prevent traversal
		cleanPath := filepath.Clean(path)
		if strings.Contains(cleanPath, "..") {
			return c.File("frontend/dist/index.html")
		}

		fpath := filepath.Join("frontend/dist", cleanPath)
		if info, err := os.Stat(fpath); err != nil || info.IsDir() {
			return c.File("frontend/dist/index.html")
		}
		return c.File(fpath)
	})

	// 4. Start Background Scheduler & Reaper
	go listenForTaskClaims(ctx, dbUrl)
	go listenForTaskQueued(ctx, dbUrl)
	go runScheduler(ctx)
	go runReaper(ctx)
	go runWorkerHeartbeat(ctx)
	go runMetricsFlusher(ctx)
	go StartStreamConsumer(ctx)
	// Start Background Settings Poller
	syncSettings(ctx)
	// Start background flushers
	go StartTraceFlusher(ctx)
	go StartAuditLogFlusher(ctx)
	go StartLoginHistoryFlusher(ctx)

	// Bootstrap Admin
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail != "" {
		log.Printf("Bootstrapping admin role for: %s", adminEmail)
		err := queries.SetUserRoleByEmail(ctx, db.SetUserRoleByEmailParams{
			Role:  pgtype.Text{String: "admin", Valid: true},
			Email: pgtype.Text{String: adminEmail, Valid: true},
		})
		if err != nil {
			log.Printf("Failed to bootstrap admin: %v", err)
		}
	}

	// 5. Start HTTP Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic recovered in server main loop: %v", r)
			}
		}()
		if err := e.Start(":" + port); err != nil && err != http.ErrServerClosed {
			log.Fatalf("shutting down the server: %v", err)
		}
	}()

	// 6. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	// Gracefully shutdown the Echo server
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	done := make(chan struct{})
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic recovered in shutdown waiter: %v", r)
				close(done)
			}
		}()
		workerWG.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Println("All background tasks completed normally.")
	case <-shutdownCtx.Done():
		log.Println("Timeout waiting for background tasks.")
	}

	log.Printf("Reverting tasks locked by worker %s to active...", workerID)
	err = queries.RevertProcessingTasks(context.Background(), pgtype.Text{String: workerID, Valid: true})
	if err != nil {
		log.Printf("Failed to revert processing tasks: %v", err)
	} else {
		log.Printf("Reverted tasks for worker %s", workerID)
	}

	if dbPool != nil {
		dbPool.Close()
	}
	if RedisClient != nil {
		RedisClient.Close()
	}

	log.Println("Server exited properly")
}

func runMetricsFlusher(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if RedisClient == nil {
				continue
			}
			
			// Scan all worker hashes
			keys, _, err := RedisClient.Scan(ctx, 0, "sys:worker:*", 1000).Result()
			if err != nil {
				log.Printf("Metrics scan error: %v", err)
				continue
			}

			totalLoad := int32(0)
			workerCount := int32(len(keys))
			
			for _, key := range keys {
				val, err := RedisClient.HGet(ctx, key, "task_count").Int()
				if err == nil {
					totalLoad += int32(val)
				}
			}

			if workerCount > 0 {
				query := `INSERT INTO system_metrics (total_workers, total_load, avg_memory_mb, p99_latency_ms) VALUES ($1, $2, $3, $4)`
				_, err = dbPool.Exec(ctx, query, workerCount, totalLoad, 0.0, 0.0)
				if err != nil {
					log.Printf("Failed to persist system metrics: %v", err)
				}
			}
		case <-ctx.Done():
			return
		}
	}
}
