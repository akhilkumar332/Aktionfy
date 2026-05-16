ALTER TABLE tasks ADD COLUMN branch_condition JSONB;
ALTER TABLE tasks ADD COLUMN is_bundle_root BOOLEAN DEFAULT FALSE;

ALTER TABLE task_versions ADD COLUMN branch_condition JSONB;
ALTER TABLE task_versions ADD COLUMN is_bundle_root BOOLEAN DEFAULT FALSE;
