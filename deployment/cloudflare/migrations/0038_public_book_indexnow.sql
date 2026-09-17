-- Delivery receipt, not evidence that a search engine indexed the URL.
CREATE TABLE public_book_indexnow(
 book_id TEXT NOT NULL,content_version INTEGER NOT NULL,action TEXT NOT NULL CHECK(action IN ('upsert','remove')),
 state TEXT NOT NULL CHECK(state IN ('queued','sending','accepted','failed','superseded')),
 attempts INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,http_status INTEGER,
 updated_at INTEGER NOT NULL,PRIMARY KEY(book_id,content_version)
);
