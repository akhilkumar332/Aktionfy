package main

import "testing"

func TestLoadRuntimeConfigFromEnv_AllowsMissingSecretsOutsideProduction(t *testing.T) {
	t.Setenv("ENV", "development")
	t.Setenv("LOCAL_DEV", "true")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("REDIS_URL", "")
	t.Setenv("BASE_URL", "")
	t.Setenv("CSRF_KEY", "")
	t.Setenv("ENCRYPTION_KEY", "")

	if _, err := loadRuntimeConfigFromEnv(); err != nil {
		t.Fatalf("expected non-production config to allow missing values, got %v", err)
	}
}

func TestLoadRuntimeConfigFromEnv_RejectsInsecureProductionConfig(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("LOCAL_DEV", "false")
	t.Setenv("DATABASE_URL", "postgres://prod")
	t.Setenv("REDIS_URL", "redis://prod:6379/0")
	t.Setenv("BASE_URL", "https://example.com")
	t.Setenv("CSRF_KEY", defaultCSRFKey)
	t.Setenv("ENCRYPTION_KEY", "")

	if _, err := loadRuntimeConfigFromEnv(); err == nil {
		t.Fatal("expected insecure production config to fail validation")
	}
}

func TestLoadRuntimeConfigFromEnv_AcceptsValidProductionConfig(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("LOCAL_DEV", "false")
	t.Setenv("DATABASE_URL", "postgres://prod")
	t.Setenv("REDIS_URL", "redis://prod:6379/0")
	t.Setenv("BASE_URL", "https://app.example.com")
	t.Setenv("CSRF_KEY", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("ENCRYPTION_KEY", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
	t.Setenv("STRIPE_API_KEY", "")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "")
	t.Setenv("STRIPE_PRO_PRICE_ID", "")

	cfg, err := loadRuntimeConfigFromEnv()
	if err != nil {
		t.Fatalf("expected valid production config to pass, got %v", err)
	}
	if !cfg.productionMode() {
		t.Fatal("expected production mode to be enabled")
	}
}

func TestRuntimeConfigTrustedOriginsIncludesBaseURLHost(t *testing.T) {
	cfg := runtimeConfig{BaseURL: "https://app.example.com"}
	origins := cfg.csrfTrustedOrigins()
	found := false
	for _, origin := range origins {
		if origin == "https://app.example.com" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected trusted origins to include base URL host, got %v", origins)
	}
}

func TestLoadRuntimeConfigFromEnv_RejectsHTTPBaseURLInProduction(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("LOCAL_DEV", "false")
	t.Setenv("DATABASE_URL", "postgres://prod")
	t.Setenv("REDIS_URL", "redis://prod:6379/0")
	t.Setenv("BASE_URL", "http://app.example.com")
	t.Setenv("CSRF_KEY", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("ENCRYPTION_KEY", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")

	if _, err := loadRuntimeConfigFromEnv(); err == nil {
		t.Fatal("expected http BASE_URL to fail in production")
	}
}

func TestLoadRuntimeConfigFromEnv_RejectsPartialStripeConfigInProduction(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("LOCAL_DEV", "false")
	t.Setenv("DATABASE_URL", "postgres://prod")
	t.Setenv("REDIS_URL", "redis://prod:6379/0")
	t.Setenv("BASE_URL", "https://app.example.com")
	t.Setenv("CSRF_KEY", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("ENCRYPTION_KEY", "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
	t.Setenv("STRIPE_API_KEY", "sk_live_x")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "")
	t.Setenv("STRIPE_PRO_PRICE_ID", "")

	if _, err := loadRuntimeConfigFromEnv(); err == nil {
		t.Fatal("expected partial stripe config to fail in production")
	}
}
