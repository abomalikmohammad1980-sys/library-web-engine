CREATE TABLE logical_works (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  authority_kind TEXT CHECK(authority_kind IN ('word-live','immutable-edition')),
  authority_edition_id TEXT,
  authority_format TEXT CHECK(authority_format IN ('docx','pdf','bok','epub','text')),
  record_version INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(id) REFERENCES books(id)
);
CREATE INDEX logical_works_owner ON logical_works(owner_id,id);

CREATE TABLE source_editions (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  format TEXT NOT NULL CHECK(format IN ('docx','pdf','bok','epub','text')),
  role TEXT NOT NULL CHECK(role IN ('authoritative','alternate','derived')),
  object_key TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  byte_length INTEGER NOT NULL CHECK(byte_length>=0),
  media_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by_device_id TEXT NOT NULL,
  UNIQUE(work_id,operation_id),
  UNIQUE(work_id,format,sha256,byte_length),
  FOREIGN KEY(work_id) REFERENCES logical_works(id)
);
CREATE INDEX source_editions_work_created ON source_editions(work_id,created_at DESC,id);

CREATE TABLE source_edition_operations (
  work_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  intent TEXT NOT NULL CHECK(intent IN ('attach-alternate','establish-authority','advance-authority')),
  requested_by_user_id TEXT NOT NULL,
  requested_by_device_id TEXT NOT NULL,
  expected_work_version INTEGER NOT NULL,
  result_work_version INTEGER NOT NULL,
  result_authority_kind TEXT CHECK(result_authority_kind IN ('word-live','immutable-edition')),
  result_authority_edition_id TEXT,
  result_authority_format TEXT CHECK(result_authority_format IN ('docx','pdf','bok','epub','text')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(work_id,operation_id),
  FOREIGN KEY(work_id) REFERENCES logical_works(id),
  FOREIGN KEY(edition_id) REFERENCES source_editions(id)
);

CREATE TRIGGER source_edition_attachment_cas
BEFORE INSERT ON source_edition_operations
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM logical_works w
    JOIN source_editions e ON e.id=NEW.edition_id AND e.work_id=w.id
    WHERE w.id=NEW.work_id AND w.owner_id=NEW.requested_by_user_id
      AND w.record_version=NEW.expected_work_version
      AND e.created_by_device_id=NEW.requested_by_device_id
  ) THEN RAISE(ABORT,'source_edition_attachment_cas') END;
END;

-- Backward-compatible projection: no source bytes are copied or renamed.
INSERT INTO logical_works(id,owner_id,title,authority_kind,authority_edition_id,authority_format,record_version)
SELECT b.id,b.owner_id,b.id,
  CASE WHEN COALESCE(p.active_source_revision_id,b.active_source_revision_id) IS NULL THEN NULL ELSE 'word-live' END,
  COALESCE(p.active_source_revision_id,b.active_source_revision_id),
  CASE WHEN COALESCE(p.active_source_revision_id,b.active_source_revision_id) IS NULL THEN NULL ELSE 'docx' END,
  0
FROM books b LEFT JOIN book_publications p ON p.book_id=b.id;

INSERT INTO source_editions(id,operation_id,work_id,format,role,object_key,sha256,byte_length,media_type,source_name,created_at,created_by_device_id)
SELECT r.id,r.operation_id,r.book_id,'docx','authoritative',r.immutable_object_key,r.sha256,r.byte_length,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',r.source_name,r.created_at,r.created_by_device_id
FROM book_source_revisions r;
