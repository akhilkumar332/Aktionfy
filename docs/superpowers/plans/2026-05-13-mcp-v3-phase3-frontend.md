# V3 Phase 3: Vault UI & Chaining Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a user-friendly interface for managing secrets and viewing task chaining relationships.

**Architecture:** 
1. **Vault Page:** A new React page for CRUD operations on secrets.
2. **Dashboard Updates:** Visual indicators for chained tasks and status of secret injection.

**Tech Stack:** React, Tailwind CSS (Vanilla CSS in this project), Lucide React, Axios

---

### Task 1: Create Vault Management Page

**Files:**
- Create: `frontend/src/pages/Vault.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/DashboardLayout.jsx`

- [ ] **Step 1: Scaffolding Vault.jsx**

Create a page that lists secrets in a clean table with a "Delete" button. Add a modal/form to create a new secret.

- [ ] **Step 2: Register route in App.jsx**

Add the route `/vault` pointing to the new page.

- [ ] **Step 3: Update DashboardLayout.jsx Sidebar**

Add a "Vault" link with a key icon to the main navigation.

### Task 2: Update Dashboard with Chaining Visibility

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add chaining indicators**

When listing tasks (if we add a task list component), show a "Link" icon if a task `depends_on` another.

- [ ] **Step 2: Display Secret Usage**

In the task log/monitor view, show if a task used secrets (e.g., "3 secrets injected").

### Task 3: Build & Final Verification

- [ ] **Step 1: Build Frontend**

Run: `npm run build`
Expected: builds successfully.

- [ ] **Step 2: Final Commit (END OF PHASE 3)**

Run: `git add . && git commit -m "feat(v3): implementation phase 3 - vault UI and dashboard enhancements"`
