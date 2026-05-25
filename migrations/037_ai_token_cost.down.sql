ALTER TABLE execution_traces 
DROP COLUMN input_tokens,
DROP COLUMN output_tokens,
DROP COLUMN cache_read_tokens,
DROP COLUMN cache_write_tokens,
DROP COLUMN cost_usd;
