CREATE TABLE IF NOT EXISTS account_credentials (
 subject TEXT PRIMARY KEY REFERENCES accounts(subject) ON DELETE CASCADE,
 password_hash TEXT NOT NULL,
 salt TEXT NOT NULL,
 email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified=0)
);
CREATE TABLE IF NOT EXISTS account_sessions (
 token_hash TEXT PRIMARY KEY,
 device_id TEXT NOT NULL,
 subject TEXT NOT NULL REFERENCES account_credentials(subject) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_expiry ON account_sessions(expires_at);
CREATE TABLE IF NOT EXISTS account_auth_limits (
 bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
