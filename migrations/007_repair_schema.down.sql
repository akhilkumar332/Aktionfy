-- Reverse of migrations/007_repair_schema.up.sql

-- Drop functions
DROP FUNCTION IF EXISTS fn_claim_due_tasks(INT, TEXT);
DROP FUNCTION IF EXISTS fn_complete_task(UUID, TIMESTAMP WITH TIME ZONE, TEXT);

-- Drop indexes
DROP INDEX IF EXISTS idx_tasks_depends_on;
DROP INDEX IF EXISTS idx_tasks_next_run_status;

-- Drop columns added by this migration
ALTER TABLE tasks DROP COLUMN IF EXISTS requires_approval;
ALTER TABLE tasks DROP COLUMN IF EXISTS encrypted_secrets;
ALTER TABLE tasks DROP COLUMN IF EXISTS last_approval_status;
ALTER TABLE tasks DROP COLUMN IF EXISTS trigger_on_completion;
