# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

## Security Features

The platform implements multi-layer defense-in-depth:
*   **Zero-Trust Vault**: All user secrets (API keys, etc.) are encrypted with AES-256-GCM using a dedicated master key.
*   **Identity Isolation**: Database-backed sessions allow for instant revocation.
*   **CSRF Hardening**: Strict origin validation and double-submit tokens on all mutation endpoints.
*   **Granular RBAC**: Strict role-based access control (Admin/Staff/User) enforced at the middleware layer.
*   **Secure Execution**: Isolated JS execution environment for native actions with strict memory and timeout constraints.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please **do not open a public issue**. Instead, follow the process below:

1.  **Draft a Report**: Include a detailed description of the vulnerability, steps to reproduce, and potential impact.
2.  **Submit Privately**: Send your report via email to `akhilkumar332@gmail.com`.
3.  **Wait for Response**: We will acknowledge your report within 48 hours and provide a timeline for a fix.

Thank you for helping keep our users' data and AI tasks secure.
