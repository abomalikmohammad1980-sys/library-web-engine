CREATE TABLE source_conflict_resolutions (
  book_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  conflicting_revision_id TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK(resolution IN ('keepLocal','keepRemote','createCopy')),
  requested_by_user_id TEXT NOT NULL,
  requested_by_device_id TEXT NOT NULL,
  expected_publication_version INTEGER NOT NULL,
  target_book_id TEXT NOT NULL,
  target_revision_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('archived','queued','published')),
  publication_record_version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(book_id,operation_id),
  FOREIGN KEY(book_id) REFERENCES books(id),
  FOREIGN KEY(conflicting_revision_id) REFERENCES book_source_revisions(id)
);

-- The intent row is the transactional CAS gate.  D1 batch executes the insert,
-- publication update, revision transition, copy/build creation, and audit as one
-- transaction; aborting this trigger rolls the entire batch back.
CREATE TRIGGER source_conflict_resolution_cas
BEFORE INSERT ON source_conflict_resolutions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM book_publications p
    JOIN book_source_revisions r ON r.id=NEW.conflicting_revision_id AND r.book_id=NEW.book_id
    JOIN books b ON b.id=NEW.book_id AND b.owner_id=NEW.requested_by_user_id
    WHERE p.book_id=NEW.book_id
      AND p.record_version=NEW.expected_publication_version
      AND r.status='conflicted'
  ) THEN RAISE(ABORT,'conflict_resolution_cas') END;
END;
