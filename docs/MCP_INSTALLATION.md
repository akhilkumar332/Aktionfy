# MCP Configuration & Installation

This guide explains how to connect your preferred AI client to the Aktionfy MCP server.

## Installation Methods

### Claude Desktop
To use Aktionfy with Claude Desktop, add the following to your `claude_desktop_config.json`:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "aktionfy": {
      "command": "npx",
      "args": ["-y", "@aktionfy/schedule-mcp"],
      "env": {
        "DATABASE_URL": "your-database-url",
        "REDIS_URL": "your-redis-url"
      }
    }
  }
}
```

### LobeChat
1. Go to **Settings** -> **Skill Settings**.
2. Select **Custom Skills**.
3. Click **Quick Import JSON** and paste your configuration.

### Cursor
1. Go to **Settings** -> **MCP**.
2. Click **Add New Global MCP Server**.
3. Enter `aktionfy` as the name and use the `npx` command above.

### VS Code (MCP Extension)
1. Open the Command Palette (`Ctrl+Shift+P`).
2. Search for **MCP: Add Server**.
3. Follow the prompts to add the Aktionfy server.

## Configuration Options

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `DATABASE_URL`       | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/mcp?sslmode=disable` |
| `REDIS_URL`          | Redis connection string | `redis://localhost:6379/0` |
| `PORT`               | HTTP server port | `8080` |

## Available Tools

- `create_task`: Schedules a new task.
- `list_tasks`: Lists all active tasks.
- `get_task`: Gets details for a specific task.
- `update_task`: Updates an existing task.
- `delete_task`: Deletes a task.
- `pause_task`: Pauses a task.
- `resume_task`: Resumes a task.
- `execute_task`: Triggers a task immediately.
- `get_current_time`: Returns the server's current UTC time.
- `store_secret`: Securely stores a secret.
- `list_secrets`: Lists stored secrets.
- `delete_secret`: Deletes a secret.
