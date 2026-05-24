ALTER TABLE users ADD COLUMN IF NOT EXISTS max_tasks_limit INTEGER DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rate_limit_override INTEGER DEFAULT NULL;

CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    tier TEXT NOT NULL DEFAULT 'free',
    invite_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations (invite_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations (email);
