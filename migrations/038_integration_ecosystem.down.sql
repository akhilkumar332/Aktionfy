ALTER TABLE tasks DROP COLUMN integration_id;
ALTER TABLE tasks DROP COLUMN integration_config;

ALTER TABLE tasks DROP CONSTRAINT tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('mcp_sampling', 'native_action', 'decision_router', 'swarm_router'));

ALTER TABLE task_versions DROP COLUMN integration_id;
ALTER TABLE task_versions DROP COLUMN integration_config;

ALTER TABLE task_versions DROP CONSTRAINT task_versions_task_type_check;
ALTER TABLE task_versions ADD CONSTRAINT task_versions_task_type_check CHECK (task_type IN ('mcp_sampling', 'native_action', 'decision_router', 'swarm_router'));
