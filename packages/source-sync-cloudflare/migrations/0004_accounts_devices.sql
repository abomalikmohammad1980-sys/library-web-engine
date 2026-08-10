CREATE TABLE accounts (principal_sub TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE devices (
  principal_sub TEXT NOT NULL, device_id TEXT NOT NULL, label TEXT NOT NULL, platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT,
  PRIMARY KEY(principal_sub,device_id), FOREIGN KEY(principal_sub) REFERENCES accounts(principal_sub)
);
CREATE INDEX devices_principal_active ON devices(principal_sub,revoked_at,device_id);
-- Compatibility migration: preserve device ids already trusted by committed source operations.
INSERT OR IGNORE INTO accounts(principal_sub) SELECT DISTINCT owner_id FROM books;
INSERT OR IGNORE INTO devices(principal_sub,device_id,label,platform)
SELECT DISTINCT owner_id,device_id,'Migrated device','legacy' FROM source_uploads WHERE device_id<>'';
INSERT OR IGNORE INTO devices(principal_sub,device_id,label,platform)
SELECT DISTINCT b.owner_id,r.created_by_device_id,'Migrated device','legacy' FROM book_source_revisions r JOIN books b ON b.id=r.book_id WHERE r.created_by_device_id<>'';
