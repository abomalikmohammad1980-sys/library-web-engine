PRAGMA foreign_keys = ON;
CREATE TABLE books (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, active_source_revision_id TEXT);
CREATE INDEX books_owner ON books(owner_id, id);
CREATE TABLE source_uploads (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, owner_id TEXT NOT NULL, book_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL,
  base_revision_id TEXT, source_name TEXT NOT NULL, device_id TEXT NOT NULL,
  expires_at TEXT NOT NULL, finalized_revision_id TEXT,
  UNIQUE(book_id, operation_id), FOREIGN KEY(book_id) REFERENCES books(id)
);
CREATE TABLE book_source_revisions (
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL, operation_id TEXT NOT NULL, base_revision_id TEXT,
  sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, source_name TEXT NOT NULL,
  created_at TEXT NOT NULL, created_by_device_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('uploaded','quarantined','processing','ready','published','conflicted','rejected','failed')),
  immutable_object_key TEXT NOT NULL,
  UNIQUE(book_id, operation_id), UNIQUE(book_id, sha256, byte_length),
  FOREIGN KEY(book_id) REFERENCES books(id)
);
CREATE INDEX source_revisions_book_created ON book_source_revisions(book_id, created_at DESC);
