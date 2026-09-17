ALTER TABLE book_publications ADD COLUMN desired_source_revision_id TEXT;
CREATE TABLE source_revision_rollbacks (
  book_id TEXT NOT NULL, operation_id TEXT NOT NULL, target_revision_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL, requested_by_device_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','published')), publication_record_version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(book_id,operation_id),
  FOREIGN KEY(book_id) REFERENCES books(id), FOREIGN KEY(target_revision_id) REFERENCES book_source_revisions(id)
);
