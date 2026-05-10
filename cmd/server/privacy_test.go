package main

import (
	"strings"
	"testing"
)

func TestSanitizeLLMResponseForStorage_OmitsWhenDisabled(t *testing.T) {
	appConfig = runtimeConfig{StoreLLMResponses: false}
	got := sanitizeLLMResponseForStorage("secret output")
	if got != "[omitted_by_policy]" {
		t.Fatalf("expected omission marker, got %q", got)
	}
}

func TestSanitizeLLMResponseForStorage_RedactsAndTruncates(t *testing.T) {
	appConfig = runtimeConfig{StoreLLMResponses: true, MaxLLMResponseChars: 32}
	got := sanitizeLLMResponseForStorage("Bearer abcdefghijklmnopqrstuvwxyz sk-1234567890abcdef API_KEY=ABCDEF1234567890")
	if strings.Contains(got, "sk-1234567890abcdef") || strings.Contains(got, "Bearer abcdef") {
		t.Fatalf("expected secrets to be redacted, got %q", got)
	}
	if !strings.Contains(got, "[truncated]") {
		t.Fatalf("expected truncation marker, got %q", got)
	}
}
