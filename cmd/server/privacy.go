package main

import (
	"regexp"
)

var (
	bearerTokenPattern = regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9._\-]+`)
	openAIKeyPattern   = regexp.MustCompile(`sk-[A-Za-z0-9]{10,}`)
	hexTokenPattern    = regexp.MustCompile(`\b[0-9a-fA-F]{32,}\b`)
	apiKeyPattern      = regexp.MustCompile(`(?i)(api[_ -]?key["=: ]+)([A-Za-z0-9_\-]{8,})`)
)

func sanitizeLLMResponseForStorage(raw string) string {
	if !appConfig.StoreLLMResponses {
		return "[omitted_by_policy]"
	}
	sanitized := bearerTokenPattern.ReplaceAllString(raw, "Bearer [REDACTED]")
	sanitized = openAIKeyPattern.ReplaceAllString(sanitized, "[REDACTED_OPENAI_KEY]")
	sanitized = hexTokenPattern.ReplaceAllString(sanitized, "[REDACTED_HEX_TOKEN]")
	sanitized = apiKeyPattern.ReplaceAllString(sanitized, "${1}[REDACTED]")

	maxChars := appConfig.MaxLLMResponseChars
	if maxChars <= 0 {
		maxChars = 4000
	}
	if len(sanitized) > maxChars {
		return sanitized[:maxChars] + "...[truncated]"
	}
	return sanitized
}
