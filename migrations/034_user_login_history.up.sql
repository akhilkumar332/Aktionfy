ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user_id ON user_login_history (user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_history_login_time ON user_login_history (login_time DESC);
