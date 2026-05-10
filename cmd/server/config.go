package main

import (
	"encoding/hex"
	"fmt"
	"net/url"
	"os"
	"strconv"
)

const defaultCSRFKey = "01234567890123456789012345678901"

type runtimeConfig struct {
	Env                 string
	LocalDev            bool
	DatabaseURL         string
	RedisURL            string
	BaseURL             string
	CSRFKey             string
	EncryptionKey       string
	StripeAPIKey        string
	StripeWebhookSecret string
	StripeProPriceID    string
	StoreLLMResponses   bool
	MaxLLMResponseChars int
}

func loadRuntimeConfigFromEnv() (runtimeConfig, error) {
	cfg := runtimeConfig{
		Env:                 os.Getenv("ENV"),
		LocalDev:            os.Getenv("LOCAL_DEV") == "true",
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		RedisURL:            os.Getenv("REDIS_URL"),
		BaseURL:             os.Getenv("BASE_URL"),
		CSRFKey:             os.Getenv("CSRF_KEY"),
		EncryptionKey:       os.Getenv("ENCRYPTION_KEY"),
		StripeAPIKey:        os.Getenv("STRIPE_API_KEY"),
		StripeWebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		StripeProPriceID:    os.Getenv("STRIPE_PRO_PRICE_ID"),
		StoreLLMResponses:   envBool("STORE_LLM_RESPONSES", true),
		MaxLLMResponseChars: envInt("MAX_LLM_RESPONSE_CHARS", 4000),
	}

	if cfg.MaxLLMResponseChars < 256 {
		cfg.MaxLLMResponseChars = 256
	}

	if !cfg.productionMode() {
		return cfg, nil
	}

	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL is required in production")
	}
	if cfg.RedisURL == "" {
		return cfg, fmt.Errorf("REDIS_URL is required in production")
	}
	if cfg.BaseURL == "" {
		return cfg, fmt.Errorf("BASE_URL is required in production")
	}
	baseURL, err := url.Parse(cfg.BaseURL)
	if err != nil || baseURL.Scheme == "" || baseURL.Host == "" {
		return cfg, fmt.Errorf("BASE_URL must be an absolute URL in production")
	}
	if baseURL.Scheme != "https" {
		return cfg, fmt.Errorf("BASE_URL must use https in production")
	}

	if len(cfg.CSRFKey) < 32 || cfg.CSRFKey == defaultCSRFKey {
		return cfg, fmt.Errorf("CSRF_KEY must be at least 32 bytes and must not use the insecure default in production")
	}

	if len(cfg.EncryptionKey) != 64 {
		return cfg, fmt.Errorf("ENCRYPTION_KEY must be a 64-character hex string in production")
	}
	keyBytes, err := hex.DecodeString(cfg.EncryptionKey)
	if err != nil || len(keyBytes) != 32 {
		return cfg, fmt.Errorf("ENCRYPTION_KEY must decode to 32 bytes in production")
	}

	hasAnyStripe := cfg.StripeAPIKey != "" || cfg.StripeWebhookSecret != "" || cfg.StripeProPriceID != ""
	if hasAnyStripe {
		if cfg.StripeAPIKey == "" || cfg.StripeWebhookSecret == "" || cfg.StripeProPriceID == "" {
			return cfg, fmt.Errorf("STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRO_PRICE_ID must all be set together in production")
		}
	}

	return cfg, nil
}

func (c runtimeConfig) productionMode() bool {
	return c.Env == "production" && !c.LocalDev
}

func (c runtimeConfig) secureCookies() bool {
	return c.Env == "production" && !c.LocalDev
}

func (c runtimeConfig) csrfTrustedOrigins() []string {
	origins := []string{"localhost:8080", "127.0.0.1:8080"}
	if c.BaseURL == "" {
		return origins
	}
	parsed, err := url.Parse(c.BaseURL)
	if err != nil || parsed.Host == "" {
		return origins
	}
	for _, origin := range origins {
		if origin == parsed.Host {
			return origins
		}
	}
	return append(origins, parsed.Host)
}

func envBool(name string, fallback bool) bool {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt(name string, fallback int) int {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return parsed
}
