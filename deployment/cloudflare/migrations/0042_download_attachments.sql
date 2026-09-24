-- Download-only archives deliberately have no user_books row or search outbox trigger.
CREATE TABLE IF NOT EXISTS download_attachments (
 id TEXT PRIMARY KEY,
 owner_subject TEXT NOT NULL REFERENCES accounts(subject),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=5000),
 category TEXT NOT NULL DEFAULT '' CHECK(length(category)<=120),
 author_key TEXT NOT NULL DEFAULT '' CHECK(length(author_key)<=200),
 file_name TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format IN ('zip','rar')),
 object_key TEXT NOT NULL UNIQUE,
 byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 52428800),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','public','withdrawn')),
 revision INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(category<>'' OR author_key<>'')
);
CREATE INDEX IF NOT EXISTS download_attachments_category ON download_attachments(category,state,id);
CREATE INDEX IF NOT EXISTS download_attachments_author ON download_attachments(author_key,state,id);
CREATE INDEX IF NOT EXISTS download_attachments_owner ON download_attachments(owner_subject,id);
CREATE INDEX IF NOT EXISTS download_attachments_review ON download_attachments(state,id);
CREATE TABLE IF NOT EXISTS download_attachment_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 attachment_id TEXT NOT NULL REFERENCES download_attachments(id),
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 decision TEXT NOT NULL CHECK(decision IN ('submit','public','withdrawn')),
 revision INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
