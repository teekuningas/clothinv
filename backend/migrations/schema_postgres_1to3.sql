-- Migration from schema version 1 → 3

BEGIN;

-- 1) Add the new price column to items
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- 2) Create (or ensure) the schema_version table
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

-- 3) Record that we’re now at version 3
INSERT INTO schema_version(version)
  SELECT 3
  WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE version = 3);

COMMIT;
