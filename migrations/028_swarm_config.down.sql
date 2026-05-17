ALTER TABLE tasks DROP COLUMN IF EXISTS swarm_config;
ALTER TABLE task_versions DROP COLUMN IF EXISTS swarm_config;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('mcp_sampling', 'native_action', 'decision_router'));
