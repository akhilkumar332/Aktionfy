# Functional Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Signup, Login, and Dashboard views with corresponding handlers in Go.

**Architecture:** Use Go's `html/template` for rendering. Handlers will manage sessions via cookies and interact with PostgreSQL for user data.

**Tech Stack:** Go (net/http, html/template), PostgreSQL, Redis (for session management if applicable, but currently using DB-backed sessions for web), CSS (Vanilla).

---

### Task 1: Update Layout Template

**Files:**
- Modify: `schedule-mcp/templates/layout.html`

- [ ] **Step 1: Update layout.html to handle optional User context**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{block "title" .}}Schedule MCP{{end}}</title>
    <link rel="stylesheet" href="/static/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="app-container">
        {{if .User}}
        <aside class="sidebar">
            <div class="sidebar-logo">
                <i class="fas fa-clock"></i>
                <span>Schedule MCP</span>
            </div>
            
            <nav class="nav-group">
                <a href="/dashboard" class="nav-item {{if eq .CurrentPage "dashboard"}}active{{end}}">
                    <i class="fas fa-chart-line"></i>
                    <span>Dashboard</span>
                </a>
                <a href="/tasks" class="nav-item {{if eq .CurrentPage "tasks"}}active{{end}}">
                    <i class="fas fa-tasks"></i>
                    <span>My Tasks</span>
                </a>
                <a href="/api-key" class="nav-item {{if eq .CurrentPage "api-key"}}active{{end}}">
                    <i class="fas fa-key"></i>
                    <span>API Key</span>
                </a>

                {{if or (eq .User.Role "staff") (eq .User.Role "admin")}}
                <a href="/monitor" class="nav-item {{if eq .CurrentPage "monitor"}}active{{end}}">
                    <i class="fas fa-desktop"></i>
                    <span>System Monitor</span>
                </a>
                {{end}}

                {{if eq .User.Role "admin"}}
                <a href="/users" class="nav-item {{if eq .CurrentPage "users"}}active{{end}}">
                    <i class="fas fa-users-cog"></i>
                    <span>User Management</span>
                </a>
                {{end}}
            </nav>

            <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <div class="text-muted" style="font-size: 0.875rem;">
                    Logged in as:<br>
                    <strong style="color: var(--text-primary);">{{.User.Email}}</strong>
                </div>
                <a href="/logout" class="nav-item mt-4" style="padding: 0.5rem 0;">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </a>
            </div>
        </aside>
        {{end}}

        <main class="main-content">
            {{if .Error}}
            <div class="alert alert-error" style="background-color: #fee2e2; color: #b91c1c; padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem; border: 1px solid #fecaca;">
                {{.Error}}
            </div>
            {{end}}
            {{if .Message}}
            <div class="alert alert-success" style="background-color: #dcfce7; color: #15803d; padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem; border: 1px solid #bbf7d0;">
                {{.Message}}
            </div>
            {{end}}
            {{block "content" .}}
            <!-- Page content goes here -->
            {{end}}
        </main>
    </div>
</body>
</html>
```

### Task 2: Implement Signup and Login Templates

**Files:**
- Create: `schedule-mcp/templates/signup.html`
- Create: `schedule-mcp/templates/login.html`
- Modify: `schedule-mcp/static/style.css`

- [ ] **Step 1: Add form styles to style.css**

```css
/* Forms */
.auth-container {
    max-width: 400px;
    margin: 4rem auto;
    padding: 2rem;
    background: var(--card-bg);
    border-radius: 1rem;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-family: inherit;
    font-size: 1rem;
}

.form-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-soft);
}

