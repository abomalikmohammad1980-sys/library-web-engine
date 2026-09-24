-- HTML companion images and stylesheets are not extra book volumes.
-- Keep their relative paths and original bytes separate from the immutable
-- source HTML, and account for them in user_book_metadata.storage_bytes.
CREATE TABLE IF NOT EXISTS user_book_html_resources (
 resource_id TEXT PRIMARY KEY,
 book_id TEXT NOT NULL REFERENCES user_books(id),
 relative_path TEXT NOT NULL CHECK(length(relative_path) BETWEEN 1 AND 300),
 object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/gif','image/webp','image/avif','text/css')),
 byte_length INTEGER NOT NULL CHECK(byte_length>0),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 UNIQUE(book_id,relative_path)
);
CREATE INDEX IF NOT EXISTS user_book_html_resources_book ON user_book_html_resources(book_id);
