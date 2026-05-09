# Scheduled Actions MCP Server - V2 Enhancements & Scaling Design

## Goal
Enhance the Scheduled Actions MCP Server with features ported from industry-standard tools (Jules MCP, schedule-task-mcp), simplify installation, and implement real-time interactive dashboards powered by Redis, while maintaining high scalability.

## Architecture & Scalability
*   **Core Engine:** PostgreSQL remains the single source of truth and handles concurrency via `FOR UPDATE SKIP LOCKED`.
*   **Real-time Layer (Redis):** Redis is introduced to manage transient, high-throughput operations:
    *   **Pub/Sub:** Routing task execution events and live logs from background workers to the specific web server holding the user's dashboard/SSE connection.
    *   **Rate Limiting:** Global rate limiting across distributed instances.
    *   **Session State:** Tracking which node holds which active SSE connection.

## Feature Enhancements (Ported)
1.  **Human-in-the-Loop (`require_plan_approval`):** 
    *   Tasks can be flagged to require manual intervention.
    *   Execution pauses, and a prompt is sent to the user's dashboard (via Redis Pub/Sub) requiring approval before the server proceeds with execution.
2.  **Secure Persistence:** 
    *   AES-256-GCM encryption for sensitive data (e.g., user-provided API keys for tasks) at rest in PostgreSQL. Decryption occurs only in memory during execution.
3.  **Rich Formatting:** 
    *   MCP tool responses will include both raw JSON (for automation) and cleanly formatted Markdown (for human readability in the CLI).
4.  **Proactive Prompting:** 
    *   Support for scheduling conversational or research-based prompts that execute automatically and push results to the user (via email or dashboard).

## Live Dashboards
*   **User Dashboard:**
    *   Full live streaming of task status transitions.
    *   Real-time streaming of execution logs and LLM responses.
    *   Instant interactive UI pop-ups for tasks waiting on `require_plan_approval`.
*   **Admin Dashboard:**
    *   Live system health metrics (active workers, queue depth).
    *   Global live feed of task executions.
    *   Real-time rate-limit monitoring.

## Installation Simplification
*   **Distribution:** Provide multiple easy installation paths for the Go binary:
    1.  A `curl`/`bash` script pulling the latest GitHub Release.
    2.  An NPM wrapper package allowing installation via `npx @org/schedule-mcp install --api-key <key>`.