package main

import (
	"time"

	"github.com/labstack/echo/v4"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aktionfy_http_requests_total",
			Help: "Total HTTP requests handled by the application.",
		},
		[]string{"method", "route", "status"},
	)
	schedulerClaimsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "aktionfy_scheduler_claims_total",
			Help: "Total number of task claims returned by the scheduler.",
		},
	)
	schedulerClaimErrorsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "aktionfy_scheduler_claim_errors_total",
			Help: "Total number of scheduler claim errors.",
		},
	)
	taskOutcomeTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "aktionfy_task_outcomes_total",
			Help: "Total task outcomes emitted by the scheduler or execution node.",
		},
		[]string{"outcome"},
	)
	activeSSEConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "aktionfy_active_sse_connections",
			Help: "Current number of active SSE connections.",
		},
	)
	taskExecutionDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "aktionfy_task_execution_duration_seconds",
			Help:    "Observed task execution durations.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"result"},
	)
)

func init() {
	prometheus.MustRegister(
		httpRequestsTotal,
		schedulerClaimsTotal,
		schedulerClaimErrorsTotal,
		taskOutcomeTotal,
		activeSSEConnections,
		taskExecutionDurationSeconds,
	)
}

func observeTaskOutcome(outcome string) {
	taskOutcomeTotal.WithLabelValues(outcome).Inc()
}

func observeTaskExecutionDuration(start time.Time, result string) {
	taskExecutionDurationSeconds.WithLabelValues(result).Observe(time.Since(start).Seconds())
}

func prometheusMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		err := next(c)
		route := c.Path()
		if route == "" {
			route = "unmatched"
		}
		status := c.Response().Status
		if status == 0 {
			status = 200
		}
		httpRequestsTotal.WithLabelValues(c.Request().Method, route, httpStatusLabel(status)).Inc()
		return err
	}
}

func httpStatusLabel(status int) string {
	switch {
	case status >= 500:
		return "5xx"
	case status >= 400:
		return "4xx"
	case status >= 300:
		return "3xx"
	case status >= 200:
		return "2xx"
	default:
		return "other"
	}
}
