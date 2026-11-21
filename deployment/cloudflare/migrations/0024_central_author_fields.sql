ALTER TABLE central_authors ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields_json) AND length(fields_json)<=32768);
ALTER TABLE central_author_events ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(fields_json) AND length(fields_json)<=32768);
DROP TRIGGER oversight_central_authors_insert;
DROP TRIGGER oversight_central_authors_update;
CREATE TRIGGER oversight_central_authors_insert AFTER INSERT ON central_authors WHEN 1
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('central-author',NEW.author_id,NEW.updated_by,'create',NULL,json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'death_year_hijri',NEW.death_year_hijri,'contemporary',NEW.contemporary,'hidden_at',NEW.hidden_at,'fields_json',NEW.fields_json),0,NEW.revision);
END;
CREATE TRIGGER oversight_central_authors_update AFTER UPDATE ON central_authors WHEN NEW.revision<>OLD.revision
BEGIN
 SELECT (CASE WHEN NOT (EXISTS(SELECT 1 FROM accounts a WHERE a.subject=NEW.updated_by AND (a.role='super-admin' OR (a.role='user' AND EXISTS(SELECT 1 FROM account_capabilities c WHERE c.subject=a.subject AND editorial=1)))) AND NOT EXISTS(SELECT 1 FROM account_blocks WHERE subject=NEW.updated_by AND blocked=1)) THEN RAISE(ABORT,'oversight_actor_forbidden') END);
 INSERT INTO oversight_events(entity_type,entity_id,actor_subject,action,before_json,after_json,before_revision,revision)
 VALUES('central-author',NEW.author_id,NEW.updated_by,'update',json_object('display_name',OLD.display_name,'biography',OLD.biography,'source',OLD.source,'death_year_hijri',OLD.death_year_hijri,'contemporary',OLD.contemporary,'hidden_at',OLD.hidden_at,'fields_json',OLD.fields_json),json_object('display_name',NEW.display_name,'biography',NEW.biography,'source',NEW.source,'death_year_hijri',NEW.death_year_hijri,'contemporary',NEW.contemporary,'hidden_at',NEW.hidden_at,'fields_json',NEW.fields_json),OLD.revision,NEW.revision);
END;


