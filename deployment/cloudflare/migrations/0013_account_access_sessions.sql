CREATE TABLE IF NOT EXISTS account_access_sessions (
 token_hash TEXT PRIMARY KEY,
 subject TEXT NOT NULL REFERENCES accounts(subject) ON DELETE CASCADE,
 device_id TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_access_sessions_expiry ON account_access_sessions(expires_at);
CREATE TABLE IF NOT EXISTS account_access_login_states (
 state_hash TEXT PRIMARY KEY,
 return_url TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
