ALTER TABLE users 
ADD COLUMN password_hash TEXT,
ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'staff', 'admin')),
ADD COLUMN last_login TIMESTAMP WITH TIME ZONE;

-- Ensure users ID can be generated as string UUID if needed, 
-- though current schema uses TEXT. 
ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

CREATE TABLE web_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
