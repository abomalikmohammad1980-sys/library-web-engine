CREATE TABLE IF NOT EXISTS central_authors (
 author_id TEXT PRIMARY KEY NOT NULL,
 display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 300),
 biography TEXT NOT NULL CHECK(length(biography) BETWEEN 1 AND 20000),
 source TEXT NOT NULL DEFAULT '',
 death_year_hijri INTEGER,
 contemporary INTEGER NOT NULL DEFAULT 0 CHECK(contemporary IN (0,1)),
 revision INTEGER NOT NULL CHECK(revision>0),
 updated_by TEXT NOT NULL REFERENCES accounts(subject),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS central_author_events (
 author_id TEXT NOT NULL REFERENCES central_authors(author_id),
 revision INTEGER NOT NULL,
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 action TEXT NOT NULL CHECK(action IN ('create','update')),
 display_name TEXT NOT NULL,
 biography TEXT NOT NULL,
 source TEXT NOT NULL,
 death_year_hijri INTEGER,
 contemporary INTEGER NOT NULL CHECK(contemporary IN (0,1)),
 reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(author_id,revision)
);
