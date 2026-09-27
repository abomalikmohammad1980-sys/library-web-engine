-- Privacy-conscious translation response cache and aggregate usage metrics.
-- Source text is never stored; cache keys are SHA-256 digests.
CREATE TABLE translation_response_cache (
  cache_key TEXT PRIMARY KEY,
  translation TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX translation_response_cache_expiry ON translation_response_cache(expires_at);

CREATE TABLE translation_usage_metrics (
  period TEXT NOT NULL,
  provider TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0 CHECK (requests >= 0),
  characters INTEGER NOT NULL DEFAULT 0 CHECK (characters >= 0),
  succeeded INTEGER NOT NULL DEFAULT 0 CHECK (succeeded >= 0),
  failed INTEGER NOT NULL DEFAULT 0 CHECK (failed >= 0),
  cache_hits INTEGER NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
  cache_characters_saved INTEGER NOT NULL DEFAULT 0 CHECK (cache_characters_saved >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (period, provider)
);

