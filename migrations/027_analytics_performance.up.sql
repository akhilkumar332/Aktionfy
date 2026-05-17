-- schedule-mcp/migrations/027_analytics_performance.up.sql
CREATE INDEX IF NOT EXISTS idx_execution_traces_start_time ON execution_traces (start_time);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
