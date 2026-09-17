CREATE TABLE account_devices(owner_subject TEXT NOT NULL,device_id TEXT NOT NULL,label TEXT NOT NULL,platform TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TEXT,PRIMARY KEY(owner_subject,device_id),FOREIGN KEY(owner_subject) REFERENCES accounts(subject));
CREATE INDEX account_devices_owner_active ON account_devices(owner_subject,revoked_at,created_at);
CREATE TABLE account_device_limit_events(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_subject TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(owner_subject) REFERENCES accounts(subject));
CREATE INDEX account_device_limit_events_recent ON account_device_limit_events(created_at DESC,owner_subject);
