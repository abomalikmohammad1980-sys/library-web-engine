ALTER TABLE author_overrides ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields_json) AND length(fields_json)<=32768);
ALTER TABLE author_override_history ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields_json) AND length(fields_json)<=32768);
CREATE TABLE author_override_write_receipts(author_id TEXT NOT NULL,revision INTEGER NOT NULL,complete INTEGER NOT NULL CHECK(complete=1),PRIMARY KEY(author_id,revision));
DROP TRIGGER oversight_author_overrides_insert;
DROP TRIGGER oversight_author_overrides_update;
CREATE TRIGGER oversight_author_overrides_insert AFTER INSERT ON author_overrides WHEN 1
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('author-override',NEW.author_id,NEW.updated_by,'override',NULL,json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'disabled',NEW.disabled,'fields_json',NEW.fields_json),0,NEW.revision);
END;
CREATE TRIGGER oversight_author_overrides_update AFTER UPDATE ON author_overrides WHEN NEW.revision<>OLD.revision
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('author-override',NEW.author_id,NEW.updated_by,'update',json_object('display_name',OLD.display_name,'biography',OLD.biography,'source',OLD.source,'disabled',OLD.disabled,'fields_json',OLD.fields_json),json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'disabled',NEW.disabled,'fields_json',NEW.fields_json),OLD.revision,NEW.revision);
END;

