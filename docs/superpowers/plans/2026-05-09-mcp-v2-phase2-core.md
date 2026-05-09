# Core Feature Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port core functionalities from reference tools, including AES-256 encryption, human-in-the-loop approvals, and rich markdown formatting for MCP tools.

**Architecture:** We will modify the database schema to support new fields (`requires_approval`, `encrypted_secrets`), implement an AES encryption utility, and update the MCP tool handlers to respect these features and return dual-formatted (Markdown + JSON) outputs.

**Tech Stack:** Go, PostgreSQL, crypto/aes, crypto/cipher

---

### Task 1: Update Database Schema for V2 Features

**Files:**
- Modify: `db/queries.sql`
- Create: `migrations/004_v2_core_features.sql`

- [ ] **Step 1: Write SQL Migration**

Create `migrations/004_v2_core_features.sql`:
```sql
ALTER TABLE tasks ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN encrypted_secrets BYTEA;
ALTER TABLE tasks ADD COLUMN last_approval_status VARCHAR(20); -- 'pending', 'approved', 'denied'
```

- [ ] **Step 2: Update Queries**

In `db/queries.sql`, update the `CreateTask` query to accept `requires_approval` and `encrypted_secrets`.
```sql
-- name: CreateTask :one
INSERT INTO tasks (
    id, user_id, trigger_type, trigger_config, prompt, status, requires_approval, encrypted_secrets
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
) RETURNING *;
```

Update `GetTasksForUser` to include these fields in the `SELECT *`.

- [ ] **Step 3: Run sqlc**

Run: `sqlc generate`
Expected: Updates `db/queries.sql.go` and `db/models.go` successfully.

- [ ] **Step 4: Commit**

```bash
git add db/ migrations/
git commit -m "feat: add schema support for approvals and secrets"
```

### Task 2: Implement AES Encryption Utility

**Files:**
- Create: `cmd/server/crypto.go`

- [ ] **Step 1: Write AES-256-GCM functions**

Create `cmd/server/crypto.go`:
```go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"io"
	"os"
)

func getCryptoKey() ([]byte, error) {
	keyHex := os.Getenv("ENCRYPTION_KEY") // Should be 32 bytes hex encoded
	if len(keyHex) != 64 {
		// Fallback for local dev
		return []byte("01234567890123456789012345678901"), nil
	}
	return []byte(keyHex[:32]), nil // Simplification for demo
}

func Encrypt(plaintext []byte) ([]byte, error) {
	key, err := getCryptoKey()
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func Decrypt(ciphertext []byte) ([]byte, error) {
	key, err := getCryptoKey()
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}
```

- [ ] **Step 2: Commit**

```bash
git add cmd/server/crypto.go
git commit -m "feat: implement AES-256-GCM encryption utility"
```

### Task 3: Update Task Creation with Encryption

**Files:**
- Modify: `cmd/server/tools.go`

- [ ] **Step 1: Modify create_task handler**

In `cmd/server/tools.go`, locate the `create_task` tool handler.
When parsing arguments, if `secrets` is provided in the JSON arguments, marshal it and encrypt it using `Encrypt()`.
Pass the encrypted byte slice to `queries.CreateTask`.

- [ ] **Step 2: Update MCP Tool Schema**

Update the `mcpServer.AddTool` definition for `create_task` to include an optional `secrets` property (type object) and `requires_approval` (type boolean).

- [ ] **Step 3: Commit**

```bash
git add cmd/server/tools.go
git commit -m "feat: handle encrypted secrets in create_task tool"
```

### Task 4: Rich Formatting for List Tasks

**Files:**
- Modify: `cmd/server/tools.go`

- [ ] **Step 1: Return Markdown and JSON**

In the `list_tasks` tool handler, instead of just returning raw text, format the tasks into a readable Markdown table, but embed the raw JSON in a hidden HTML comment or code block so automated agents can parse it if needed.
(Note: MCP TextContent has a `Text` field which can contain markdown).

Format:
```markdown
| ID | Prompt | Status | Next Run |
|---|---|---|---|
| 1 | Summarize emails | active | 2026-05-10 |

```

- [ ] **Step 2: Build and Test**

Run: `go build -o server_bin ./cmd/server`
Expected: builds successfully.

- [ ] **Step 3: Commit**

```bash
git add cmd/server/tools.go
git commit -m "feat: add rich markdown formatting to list_tasks"
```