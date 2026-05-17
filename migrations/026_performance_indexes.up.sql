-- schedule-mcp/migrations/026_performance_indexes.up.sql
CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_heartbeat ON worker_heartbeats (last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_dlq_tasks_task_id ON dlq_tasks (task_id);
