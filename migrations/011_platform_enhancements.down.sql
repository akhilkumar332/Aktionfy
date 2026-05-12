ALTER TABLE tasks DROP COLUMN ui_coordinates;
ALTER TABLE tasks DROP COLUMN backoff_strategy;
ALTER TABLE tasks DROP COLUMN retry_count;
ALTER TABLE tasks DROP COLUMN max_retries;
ALTER TABLE tasks DROP COLUMN workspace_id;

DROP TABLE IF EXISTS dlq_tasks;
DROP TABLE IF EXISTS webhook_triggers;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS workspace_members;
DROP TABLE IF EXISTS workspaces;
