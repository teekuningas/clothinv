-- Migration from schema version 1 → 3 for SQLite

BEGIN TRANSACTION;

-- 1) Add the new price column
ALTER TABLE items
  ADD COLUMN price REAL;

-- 2) Create schema_version table if it does not exist
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

-- 3) Record that we’re now at version 3 (only once)
INSERT OR IGNORE INTO schema_version(version)
  VALUES (3);

COMMIT;
