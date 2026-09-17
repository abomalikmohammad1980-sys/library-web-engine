CREATE TABLE IF NOT EXISTS author_overrides (
 author_id TEXT PRIMARY KEY NOT NULL,
 display_name TEXT NOT NULL,
 biography TEXT NOT NULL,
 source TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 updated_by TEXT NOT NULL REFERENCES accounts(subject),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS author_override_history (
 author_id TEXT NOT NULL,
 revision INTEGER NOT NULL,
 display_name TEXT NOT NULL,
 biography TEXT NOT NULL,
 source TEXT NOT NULL,
 reason TEXT NOT NULL,
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(author_id,revision)
);
