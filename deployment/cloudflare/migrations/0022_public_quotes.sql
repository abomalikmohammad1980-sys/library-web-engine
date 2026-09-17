CREATE TABLE public_quotes (
 id TEXT PRIMARY KEY,
 owner_subject TEXT NOT NULL REFERENCES accounts(subject) ON DELETE CASCADE,
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 2000),
 book_id TEXT NOT NULL,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('submitted','published','shamela')),
 source_id TEXT NOT NULL,
 book_title TEXT NOT NULL,
 page_index INTEGER NOT NULL CHECK(page_index BETWEEN 0 AND 1000000),
 fingerprint TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(owner_subject,fingerprint)
);
CREATE INDEX public_quotes_created ON public_quotes(created_at DESC,id DESC);
CREATE INDEX public_quotes_owner ON public_quotes(owner_subject,created_at DESC);
