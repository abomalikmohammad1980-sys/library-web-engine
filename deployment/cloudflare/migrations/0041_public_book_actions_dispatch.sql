-- Reviewed local-only targeted Actions dispatch ledger. No credentials/source bytes.
CREATE TABLE public_book_actions_dispatches(
 book_id TEXT NOT NULL,content_version INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('dispatching','dispatched','failed')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,
 run_id INTEGER,next_attempt_at INTEGER NOT NULL DEFAULT 0,
 error_code TEXT,updated_at INTEGER NOT NULL,
 PRIMARY KEY(book_id,content_version)
);
