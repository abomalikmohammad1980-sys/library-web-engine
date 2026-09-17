-- Owner edits return private books to review and invalidate stale review decisions.
DROP TRIGGER oversight_user_books_update;
CREATE TRIGGER oversight_user_books_update AFTER UPDATE ON user_books
WHEN NEW.review_version<>OLD.review_version
AND NOT (
 NEW.reviewed_by IS NULL AND NEW.review_status='pending' AND NEW.review_note=''
 AND OLD.visibility='private' AND NEW.visibility='private'
 AND NEW.review_version=OLD.review_version+1
 AND NEW.owner_subject=OLD.owner_subject AND NEW.object_key=OLD.object_key
 AND NEW.byte_length=OLD.byte_length AND NEW.mime_type=OLD.mime_type
 AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL
)
BEGIN
 SELECT RAISE(ABORT,'oversight_actor_forbidden') WHERE NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.reviewed_by AND a.role IN ('admin','super-admin')) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.reviewed_by AND blocked=1));
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('book-review',NEW.id,NEW.reviewed_by,'update',json_object('title',OLD.title,'author',OLD.author,'category',OLD.category,'visibility',OLD.visibility,'review_status',OLD.review_status,'review_note',OLD.review_note,'deleted_at',OLD.deleted_at),json_object('title',NEW.title,'author',NEW.author,'category',NEW.category,'visibility',NEW.visibility,'review_status',NEW.review_status,'review_note',NEW.review_note,'deleted_at',NEW.deleted_at),OLD.review_version,NEW.review_version);
END;
