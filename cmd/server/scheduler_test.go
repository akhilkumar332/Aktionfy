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

func TestExtractRawText(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected string
	}{
		{
			name: "Single content object",
			input: map[string]interface{}{
				"content": map[string]interface{}{
					"type": "text",
					"text": "hello world",
				},
			},
			expected: "hello world",
		},
		{
			name: "Slice of content objects",
			input: map[string]interface{}{
				"content": []interface{}{
					map[string]interface{}{
						"type": "text",
						"text": "part 1",
					},
					map[string]interface{}{
						"type": "text",
						"text": "part 2",
					},
				},
			},
			expected: "part 1",
		},
		{
			name: "Nested result with slice",
			input: map[string]interface{}{
				"result": map[string]interface{}{
					"content": []interface{}{
						map[string]interface{}{
							"type": "text",
							"text": "nested hello",
						},
					},
				},
			},
			expected: "nested hello",
		},
		{
			name:     "Nil input",
			input:    nil,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractRawText(tt.input)
			if got != tt.expected {
				t.Errorf("extractRawText() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestParseLLMChoice(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected string
	}{
		{
			name: "Direct JSON",
			input: map[string]interface{}{
				"content": map[string]interface{}{
					"text": `{"choice": "branch_a", "reasoning": "test"}`,
				},
			},
			expected: "branch_a",
		},
		{
			name: "Markdown wrapped JSON",
			input: map[string]interface{}{
				"content": []interface{}{
					map[string]interface{}{
						"text": "The choice is:\n```json\n{\"choice\": \"branch_b\"}\n```",
					},
				},
			},
			expected: "branch_b",
		},
		{
			name: "Invalid JSON",
			input: map[string]interface{}{
				"content": map[string]interface{}{
					"text": "Just some random text without choice",
				},
			},
			expected: "",
		},
		{
			name:     "Nil input",
			input:    nil,
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseLLMChoice(tt.input)
			if got != tt.expected {
				t.Errorf("parseLLMChoice() = %v, want %v", got, tt.expected)
			}
		})
	}
}
