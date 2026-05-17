# Actionfy MCP Server

A high-performance, durable AI workflow orchestration engine powered by the **Model Context Protocol (MCP)**. This system allows you to schedule, chain, and monitor complex AI tasks with distributed reliability, visual debugging, and intelligent agentic routing.

![Advanced Workflow Canvas](https://img.shields.io/badge/Status-Production--Ready-brightgreen)
![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Distributed Tracing](https://img.shields.io/badge/Observability-OpenTelemetry-blue)

---

## 🚀 Key Features

*   **Durable Orchestration**: Native support for Cron, Intervals, and One-off dates with PostgreSQL-backed atomicity (`FOR UPDATE SKIP LOCKED`).
*   **Agentic Workflow Engine**: Chain tasks together with **Decision Nodes** (intelligent LLM-driven branching) and persistent state management (`{{state.VARIABLE}}`).
*   **Human-in-the-Loop**: Built-in safety valves that pause workflows and request manual intervention when the AI is unsure of a routing decision.
*   **Visual Time-Travel Debugger**: An interactive Workflow Canvas (React Flow) that lets you visually "replay" past executions and inspect data piping step-by-step.
*   **Enterprise-Grade Observability**: Full OpenTelemetry and Prometheus integration. Track every execution step with sub-millisecond precision.
*   **Zero-Trust Security**: Hardened CSRF protection, multi-layer RBAC (Admin/Staff/User), and AES-256-GCM encrypted secret vault.
*   **Auto-Maintenance**: Automated "Zombie Worker" pruning to keep your node registry clean and efficient.

---

## 🏗 Architecture

The system is designed for massive horizontal scale:
1.  **API Layer**: High-performance Go (Echo) server handling web traffic and MCP tool calls.
2.  **Orchestrator**: A distributed scheduler that claims tasks via SQL locking and dispatches them via Redis Pub/Sub.
3.  **The Bridge**: A persistent SSE connection that links your remote server to local AI assistants (Claude, Cursor).
4.  **Data Layer**: PostgreSQL for durable state, Redis for low-latency signaling and session management.

---

## 🛠 Tech Stack

*   **Backend**: Go (Echo), PostgreSQL (pgx), Redis (Pub/Sub)
*   **Frontend**: React (Vite), React Flow, Tailwind CSS, Framer Motion
*   **Observability**: OpenTelemetry, Jaeger (Distributed Tracing), Prometheus (Metrics)
*   **Infrastructure**: Docker, Docker Compose, Caddy

---

## 🚦 Quick Start

### 1. Launch with Docker Compose
```bash
docker-compose up --build
```

The system will start:
*   **Dashboard**: [http://localhost:8080](http://localhost:8080)
*   **Jaeger Tracing**: [http://localhost:16686](http://localhost:16686)
*   **Prometheus Metrics**: `http://localhost:8080/metrics`

### 2. Connect your Local LLM
Install the global bridge to link your local AI to the persistent engine:
```bash
npx @gsactions/mcp install --api-key YOUR_NEURAL_KEY
```

---

## 📜 License
Refer to the [LICENSE](LICENSE) file for details.
