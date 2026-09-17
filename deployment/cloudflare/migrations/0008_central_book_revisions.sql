ALTER TABLE central_book_overrides ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE central_book_audit_events ADD COLUMN revision INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS central_book_audit_revision ON central_book_audit_events(book_id,revision) WHERE revision IS NOT NULL;
