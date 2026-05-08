# Management Portal & RBAC Design Spec

**Goal**: Implement a unified web-based management portal for `schedule-mcp` that supports Role-Based Access Control (RBAC) for Users, Staff, and Admins. This includes a public sign-up page, a secure login flow, and tailored dashboards.

## 1. Authentication & Security
- **Identity**: Email and Password.
- **Sign Up**: Publicly accessible `/signup` page. New users default to the `user` role and `free` tier.
- **Password Security**: Use `bcrypt` (cost 12+) for hashing before storage.
- **Session Management**:
  - Database-backed sessions stored in a `web_sessions` table.
  - Session IDs (UUIDs) stored in HttpOnly, Secure, SameSite=Lax cookies.
  - Middleware to validate sessions and inject `user_id` and `role` into the request context.

## 2. Data Model Changes
### Table: `users` (Extensions)
- `password_hash`: TEXT (NULL for existing API-only users until they set one).
- `role`: TEXT (Default: 'user', Options: 'user', 'staff', 'admin').
- `created_at`: TIMESTAMP DEFAULT NOW().

### Table: `web_sessions` (New)
- `id`: UUID PRIMARY KEY (gen_random_uuid()).
- `user_id`: UUID REFERENCES users(id).
- `expires_at`: TIMESTAMP NOT NULL.

## 3. RBAC Enforcement (Middleware)
- **`SessionMiddleware`**: Checks the `session_id` cookie, verifies against DB, and hydrates context with User info.
- **`RequireRole(roles ...string)`**: A wrapper middleware that ensures the current user has at least one of the required roles.
  - `/dashboard`: Requires `user`, `staff`, or `admin`.
  - `/admin/users`: Requires `admin`.
  - `/monitor`: Requires `staff` or `admin`.

## 4. Unified UI Architecture
- **Tech**: Go `html/template` with Vanilla CSS.
- **Unified Sidebar**:
  - **Always Visible**: My Dashboard, My Tasks, API Key Management.
  - **Staff+ Section**: System Monitor (Global Task Logs).
  - **Admin Section**: User Management, Tier Configuration.

## 5. Functional Requirements
### User Views
- **Dashboard**: View active tasks, current tier, and API key.
- **API Management**: Button to rotate (regenerate) the `api_key`.
- **Sign Up / Login**: Standard forms with validation and error messaging.

### Staff Views
- **Global Monitor**: A list of all recent `task_logs` across all users.
- **Search/Filter**: Filter logs by `user_id` or `status` (failure/success).

### Admin Views
- **User Management**: Table of all users. Capability to change a user's `role` or `tier`.
- **Global Config**: Interface to update `QuotaFree`, `QuotaPlus`, and `QuotaPro` values in the DB (requires a new `config` table or environment variable sync).

## 6. Implementation Strategy
1. **Schema Migration**: Update `users` and create `web_sessions`.
2. **Auth Layer**: Implement `bcrypt` hashing, `/signup`, `/login`, and `SessionMiddleware`.
3. **Core Dashboard**: Convert existing `/dashboard` stub into a functional user portal.
4. **Staff/Admin Views**: Build out the monitoring and user management tables.
5. **RBAC Wiring**: Apply `RequireRole` to the new routes.
