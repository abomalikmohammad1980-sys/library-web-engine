-- Atomic monthly free-quota reservations. No source text, credentials, or IP addresses.
CREATE TABLE translation_provider_usage (
 bucket TEXT PRIMARY KEY,
 used INTEGER NOT NULL CHECK (used >= 0),
 expires_at INTEGER NOT NULL
);
