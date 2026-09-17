-- Requires explicit release approval; never grants a role by email.
ALTER TABLE accounts ADD COLUMN role_version INTEGER NOT NULL DEFAULT 0 CHECK(role_version>=0);
CREATE TABLE account_role_events (
 id TEXT PRIMARY KEY NOT NULL,
 subject TEXT NOT NULL REFERENCES accounts(subject),
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 previous_role TEXT NOT NULL CHECK(previous_role IN ('user','admin','super-admin')),
 role TEXT NOT NULL CHECK(role IN ('user','admin','super-admin')),
 revision INTEGER NOT NULL CHECK(revision>0),
 reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(subject,revision)
);
