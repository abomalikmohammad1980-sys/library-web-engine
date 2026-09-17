CREATE TABLE book_reader_reports (
 id TEXT PRIMARY KEY,
 reporter_subject TEXT NOT NULL REFERENCES accounts(subject),
 book_id TEXT NOT NULL, book_title TEXT NOT NULL,
 kind TEXT NOT NULL, message TEXT NOT NULL, context_json TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','resolved')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX book_reader_reports_account ON book_reader_reports(reporter_subject,created_at DESC);
