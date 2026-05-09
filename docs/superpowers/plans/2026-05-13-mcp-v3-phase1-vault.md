# V3 Phase 1: Secret Vault & Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the underlying database and backend logic for the Global Secret Vault, allowing users to securely store and manage API keys.

**Architecture:** Create a `user_secrets` table. Extend the backend to support encrypted CRUD operations for secrets, and expose them via new MCP tools.

**Tech Stack:** Go, PostgreSQL, AES-256-GCM, sqlc

---

### Task 1: Database Schema for Secret Vault

**Files:**
- Modify: `schema.sql`
- Modify: `db/queries.sql`
- Create: `migrations/005_v3_secret_vault.sql`

- [ ] **Step 1: Write SQL Migration**

Create `migrations/005_v3_secret_vault.sql`:
```sql
CREATE TABLE user_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    encrypted_value BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);
```

- [ ] **Step 2: Update Queries**

In `db/queries.sql`, add:
```sql
-- name: UpsertUserSecret :one
INSERT INTO user_secrets (user_id, name, encrypted_value)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, name) DO UPDATE SET encrypted_value = $3
RETURNING id;

-- name: GetUserSecret :one
SELECT encrypted_value FROM user_secrets WHERE user_id = $1 AND name = $2;

-- name: ListUserSecrets :many
SELECT id, name, created_at FROM user_secrets WHERE user_id = $1 ORDER BY name ASC;

-- name: DeleteUserSecret :exec
DELETE FROM user_secrets WHERE user_id = $1 AND name = $2;
```

- [ ] **Step 3: Run sqlc**

Run: `sqlc generate`

- [ ] **Step 4: Stage Files (DO NOT COMMIT)**

### Task 2: Secret Management Tools

**Files:**
- Modify: `cmd/server/tools.go`

- [ ] **Step 1: Add store_secret tool**

Implement a new tool `store_secret(name, value)` that encrypts the value using `crypto.Encrypt` and calls `UpsertUserSecret`.

- [ ] **Step 2: Add list_secrets tool**

Implement `list_secrets()` that returns a formatted Markdown table of secret names (but not values!).

- [ ] **Step 3: Add delete_secret tool**

Implement `delete_secret(name)`.

- [ ] **Step 4: Build and Verify**

Run: `go build ./cmd/server`
Expected: builds successfully.

- [ ] **Step 5: Stage Files (DO NOT COMMIT)**

### Task 3: API Handlers for Frontend Vault

**Files:**
- Modify: `cmd/server/api_handlers.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Implement API handlers**

Add `apiListSecretsHandler` and `apiDeleteSecretHandler` in `api_handlers.go`. (Creation of secrets will mainly happen via the MCP tool or a separate POST endpoint).

- [ ] **Step 2: Register routes in main.go**

```go
api.GET("/secrets", apiListSecretsHandler)
api.DELETE("/secrets/:name", apiDeleteSecretHandler)
```

- [ ] **Step 3: Build and Verify**

Run: `go build ./cmd/server`
Expected: builds successfully.

- [ ] **Step 4: Final Verification and Commit (END OF PHASE 1)**

Run: `git add . && git commit -m "feat(v3): implementation phase 1 - global secret vault foundation"`
