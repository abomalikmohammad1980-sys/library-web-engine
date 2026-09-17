ALTER TABLE user_books ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE book_review_events ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS book_review_events_book_version ON book_review_events(book_id, review_version);
