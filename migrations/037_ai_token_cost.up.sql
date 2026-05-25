ALTER TABLE execution_traces 
ADD COLUMN input_tokens INT DEFAULT 0,
ADD COLUMN output_tokens INT DEFAULT 0,
ADD COLUMN cache_read_tokens INT DEFAULT 0,
ADD COLUMN cache_write_tokens INT DEFAULT 0,
ADD COLUMN cost_usd NUMERIC(10, 6) DEFAULT 0.0;
