-- Phase 12: Advanced Engine Indexes
CREATE INDEX IF NOT EXISTS idx_execution_traces_task_id_exec_id ON execution_traces (task_id, execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state_task_id_exec_id ON workflow_state (task_id, execution_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks (workspace_id);
