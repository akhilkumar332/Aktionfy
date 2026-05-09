# Secret Vault Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the database schema and queries for the Secret Vault feature.

**Architecture:** Create a new `user_secrets` table to store encrypted user secrets as blobs (`BYTEA`). Add CRUD queries for these secrets using `sqlc`.

**Tech Stack:** PostgreSQL, SQL, sqlc (Go)

---

### Task 1: Write SQL Migration

**Files:**
- Create: `migrations/005_v3_secret_vault.sql`
- Modify: `schema.sql`

- [ ] **Step 1: Create migration file**

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

- [ ] **Step 2: Update schema.sql**

Append the `user_secrets` table definition to `schema.sql` so `sqlc` can see it.
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

### Task 2: Update Queries

**Files:**
- Modify: `db/queries.sql`

- [ ] **Step 1: Add queries to db/queries.sql**

Add the following queries to the end of `db/queries.sql`:
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

### Task 3: Generate Go Code

**Files:**
- Modify: `db/queries.sql.go` (via sqlc)
- Modify: `db/models.go` (via sqlc)

- [ ] **Step 1: Run sqlc generate**

Run: `sqlc generate` in the `schedule-mcp` directory.
Expected: `db/queries.sql.go` and `db/models.go` are updated without errors.

### Task 4: Stage Files

**Files:**
- Action: `git add`

- [ ] **Step 1: Stage changes**

Run: `git add db/ migrations/ schema.sql`
Expected: Files are staged for commit.
**CRITICAL:** DO NOT COMMIT.
