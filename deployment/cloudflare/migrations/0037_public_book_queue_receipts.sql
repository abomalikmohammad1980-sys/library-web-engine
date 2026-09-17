-- Local/preview preparation only: consumer receipts contain no book text or source keys.
CREATE TABLE public_book_queue_receipts(
 book_id TEXT NOT NULL, content_version INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('queued','running','ready','removed','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
 error_code TEXT, updated_at INTEGER NOT NULL, PRIMARY KEY(book_id,content_version)
);
CREATE TABLE public_book_queue_reconcile_cursor(id INTEGER PRIMARY KEY CHECK(id=1),book_id TEXT NOT NULL DEFAULT '',upper_book_id TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 0,cycle_started_at INTEGER,completed_at INTEGER,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0);
INSERT INTO public_book_queue_reconcile_cursor(id) VALUES(1);
