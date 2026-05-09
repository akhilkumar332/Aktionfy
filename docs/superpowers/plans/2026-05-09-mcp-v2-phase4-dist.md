# Phase 4: Distribution & Installation Wrappers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify installation for end-users via NPM and Bash scripts, allowing them to install the MCP client with a single command.

**Architecture:** 
1. **NPM Wrapper:** A Node.js package that detects the OS/Arch, downloads the appropriate Go binary from GitHub Releases, and places it in the user's path or executes it.
2. **Bash Script:** A simple `curl | bash` script for non-NPM users.

**Tech Stack:** Node.js, Shell, GitHub Releases API

---

### Task 1: Create NPM Wrapper Package

**Files:**
- Create: `dist/npm/package.json`
- Create: `dist/npm/index.js`
- Create: `dist/npm/install.js`

- [ ] **Step 1: Scaffolding package.json**

Create a `package.json` that defines the CLI command (e.g., `schedule-mcp`).

- [ ] **Step 2: Implement install script**

The `install.js` will run post-install. It should:
1. Detect platform (linux, darwin, win32).
2. Detect arch (x64, arm64).
3. Download the binary from a placeholder URL (e.g., `https://github.com/user/repo/releases/latest/download/...`).
4. Set execution permissions (`chmod +x`).

- [ ] **Step 3: Implement index.js (Proxy)**

`index.js` should just use `child_process.spawn` to run the downloaded Go binary, passing all arguments through.

### Task 2: Create Bash Installation Script

**Files:**
- Create: `dist/install.sh`

- [ ] **Step 1: Write install.sh**

A robust bash script that:
1. Checks for `curl` or `wget`.
2. Downloads the binary.
3. Moves it to `/usr/local/bin` (with sudo if needed).

### Task 3: Build & Release Automation (Optional/Manual)

- [ ] **Step 1: Document Release Process**

Add a `RELEASING.md` file explaining how to build the Go binaries for all platforms and publish the NPM package.

---

**Final Verification:**
Run: `node dist/npm/install.js` (simulated)
Expected: downloads binary (if reachable).
