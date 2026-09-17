-- Editorial drafts only. Never used by public reading/search until publication is implemented.
CREATE TABLE bok_text_drafts (
 book_id TEXT NOT NULL, source_hash TEXT NOT NULL, page_id INTEGER NOT NULL,
 base_hash TEXT NOT NULL, text TEXT NOT NULL, revision INTEGER NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(book_id, source_hash, page_id)
);
CREATE TABLE bok_text_draft_history (
 book_id TEXT NOT NULL, source_hash TEXT NOT NULL, page_id INTEGER NOT NULL,
 base_hash TEXT NOT NULL, text TEXT NOT NULL, revision INTEGER NOT NULL,
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(book_id, source_hash, page_id, revision)
);
