CREATE TABLE IF NOT EXISTS system_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    worker_prune_days INT NOT NULL DEFAULT 7,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO system_settings (id, worker_prune_days)
VALUES (1, 7)
ON CONFLICT DO NOTHING;
