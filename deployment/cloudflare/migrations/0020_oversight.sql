-- Requires release approval. New events only: legacy snapshots are never fabricated.
ALTER TABLE central_authors ADD COLUMN hidden_at TEXT;
ALTER TABLE author_overrides ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1));
CREATE TABLE oversight_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 action TEXT NOT NULL,before_json TEXT,after_json TEXT NOT NULL,
 before_revision INTEGER NOT NULL,revision INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(entity_type,entity_id,revision)
);
CREATE INDEX oversight_actor ON oversight_events(actor_subject,id DESC);
CREATE TABLE oversight_undos(
 event_id INTEGER PRIMARY KEY REFERENCES oversight_events(id),
 undo_event_id INTEGER NOT NULL UNIQUE REFERENCES oversight_events(id),
 actor_subject TEXT NOT NULL REFERENCES accounts(subject),
 reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE oversight_notifications(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 recipient_subject TEXT NOT NULL REFERENCES accounts(subject),
 undo_event_id INTEGER NOT NULL UNIQUE REFERENCES oversight_events(id),
 message TEXT NOT NULL,reason TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX oversight_notifications_recipient ON oversight_notifications(recipient_subject,id DESC);
CREATE TABLE oversight_undo_receipts(
 event_id INTEGER PRIMARY KEY REFERENCES oversight_events(id),
 complete INTEGER NOT NULL CHECK(complete=1)
);
CREATE TRIGGER oversight_capability_event AFTER INSERT ON account_capability_events
BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE subject=NEW.actor_subject AND role='super-admin') OR EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.actor_subject AND blocked=1) OR EXISTS(SELECT 1 FROM account_credentials WHERE subject=NEW.actor_subject) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision) VALUES('account-role',NEW.subject,NEW.actor_subject,'update',json_object('role',NEW.previous_role),json_object('role',NEW.role),NEW.revision-1,NEW.revision);
END;
CREATE TRIGGER oversight_block_insert AFTER INSERT ON account_blocks
BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE subject=NEW.updated_by AND role IN ('admin','super-admin')) OR EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision) VALUES('account-block',NEW.subject,NEW.updated_by,'update',json_object('blocked',0,'reason',''),json_object('blocked',NEW.blocked,'reason',NEW.reason),0,NEW.version);
END;
CREATE TRIGGER oversight_block_update AFTER UPDATE ON account_blocks WHEN NEW.version<>OLD.version
BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM accounts WHERE subject=NEW.updated_by AND role IN ('admin','super-admin')) OR EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision) VALUES('account-block',NEW.subject,NEW.updated_by,'update',json_object('blocked',OLD.blocked,'reason',OLD.reason),json_object('blocked',NEW.blocked,'reason',NEW.reason),OLD.version,NEW.version);
END;
CREATE TRIGGER oversight_user_books_insert AFTER INSERT ON user_books WHEN NEW.visibility='public' AND NEW.review_status='approved' AND NEW.review_version=1
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.reviewed_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.reviewed_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('book-review',NEW.id,NEW.reviewed_by,'create',NULL,json_object('title',NEW.title,'author',NEW.author,'category',NEW.category,'visibility',NEW.visibility,'review_status',NEW.review_status,'review_note',NEW.review_note,'deleted_at',NEW.deleted_at),0,NEW.review_version);
END;
CREATE TRIGGER oversight_user_books_update AFTER UPDATE ON user_books WHEN NEW.review_version<>OLD.review_version
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.reviewed_by AND a.role IN ('admin','super-admin')) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.reviewed_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('book-review',NEW.id,NEW.reviewed_by,'update',json_object('title',OLD.title,'author',OLD.author,'category',OLD.category,'visibility',OLD.visibility,'review_status',OLD.review_status,'review_note',OLD.review_note,'deleted_at',OLD.deleted_at),json_object('title',NEW.title,'author',NEW.author,'category',NEW.category,'visibility',NEW.visibility,'review_status',NEW.review_status,'review_note',NEW.review_note,'deleted_at',NEW.deleted_at),OLD.review_version,NEW.review_version);
END;
CREATE TRIGGER oversight_central_book_overrides_insert AFTER INSERT ON central_book_overrides WHEN 1
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('central-book',NEW.book_id,NEW.updated_by,'override',NULL,json_object('title',NEW.title,'author',NEW.author,'category',NEW.category,'visibility',NEW.visibility,'logically_deleted_at',NEW.logically_deleted_at),0,NEW.revision);
END;
CREATE TRIGGER oversight_central_book_overrides_update AFTER UPDATE ON central_book_overrides WHEN NEW.revision<>OLD.revision
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('central-book',NEW.book_id,NEW.updated_by,'update',json_object('title',OLD.title,'author',OLD.author,'category',OLD.category,'visibility',OLD.visibility,'logically_deleted_at',OLD.logically_deleted_at),json_object('title',NEW.title,'author',NEW.author,'category',NEW.category,'visibility',NEW.visibility,'logically_deleted_at',NEW.logically_deleted_at),OLD.revision,NEW.revision);
END;
CREATE TRIGGER oversight_central_authors_insert AFTER INSERT ON central_authors WHEN 1
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('central-author',NEW.author_id,NEW.updated_by,'create',NULL,json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'death_year_hijri',NEW.death_year_hijri,'contemporary',NEW.contemporary,'hidden_at',NEW.hidden_at),0,NEW.revision);
END;
CREATE TRIGGER oversight_central_authors_update AFTER UPDATE ON central_authors WHEN NEW.revision<>OLD.revision
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('central-author',NEW.author_id,NEW.updated_by,'update',json_object('display_name',OLD.display_name,'biography',OLD.biography,'source',OLD.source,'death_year_hijri',OLD.death_year_hijri,'contemporary',OLD.contemporary,'hidden_at',OLD.hidden_at),json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'death_year_hijri',NEW.death_year_hijri,'contemporary',NEW.contemporary,'hidden_at',NEW.hidden_at),OLD.revision,NEW.revision);
END;
CREATE TRIGGER oversight_author_overrides_insert AFTER INSERT ON author_overrides WHEN 1
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('author-override',NEW.author_id,NEW.updated_by,'override',NULL,json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'disabled',NEW.disabled),0,NEW.revision);
END;
CREATE TRIGGER oversight_author_overrides_update AFTER UPDATE ON author_overrides WHEN NEW.revision<>OLD.revision
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('author-override',NEW.author_id,NEW.updated_by,'update',json_object('display_name',OLD.display_name,'biography',OLD.biography,'source',OLD.source,'disabled',OLD.disabled),json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'disabled',NEW.disabled),OLD.revision,NEW.revision);
END;

