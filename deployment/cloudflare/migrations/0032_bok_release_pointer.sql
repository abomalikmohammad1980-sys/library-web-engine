-- Inactive publication primitive. No public endpoint or runtime activation is enabled.
-- Only the trusted artifact verifier may register a candidate after cloud acceptance.
CREATE TABLE bok_verified_releases (
 release_id TEXT PRIMARY KEY,
 candidate_sha256 TEXT NOT NULL,
 book_id TEXT NOT NULL,
 source_hash TEXT NOT NULL,
 reader_manifest_sha256 TEXT NOT NULL,
 search_manifest_sha256 TEXT NOT NULL,
 artifact_root TEXT NOT NULL,
 reviews_json TEXT NOT NULL CHECK(json_valid(reviews_json)),
 cloud_receipt_sha256 TEXT NOT NULL,
 registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER bok_verified_releases_no_update BEFORE UPDATE ON bok_verified_releases
BEGIN SELECT RAISE(ABORT,'immutable_bok_release'); END;
CREATE TRIGGER bok_verified_releases_no_delete BEFORE DELETE ON bok_verified_releases
BEGIN SELECT RAISE(ABORT,'immutable_bok_release'); END;
CREATE TABLE bok_release_pointer (
 scope TEXT PRIMARY KEY CHECK(scope='library'),
 release_id TEXT NOT NULL REFERENCES bok_verified_releases(release_id),
 generation INTEGER NOT NULL CHECK(generation>0),
 updated_by TEXT NOT NULL REFERENCES accounts(subject),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE bok_release_activation_events (
 generation INTEGER PRIMARY KEY,
 release_id TEXT NOT NULL REFERENCES bok_verified_releases(release_id),
 previous_release_id TEXT,
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
