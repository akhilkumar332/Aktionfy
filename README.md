# Aktionfy MCP Server

A high-performance, durable AI workflow orchestration engine powered by the **Model Context Protocol (MCP)**. This system allows you to schedule, chain, and monitor complex AI tasks with distributed reliability, visual debugging, and intelligent agentic routing.

![Advanced Workflow Canvas](https://img.shields.io/badge/Status-Production--Ready-brightgreen)
![Go](https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Distributed Tracing](https://img.shields.io/badge/Observability-OpenTelemetry-blue)

---

## 🚀 Key Features

*   **Durable Orchestration**: Native support for Cron, Intervals, and One-off dates with PostgreSQL-backed atomicity (`FOR UPDATE SKIP LOCKED`).
*   **Zero-Key Bridge**: Privacy-first architecture. Sampling happens exclusively via your connected local host (Claude, Cursor, Antigravity). No API keys are stored on our servers.
*   **Agentic Workflow Engine**: Chain tasks with **Decision Nodes** (LLM branching), **Workflow Looping** (iterative execution), and persistent state (`{{state.VAR}}`).
*   **Human-in-the-Loop**: Built-in safety valves that pause workflows and request manual intervention for ambiguous routing decisions.
*   **Visual Time-Travel Debugger**: An interactive Workflow Canvas (React Flow) to visually "replay" past executions and inspect data piping.
*   **Enterprise Observability**: Full OpenTelemetry integration. Track every execution step with sub-millisecond precision in Jaeger.

---

## 🏗 Architecture

The system is designed for massive scale and absolute privacy:
1.  **API Layer**: High-performance Go server handling web traffic and MCP tool calls.
2.  **Orchestrator**: Distributed scheduler that claims tasks via SQL locking and dispatches them via Redis Pub/Sub.
3.  **Neural Bridge**: A secure SSE tunnel linking the remote engine to your local AI environment.
4.  **Privacy Layer**: Leverages MCP Sampling to delegate AI execution to your local client, keeping your keys on your machine.

---

## 🛠 Tech Stack

*   **Backend**: Go (Echo), PostgreSQL (pgx), Redis
*   **Frontend**: React (Vite), React Flow, Tailwind CSS
*   **Bridge**: Node.js CLI (Zero-dependency AI execution)
*   **Observability**: OpenTelemetry, Jaeger, Prometheus

---

## 🚦 Quick Start

### 1. Launch with Docker Compose
```bash
docker-compose up --build
```

### 2. Connect your Neural Bridge
Connect your local AI assistant to the persistent engine:
```bash
npx @aktionfy/mcp start --api-key YOUR_API_KEY
```
Supported Hosts: **Claude Desktop**, **Cursor**, **Antigravity**, **Codex Desktop**.

---

## 🛠 MCP Tools

*   `create_task`: Schedule a new AI workflow.
*   `list_tasks`: Monitor active and scheduled tasks.
*   `get_task`: Retrieve detailed node configuration.
*   `update_task`: Modify prompts, loops, or logic on-the-fly.
*   `execute_task`: Manually trigger a workflow immediately.
*   `get_current_time`: Synchronize local agents with server time.
*   `search_tasks`: Full-text search for tasks by name or prompt.
*   `get_system_usage_quota`: Retrieve current task limits and active quota usage.
*   `list_failed_tasks`: Identify tasks stuck in an error state.
*   `retry_failed_task`: Instantly clear error records and re-queue a task.

---

## 📜 License
Refer to the [LICENSE](LICENSE) file for details.
