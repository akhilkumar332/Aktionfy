# Contributing to Aktionfy MCP Server

We welcome contributions from the community! To maintain a high bar for engineering quality, please follow these guidelines.

## 🛠 Local Development Environment

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/akhilkumar332/aktionfy.git
    cd aktionfy
    ```

2.  **Infrastructure**:
    Start the database, redis, and observability dependencies:
    ```bash
    docker-compose up -d db redis jaeger
    ```

3.  **Backend**:
    ```bash
    cd cmd/server
    go run .
    ```

4.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

---

## ✅ Engineering Standards

*   **Observability**: New background logic must include OpenTelemetry spans. Use the `otel` package to wrap critical steps.
*   **Security**: Always perform ownership checks on database resources. Never trust user-provided IDs without verification.
*   **Testing**: ALWAYS run the backend tests before submitting a PR:
    ```bash
    go test ./...
    ```
*   **Linting**: Ensure the frontend is lint-free using ESLint:
    ```bash
    npm run lint
    ```
*   **Conventional Commits**: We use the Conventional Commits specification for all PRs and commits.

---

## 🏗 Submitting Changes

1.  **Decomposition**: If implementing a major feature, break it into small, independent sub-tasks (Database -> Backend -> Frontend).
2.  **Branches**: Create a feature branch from `main`.
3.  **Validation**: Ensure both backend and frontend build successfully for production:
    ```bash
    go build ./cmd/server/...
    npm run build
    ```
4.  **Pull Requests**: Provide a clear description of the problem solved and include screenshots for UI changes.

Thank you for helping build the future of AI orchestration!