.btn {
    display: inline-block;
    width: 100%;
    padding: 0.75rem;
    background-color: var(--accent-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    transition: background-color 0.2s;
}

.btn:hover {
    background-color: #b45309;
}

.auth-footer {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.875rem;
}

.auth-footer a {
    color: var(--accent-primary);
    text-decoration: none;
    font-weight: 500;
}
```

- [ ] **Step 2: Create signup.html**

```html
{{template "layout.html" .}}

{{define "title"}}Sign Up - Schedule MCP{{end}}

{{define "content"}}
<div class="auth-container">
    <h1 class="mb-4">Create an account</h1>
    <form action="/signup" method="POST">
        <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" class="form-input" required autofocus>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-input" required minlength="8">
        </div>
        <button type="submit" class="btn">Sign Up</button>
    </form>
    <div class="auth-footer">
        Already have an account? <a href="/login">Log in</a>
    </div>
</div>
{{end}}
```

- [ ] **Step 3: Create login.html**

```html
{{template "layout.html" .}}

{{define "title"}}Log In - Schedule MCP{{end}}

{{define "content"}}
<div class="auth-container">
    <h1 class="mb-4">Log in</h1>
    <form action="/login" method="POST">
        <div class="form-group">
            <label for="email">Email Address</label>
            <input type="email" id="email" name="email" class="form-input" required autofocus>
        </div>
        <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" class="form-input" required>
        </div>
        <button type="submit" class="btn">Log In</button>
    </form>
    <div class="auth-footer">
        Don't have an account? <a href="/signup">Sign up</a>
    </div>
</div>
{{end}}
```

### Task 3: Implement Bento Dashboard Template

**Files:**
- Create: `schedule-mcp/templates/dashboard.html`

- [ ] **Step 1: Create dashboard.html**

```html
{{template "layout.html" .}}

{{define "title"}}Dashboard - Schedule MCP{{end}}

{{define "content"}}
<header class="mb-4">
    <h1>Welcome back, {{.User.Email}}</h1>
    <p class="text-muted">Here's an overview of your scheduled tasks and account status.</p>
</header>

<div class="bento-grid">
    <div class="bento-card">
        <h3 class="mb-4"><i class="fas fa-crown mr-2" style="color: #f59e0b;"></i> Current Tier</h3>
        <div style="font-size: 2rem; font-weight: 700; text-transform: uppercase; color: var(--accent-primary);">
            {{.User.Tier}}
        </div>
        <p class="mt-4 text-muted">
            {{if eq .User.Tier "free"}}
            Limited to 5 active tasks.
            <a href="/upgrade" style="color: var(--accent-primary); font-weight: 600;">Upgrade to Pro</a>
            {{else if eq .User.Tier "pro"}}
            Up to 50 active tasks.
            {{else}}
            Unlimited active tasks.
            {{end}}
        </p>
    </div>

    <div class="bento-card">
        <h3 class="mb-4"><i class="fas fa-tasks mr-2" style="color: #3b82f6;"></i> Total Tasks</h3>
        <div style="font-size: 2rem; font-weight: 700;">
            {{.TaskCount}}
        </div>
        <p class="mt-4 text-muted">
            <a href="/tasks" style="color: var(--accent-primary); font-weight: 600;">Manage all tasks</a>
        </p>
    </div>

    <div class="bento-card" style="grid-column: span 2;">
        <h3 class="mb-4"><i class="fas fa-key mr-2" style="color: #10b981;"></i> API Key</h3>
        <div class="terminal-view" style="display: flex; align-items: center; justify-content: space-between;">
            <code id="api-key">{{.User.APIKey}}</code>
            <button onclick="copyApiKey()" class="btn" style="width: auto; padding: 0.25rem 0.75rem; font-size: 0.875rem;">Copy</button>
        </div>
        <div class="mt-4">
            <form action="/rotate-api-key" method="POST" onsubmit="return confirm('Are you sure you want to rotate your API key? Old key will stop working immediately.');">
                <button type="submit" class="btn" style="background-color: #ef4444;">Rotate API Key</button>
            </form>
        </div>
    </div>
</div>

<script>
function copyApiKey() {
    const apiKey = document.getElementById('api-key').innerText;
    navigator.clipboard.writeText(apiKey).then(() => {
        alert('API Key copied to clipboard');
    });
}
</script>
{{end}}
```

### Task 4: Wire up handlers in main.go

**Files:**
- Modify: `schedule-mcp/cmd/server/main.go`

- [ ] **Step 1: Add template rendering helper and handlers**

- [ ] **Step 2: Update mux with new routes**

---
