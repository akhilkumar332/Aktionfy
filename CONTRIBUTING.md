# Contributing to Scheduled Actions MCP Server

We welcome contributions! Please follow these guidelines to ensure a smooth development process.

## 🛠 Local Development Environment

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/your-username/schedule-mcp.git
    cd schedule-mcp
    ```

2.  **Infrastructure**:
    Start the database and redis dependencies:
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

## ✅ Standards

*   **Testing**: ALWAYS run the backend tests before submitting a PR:
    ```bash
    go test ./...
    ```
*   **Linting**: Ensure the frontend is lint-free:
    ```bash
    npm run lint
    ```
*   **Git Hooks**: We recommend using descriptive commit messages following the Conventional Commits specification.

---

## 🏗 Submitting Changes

1.  Create a feature branch from `main`.
2.  Commit your changes with clear, descriptive messages.
3.  Ensure all tests and lint checks pass.
4.  Open a Pull Request with a clear description of the changes and how to verify them.

Thank you for helping improve Scheduled Actions!
