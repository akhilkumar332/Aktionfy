# Management Portal & RBAC Design Spec

**Goal**: Implement a unified web-based management portal for `schedule-mcp` that supports Role-Based Access Control (RBAC) for Users, Staff, and Admins. This includes a public sign-up page, a secure login flow, and tailored dashboards using modern MCP industry visual standards.

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

## 4. Visual Standards & UI Architecture
### The "Anthropic & MCP" Aesthetic
- **Color Palette**: "Paper & Ink" approach.
  - Background: Off-white (`#faf9f5`).
  - Primary Text: Deep Charcoal (`#141413`).
  - Accents: Muted Burnt Orange (`#d97706`) and soft amber.
  - Dark Mode: "Terminal" theme using high-contrast deep greys and greens for logs.
- **Typography**:
  - Headers: **Poppins** (Geometric Sans-Serif) for a modern, clean look.
  - Body: **Lora** (Serif) or Inter (Sans-Serif) for readability and sophistication.
  - Code/Logs: **JetBrains Mono** or standard monospace.
- **Layout**: **Bento Grid** dashboard for statistics and status cards.
- **Tech**: Go `html/template` with Vanilla CSS (Modularized).

### Unified UI Structure
- **Unified Sidebar**: A glassmorphism-style translucent sidebar.
  - **Always Visible**: My Dashboard, My Tasks, API Key Management.
  - **Staff+ Section**: System Monitor (Global Task Logs).
  - **Admin Section**: User Management, Tier Configuration.

## 5. Functional Requirements
### User Views
- **Dashboard**: Bento grid showing active tasks, current tier, and API usage stats.
- **API Management**: View and rotate the `api_key`.
- **Sign Up / Login**: Modern forms with clear validation and "Paper & Ink" styling.

### Staff Views
- **Global Monitor**: A terminal-style list of all recent `task_logs` across the system.
- **Search/Filter**: Real-time filtering by `user_id`, `status`, or `task_id`.

### Admin Views
- **User Management**: Comprehensive table of all users with search. Action menu to promote/demote roles or change tiers.
- **Global Config**: Adjust `QuotaFree`, `QuotaPlus`, and `QuotaPro` values.

## 6. Implementation Strategy
1. **Schema Migration**: Update `users` and create `web_sessions`.
2. **Auth Layer**: Implement `bcrypt` hashing, `/signup`, `/login`, and `SessionMiddleware`.
3. **Core Dashboard**: Implement the base layout with the Bento grid and sidebar.
4. **Staff/Admin Views**: Build out the monitoring and user management tables.
5. **RBAC Wiring**: Finalize security wrappers for all routes.
