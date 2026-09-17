CREATE TABLE IF NOT EXISTS account_capabilities (
 subject TEXT PRIMARY KEY REFERENCES accounts(subject) ON DELETE CASCADE,
 editorial INTEGER NOT NULL CHECK(editorial=1),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS account_capability_events (
 id TEXT PRIMARY KEY NOT NULL,
 subject TEXT NOT NULL REFERENCES accounts(subject),
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 previous_role TEXT NOT NULL CHECK(previous_role IN ('user','editor','admin','super-admin')),
 role TEXT NOT NULL CHECK(role IN ('user','editor','admin','super-admin')),
 revision INTEGER NOT NULL CHECK(revision>0),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(subject,revision)
);
