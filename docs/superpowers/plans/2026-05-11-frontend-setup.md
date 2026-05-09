# Frontend Project Setup (Vite + Tailwind) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize a React frontend for the schedule-mcp project using Vite, Tailwind CSS, and an Anthropic-inspired "Paper & Ink" theme.

**Architecture:** A standalone React application in the `frontend/` directory, configured with a proxy to the Go backend and styled using Tailwind CSS v4 (@tailwindcss/vite).

**Tech Stack:** React (TypeScript), Vite, Tailwind CSS, Lucide React, Axios, React Router DOM.

---

### Task 1: Initialize Vite Project

**Files:**
- Create: `frontend/`

- [ ] **Step 1: Create Vite project**
Run: `npm create vite@latest frontend -- --template react-ts` inside `schedule-mcp/`
Expected: `frontend/` directory created with React + TypeScript template.

- [ ] **Step 2: Initialize git (if not inherited)**
Vite might initialize a git repo. We want to keep it part of the main repo.
Run: `rm -rf frontend/.git` if it exists.

- [ ] **Step 3: Commit initialization**
Run: `git add frontend && git commit -m "feat: initialize vite frontend project"`

### Task 2: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install base dependencies**
Run: `cd frontend && npm install`

- [ ] **Step 2: Install project dependencies**
Run: `cd frontend && npm install tailwindcss @tailwindcss/vite lucide-react axios react-router-dom`

- [ ] **Step 3: Commit dependencies**
Run: `git add frontend/package.json frontend/package-lock.json && git commit -m "feat: install frontend dependencies"`

### Task 3: Configure Tailwind and Theme

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add Tailwind plugin to Vite**
Modify `frontend/vite.config.ts` to include `@tailwindcss/vite`.

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

- [ ] **Step 2: Setup "Paper & Ink" theme in index.css**
Replace content of `frontend/src/index.css` with Tailwind directives and custom theme variables.

```css
@import "tailwindcss";

@theme {
  --color-paper-50: #fcfcfb;
  --color-paper-100: #f7f7f5;
  --color-ink-900: #1a1a1a;
  --color-ink-800: #2d2d2d;
  --color-accent-orange: #d97706; /* Burnt orange */
}

:root {
  background-color: var(--color-paper-50);
  color: var(--color-ink-900);
}

body {
  @apply antialiased;
}
```

- [ ] **Step 3: Commit theme configuration**
Run: `git add frontend/vite.config.ts frontend/src/index.css && git commit -m "feat: configure tailwind and paper & ink theme"`

### Task 4: Setup API Proxy

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Configure proxy in vite.config.ts**
Update the configuration to proxy `/api` to `http://localhost:8080`.

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 2: Commit proxy configuration**
Run: `git add frontend/vite.config.ts && git commit -m "feat: configure api proxy"`

### Task 5: Verify Setup

**Files:**
- N/A

- [ ] **Step 1: Run test build**
Run: `cd frontend && npm run build`
Expected: Build succeeds without errors.

- [ ] **Step 2: Final commit and cleanup**
Run: `git add . && git commit -m "feat: complete frontend setup" --allow-empty`
