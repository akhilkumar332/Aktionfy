# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

## Security Architecture

Aktionfy implements a **Multi-Layer Defense** strategy:

### 1. Data Integrity & Privacy
*   **Zero-Key Architecture**: Aktionfy **does not store** your AI provider API keys (OpenAI, Anthropic, etc.). AI execution is delegated to your local machine via the MCP Sampling protocol.
*   **Encrypted Local Secrets**: If you choose to store non-AI secrets (e.g., database passwords) for native actions, they are encrypted with **AES-256-GCM** using your master `ENCRYPTION_KEY`.
*   **In-Memory Resolution**: Decryption and prompt resolution occur strictly in-memory during the sub-millisecond dispatch window.

### 2. Authentication & Access Control
*   **Database-Backed Sessions**: Allows for immediate global session revocation.
*   **Granular RBAC**: Strict Role-Based Access Control (Admin/Staff/User) enforced at the middleware layer.
*   **Self-Demotion Block**: Admins are restricted from removing their own privileges to prevent system lockouts.

### 3. Network & API Security
*   **Hardened CSRF**: Strict origin validation and double-submit token enforcement on all mutation endpoints.
*   **Quota Enforcement**: Centralized quota logic ensures API users cannot bypass tier-based task limits.
*   **SSE Isolation**: Every persistent bridge connection is cryptographically linked to a user session.

### 4. Secure Execution
*   **Native Sandboxing**: Custom JS actions run in an isolated environment (Goja) with strict CPU timeouts and memory caps.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please **do not open a public issue**. Instead, follow the process below:

1.  **Draft a Report**: Include a detailed description of the vulnerability, steps to reproduce, and potential impact.
2.  **Submit Privately**: Send your report via email to `akhilkumar332@gmail.com`.
3.  **Wait for Response**: We will acknowledge your report within 48 hours and provide a timeline for a fix.

Thank you for helping keep the future of AI orchestration secure.
