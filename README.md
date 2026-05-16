# Scheduled Actions MCP Server

A high-performance, durable AI workflow orchestration engine powered by the **Model Context Protocol (MCP)**. This system allows you to schedule, chain, and monitor complex AI tasks with distributed reliability and visual debugging.

![Advanced Workflow Canvas](https://img.shields.io/badge/Status-Production--Ready-brightgreen)
![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Distributed Tracing](https://img.shields.io/badge/Observability-OpenTelemetry-blue)

---

## 🚀 Key Features

*   **Durable Orchestration**: Native support for Cron, Intervals, and One-off dates with PostgreSQL-backed atomicity (`FOR UPDATE SKIP LOCKED`).
*   **Agentic Workflow Engine**: Chain tasks together with conditional branching and persistent state management (`{{state.VARIABLE}}`).
*   **Visual Time-Travel Debugger**: An interactive Workflow Canvas (React Flow) that lets you visually "replay" past executions and inspect data piping step-by-step.
*   **Enterprise-Grade Observability**: Full OpenTelemetry integration. Track a task from a Webhook trigger through Redis Pub/Sub to the Worker execution with sub-millisecond precision.
*   **Secure Native Actions**: Isolated JS execution environment (via Goja) for custom logic with strict timeouts and memory limits.
*   **Secret Vault**: Encrypted-at-rest user secrets for secure tool access.

---

## 🛠 Tech Stack

*   **Backend**: Go (Echo), PostgreSQL (pgx), Redis (Pub/Sub)
*   **Frontend**: React (Vite), React Flow, Tailwind CSS, Framer Motion
*   **Observability**: OpenTelemetry, Jaeger (Distributed Tracing), Prometheus (Metrics)
*   **Infrastructure**: Docker, Docker Compose, Caddy

---

## 🚦 Quick Start

### 1. Prerequisites
*   Docker & Docker Compose
*   (Optional) Go 1.25+ & Node.js 20+ for local dev

### 2. Launch with Docker Compose
```bash
docker-compose up --build
```

The system will start:
*   **Dashboard**: [http://localhost:8080](http://localhost:8080)
*   **Jaeger Tracing**: [http://localhost:16686](http://localhost:16686)
*   **Prometheus Metrics**: `http://localhost:8080/metrics`

### 3. First Login
Bootstrap an admin account by setting the `ADMIN_EMAIL` in `docker-compose.yml` and logging in via the dashboard.

---

## 📈 Distributed Tracing

This project uses **OpenTelemetry** to provide full visibility into background task execution. To see your traces:
1.  Perform an action (e.g., trigger a webhook or create a task).
2.  Open the [Jaeger UI](http://localhost:16686).
3.  Filter by service `scheduled-actions` to see the "waterfall" view of how your request moved across the API, Redis, and Worker nodes.

---

## 📜 License
Refer to the [LICENSE](LICENSE) file for details.
