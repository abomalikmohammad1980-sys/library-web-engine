CREATE TABLE IF NOT EXISTS account_blocks (
  subject TEXT PRIMARY KEY REFERENCES accounts(subject) ON DELETE CASCADE,
  blocked INTEGER NOT NULL CHECK(blocked IN (0,1)),
  reason TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version>0),
  last_operation TEXT NOT NULL UNIQUE,
  updated_by TEXT NOT NULL REFERENCES accounts(subject),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS account_block_events (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL REFERENCES accounts(subject),
  actor_subject TEXT NOT NULL REFERENCES accounts(subject),
  blocked INTEGER NOT NULL CHECK(blocked IN (0,1)),
  reason TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS account_block_events_subject ON account_block_events(subject,created_at DESC);
