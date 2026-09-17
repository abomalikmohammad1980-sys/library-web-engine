-- Additive: originals and existing asset kinds are not rewritten.
CREATE TABLE user_book_word_bundles (
 book_id TEXT PRIMARY KEY REFERENCES user_books(id),
 manifest_json TEXT NOT NULL CHECK(length(manifest_json)<=4096),
 object_key TEXT NOT NULL UNIQUE,
 byte_length INTEGER NOT NULL CHECK(byte_length>0 AND byte_length<=33554432),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64)
);
