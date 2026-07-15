ALTER TABLE tasks DROP CONSTRAINT tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('mcp_sampling', 'native_action', 'decision_router', 'swarm_router', 'integration_action'));

ALTER TABLE tasks ADD COLUMN integration_id TEXT;
ALTER TABLE tasks ADD COLUMN integration_config JSONB;

ALTER TABLE task_versions DROP CONSTRAINT task_versions_task_type_check;
ALTER TABLE task_versions ADD CONSTRAINT task_versions_task_type_check CHECK (task_type IN ('mcp_sampling', 'native_action', 'decision_router', 'swarm_router', 'integration_action'));

ALTER TABLE task_versions ADD COLUMN integration_id TEXT;
ALTER TABLE task_versions ADD COLUMN integration_config JSONB;
