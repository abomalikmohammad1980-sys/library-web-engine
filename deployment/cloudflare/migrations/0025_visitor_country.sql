-- Approximate country only; never store IP, city, coordinates or account identity.
ALTER TABLE unique_visitors ADD COLUMN country TEXT;
ALTER TABLE unique_visitors ADD COLUMN country_seen_at TEXT;
CREATE INDEX IF NOT EXISTS unique_visitors_first_seen ON unique_visitors(first_seen);
CREATE TABLE IF NOT EXISTS account_demographics(
 subject TEXT PRIMARY KEY REFERENCES accounts(subject),
 birth_year INTEGER,
 consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN(0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((consent=0 AND birth_year IS NULL) OR (consent=1 AND birth_year BETWEEN 1900 AND 2200))
);
