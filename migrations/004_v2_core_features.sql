ALTER TABLE tasks ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN encrypted_secrets BYTEA;
ALTER TABLE tasks ADD COLUMN last_approval_status VARCHAR(20); -- 'pending', 'approved', 'denied'
