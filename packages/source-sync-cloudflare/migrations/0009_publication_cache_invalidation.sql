ALTER TABLE book_publications ADD COLUMN active_manifest_etag TEXT;
ALTER TABLE book_publications ADD COLUMN cache_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE cache_invalidation_outbox (
  operation_id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  build_id TEXT NOT NULL,
  manifest_etag TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  next_attempt_at_ms INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT,
  lease_until_ms INTEGER,
  record_version INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY(book_id) REFERENCES books(id),
  FOREIGN KEY(build_id) REFERENCES book_builds(id)
);
CREATE INDEX cache_invalidation_runnable ON cache_invalidation_outbox(state,next_attempt_at_ms,lease_until_ms);
