-- Migration: add request_id column to system_logs
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS request_id text;
-- Optionally add index if high-cardinality lookups are needed
-- CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);
