CREATE TABLE IF NOT EXISTS account_storage_usage (
  subject TEXT PRIMARY KEY NOT NULL REFERENCES accounts(subject) ON DELETE CASCADE,
  used_bytes INTEGER NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  book_count INTEGER NOT NULL DEFAULT 0 CHECK (book_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO account_storage_usage(subject,used_bytes,book_count)
SELECT owner_subject,COALESCE(SUM(byte_length),0),COUNT(*) FROM user_books GROUP BY owner_subject
ON CONFLICT(subject) DO UPDATE SET used_bytes=excluded.used_bytes,book_count=excluded.book_count,updated_at=CURRENT_TIMESTAMP;
