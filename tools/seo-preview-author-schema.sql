-- Isolated SEO preview only (9133fe99-c4e1-4a1e-84f3-127735883279).
-- Empty read-model matching production author_overrides columns. Not a
-- production migration and not acceptance of editorial write workflows.
CREATE TABLE IF NOT EXISTS author_overrides (
 author_id TEXT PRIMARY KEY NOT NULL,
 display_name TEXT NOT NULL,
 biography TEXT NOT NULL,
 source TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 updated_by TEXT NOT NULL REFERENCES accounts(subject),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 fields_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields_json) AND length(fields_json)<=32768)
);
