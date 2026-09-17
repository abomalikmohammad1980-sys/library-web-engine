CREATE TABLE IF NOT EXISTS central_book_overrides (
  book_id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  author TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted','hidden')),
  logically_deleted_at TEXT,
  updated_by TEXT NOT NULL REFERENCES accounts(subject),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS central_book_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  actor_subject TEXT NOT NULL REFERENCES accounts(subject),
  action TEXT NOT NULL CHECK (action IN ('update','delete','restore')),
  title TEXT,
  author TEXT,
  visibility TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS central_book_audit_book ON central_book_audit_events(book_id,created_at DESC);
