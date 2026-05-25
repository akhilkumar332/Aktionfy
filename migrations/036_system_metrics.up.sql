-- migrations/036_system_metrics.up.sql
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_workers INT NOT NULL,
    total_load INT NOT NULL,
    avg_memory_mb FLOAT NOT NULL,
    p99_latency_ms FLOAT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics (timestamp);
