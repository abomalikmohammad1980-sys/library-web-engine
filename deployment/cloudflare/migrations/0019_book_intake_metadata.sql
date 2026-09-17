CREATE TABLE IF NOT EXISTS user_book_metadata (
 book_id TEXT PRIMARY KEY REFERENCES user_books(id),
 metadata_json TEXT NOT NULL CHECK(length(metadata_json)<=65536),
 central_author_id TEXT REFERENCES central_authors(author_id),
 storage_bytes INTEGER NOT NULL CHECK(storage_bytes>0)
);
CREATE INDEX IF NOT EXISTS user_book_metadata_author ON user_book_metadata(central_author_id,book_id);
CREATE TABLE IF NOT EXISTS user_book_assets (
 asset_id TEXT PRIMARY KEY,
 book_id TEXT NOT NULL REFERENCES user_books(id),
 kind TEXT NOT NULL CHECK(kind IN ('volume','pdf','cover')),
 part_number INTEGER,
 object_key TEXT NOT NULL UNIQUE,
 file_name TEXT NOT NULL,
 mime_type TEXT NOT NULL,
 byte_length INTEGER NOT NULL CHECK(byte_length>0),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64)
);
CREATE INDEX IF NOT EXISTS user_book_assets_book ON user_book_assets(book_id);
