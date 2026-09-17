ALTER TABLE user_books ADD COLUMN deleted_at TEXT;
ALTER TABLE user_books ADD COLUMN deletion_object_removed_at TEXT;
ALTER TABLE user_books ADD COLUMN quota_released_at TEXT;
CREATE INDEX IF NOT EXISTS user_books_deletion_pending ON user_books(deleted_at,deletion_object_removed_at);
