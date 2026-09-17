CREATE TABLE IF NOT EXISTS book_review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  reviewer_subject TEXT NOT NULL REFERENCES accounts(subject),
  decision TEXT NOT NULL CHECK (decision IN ('publish','private','reject')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS book_review_events_book ON book_review_events(book_id, created_at DESC);
