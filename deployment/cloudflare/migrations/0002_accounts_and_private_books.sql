CREATE TABLE IF NOT EXISTS accounts (
  subject TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','super-admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_books (
  id TEXT PRIMARY KEY NOT NULL,
  owner_subject TEXT NOT NULL REFERENCES accounts(subject) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length > 0),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES accounts(subject),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS user_books_owner_created ON user_books(owner_subject, created_at DESC);
CREATE INDEX IF NOT EXISTS user_books_review_queue ON user_books(review_status, created_at ASC);

CREATE TABLE IF NOT EXISTS book_review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  reviewer_subject TEXT NOT NULL REFERENCES accounts(subject),
  decision TEXT NOT NULL CHECK (decision IN ('publish','private','reject')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS book_review_events_book ON book_review_events(book_id, created_at DESC);
