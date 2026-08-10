CREATE TABLE account_quotas (
 principal_sub TEXT PRIMARY KEY,max_source_bytes INTEGER NOT NULL,max_book_revisions INTEGER NOT NULL,
 max_account_storage_bytes INTEGER NOT NULL,max_requests_per_window INTEGER NOT NULL,rate_window_seconds INTEGER NOT NULL,
 FOREIGN KEY(principal_sub) REFERENCES accounts(principal_sub)
);
CREATE TABLE account_usage (
 principal_sub TEXT PRIMARY KEY,committed_bytes INTEGER NOT NULL DEFAULT 0,reserved_bytes INTEGER NOT NULL DEFAULT 0,
 window_started_at INTEGER NOT NULL DEFAULT 0,window_requests INTEGER NOT NULL DEFAULT 0,record_version INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(principal_sub) REFERENCES accounts(principal_sub)
);
CREATE TABLE usage_reservations (
 principal_sub TEXT NOT NULL,book_id TEXT NOT NULL,operation_id TEXT NOT NULL,upload_id TEXT NOT NULL,byte_length INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN('reserved','committed','released')),expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(principal_sub,book_id,operation_id),UNIQUE(upload_id)
);
CREATE TABLE audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,principal_sub TEXT NOT NULL,event_type TEXT NOT NULL,book_id TEXT,device_id TEXT,operation_id TEXT,
 outcome TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_principal_created ON audit_events(principal_sub,created_at DESC);
CREATE INDEX reservations_expiry ON usage_reservations(status,expires_at);
