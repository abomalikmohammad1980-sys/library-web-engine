-- Durable reviewed requests. No automatic publication is enabled by this table.
CREATE TABLE bok_publication_jobs (
 id TEXT PRIMARY KEY,
 owner_subject TEXT NOT NULL REFERENCES accounts(subject),
 book_id TEXT NOT NULL,
 source_hash TEXT NOT NULL,
 request_sha256 TEXT NOT NULL,
 reviews_json TEXT NOT NULL CHECK(json_valid(reviews_json)),
 status TEXT NOT NULL DEFAULT 'awaiting_operator' CHECK(status IN ('awaiting_operator','building','needs_review','failed','published')),
 release_id TEXT,
 failure_code TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX bok_publication_jobs_owner_book ON bok_publication_jobs(owner_subject,book_id,created_at DESC);
