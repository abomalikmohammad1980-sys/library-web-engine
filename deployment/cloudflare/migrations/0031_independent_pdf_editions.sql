-- An independent edition is a separate user_books record, never a page map.
CREATE TABLE IF NOT EXISTS independent_pdf_editions (
  book_id TEXT PRIMARY KEY NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES accounts(subject),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(book_id <> parent_id)
);
CREATE INDEX IF NOT EXISTS independent_pdf_editions_parent ON independent_pdf_editions(parent_id,book_id);
