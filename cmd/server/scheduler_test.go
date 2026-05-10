package main

import (
	"testing"
	"time"
)

func TestCalculateNextRun(t *testing.T) {
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)

	// Example 1: every hour at minute 30
	cronExpr := "30 * * * *"

	next, err := calculateNextRun("cron", map[string]interface{}{"cron": cronExpr}, now)
	if err != nil {
		t.Fatalf("Failed to calculate next run: %v", err)
	}

	expected := time.Date(2026, 5, 8, 12, 30, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("Expected %v, got %v", expected, next)
	}

	// Example 2: intervals (5 minutes)
	next, err = calculateNextRun("interval", map[string]interface{}{"minutes": float64(5)}, now)
	if err != nil {
		t.Fatalf("Failed to calculate next run: %v", err)
	}
	expected = time.Date(2026, 5, 8, 12, 5, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("Expected %v, got %v", expected, next)
	}
}

func TestCalculateNextRunWithTimezone(t *testing.T) {
	now := time.Date(2026, 5, 8, 6, 0, 0, 0, time.UTC)
	next, err := calculateNextRun("cron", map[string]interface{}{
		"cron":     "0 9 * * *",
		"timezone": "America/New_York",
	}, now)
	if err != nil {
		t.Fatalf("Failed to calculate timezone-aware next run: %v", err)
	}

	expected := time.Date(2026, 5, 8, 13, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("Expected %v, got %v", expected, next)
	}
}

func TestCalculateNextRunDate(t *testing.T) {
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	next, err := calculateNextRun("date", map[string]interface{}{
		"date": "2026-05-09T15:04:05Z",
	}, now)
	if err != nil {
		t.Fatalf("Failed to calculate date next run: %v", err)
	}

	expected := time.Date(2026, 5, 9, 15, 4, 5, 0, time.UTC)
	if !next.Equal(expected) {
		t.Fatalf("Expected %v, got %v", expected, next)
	}
}

func TestCalculateNextRunRejectsUnknownTrigger(t *testing.T) {
	now := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	if _, err := calculateNextRun("weekly", map[string]interface{}{}, now); err == nil {
		t.Fatal("expected unknown trigger type to fail")
	}
}
