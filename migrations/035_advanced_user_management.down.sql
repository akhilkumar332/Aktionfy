DROP TABLE IF EXISTS user_invitations;
ALTER TABLE users DROP COLUMN IF EXISTS max_tasks_limit;
ALTER TABLE users DROP COLUMN IF EXISTS rate_limit_override;
