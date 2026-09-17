-- Durable lifecycle only. Do not apply until the isolated executor/consumer acceptance passes.
-- User-uploaded books only: packaged Shamela releases keep their existing immutable pipeline.
CREATE TABLE public_book_index_revisions (
 book_id TEXT PRIMARY KEY REFERENCES user_books(id) ON DELETE CASCADE,
 generation INTEGER NOT NULL CHECK(generation>0)
);
CREATE TABLE public_book_index_jobs (
 book_id TEXT PRIMARY KEY REFERENCES user_books(id) ON DELETE CASCADE,
 generation INTEGER NOT NULL CHECK(generation>0),
 state TEXT NOT NULL CHECK(state IN ('queued','running','ready','failed','cancelled')),
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 retry_at INTEGER NOT NULL DEFAULT 0,
 checkpoint INTEGER NOT NULL DEFAULT 0 CHECK(checkpoint>=0),
 error_code TEXT,
 manifest_sha256 TEXT,
 source_sha256 TEXT,
 artifact_key TEXT,
 parser_version TEXT,
 coverage_mode TEXT CHECK(coverage_mode IN ('text-and-headings','pdf-bookmarks-only')),
 CHECK((state='running' AND lease_token IS NOT NULL) OR state<>'running'),
 CHECK(state<>'ready' OR (manifest_sha256 IS NOT NULL AND source_sha256 IS NOT NULL AND length(manifest_sha256)=64 AND length(source_sha256)=64 AND artifact_key IS NOT NULL AND parser_version IS NOT NULL AND coverage_mode IS NOT NULL))
);
CREATE INDEX public_book_index_due ON public_book_index_jobs(state,retry_at,lease_until);
CREATE VIEW public_book_index_eligible AS
 SELECT b.id, r.generation, b.object_key,b.mime_type,b.byte_length,
 COALESCE(c.title,b.title) title,COALESCE(c.author,b.author) author,b.category
 FROM user_books b JOIN public_book_index_revisions r ON r.book_id=b.id
 LEFT JOIN central_book_overrides c ON c.book_id=b.id
 WHERE b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM central_book_overrides hidden
 WHERE hidden.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id)
 AND (hidden.visibility<>'public' OR hidden.logically_deleted_at IS NOT NULL))
 -- Edited BOK releases already have their own pinned reader/search publication.
 -- Never resurrect original upload text over the active corrected release.
 AND NOT EXISTS(SELECT 1 FROM bok_release_pointer p JOIN bok_verified_releases v ON v.release_id=p.release_id
 WHERE p.scope='library' AND v.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id));
CREATE TRIGGER public_book_index_revision_insert AFTER INSERT ON public_book_index_revisions BEGIN INSERT INTO public_book_index_jobs(book_id,generation,state)
 VALUES(NEW.book_id,NEW.generation,CASE WHEN EXISTS(SELECT 1 FROM public_book_index_eligible WHERE id=NEW.book_id) THEN 'queued' ELSE 'cancelled' END)
 ON CONFLICT(book_id) DO UPDATE SET generation=excluded.generation,state=excluded.state,
 lease_token=NULL,lease_until=0,attempts=0,retry_at=0,checkpoint=0,error_code=NULL,
 manifest_sha256=NULL,source_sha256=NULL,artifact_key=NULL,parser_version=NULL,coverage_mode=NULL; END;
CREATE TRIGGER public_book_index_revision_update AFTER UPDATE OF generation ON public_book_index_revisions BEGIN INSERT INTO public_book_index_jobs(book_id,generation,state)
 VALUES(NEW.book_id,NEW.generation,CASE WHEN EXISTS(SELECT 1 FROM public_book_index_eligible WHERE id=NEW.book_id) THEN 'queued' ELSE 'cancelled' END)
 ON CONFLICT(book_id) DO UPDATE SET generation=excluded.generation,state=excluded.state,
 lease_token=NULL,lease_until=0,attempts=0,retry_at=0,checkpoint=0,error_code=NULL,
 manifest_sha256=NULL,source_sha256=NULL,artifact_key=NULL,parser_version=NULL,coverage_mode=NULL; END;
CREATE TRIGGER public_book_index_book_insert AFTER INSERT ON user_books BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_book_update AFTER UPDATE OF title,author,category,object_key,mime_type,byte_length,visibility,review_status,deleted_at ON user_books
 WHEN NEW.title IS NOT OLD.title OR NEW.author IS NOT OLD.author OR NEW.category IS NOT OLD.category
 OR NEW.object_key IS NOT OLD.object_key OR NEW.mime_type IS NOT OLD.mime_type OR NEW.byte_length IS NOT OLD.byte_length
 OR NEW.visibility IS NOT OLD.visibility OR NEW.review_status IS NOT OLD.review_status OR NEW.deleted_at IS NOT OLD.deleted_at
 BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_assets_insert AFTER INSERT ON user_book_assets WHEN NEW.kind='volume' BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_assets_delete AFTER DELETE ON user_book_assets WHEN OLD.kind='volume' AND EXISTS(SELECT 1 FROM user_books WHERE id=OLD.book_id) BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(OLD.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_assets_update AFTER UPDATE ON user_book_assets WHEN (NEW.kind='volume' OR OLD.kind='volume') AND (NEW.book_id IS NOT OLD.book_id OR NEW.kind IS NOT OLD.kind OR NEW.object_key IS NOT OLD.object_key OR NEW.sha256 IS NOT OLD.sha256 OR NEW.part_number IS NOT OLD.part_number OR NEW.mime_type IS NOT OLD.mime_type OR NEW.byte_length IS NOT OLD.byte_length) BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; UPDATE public_book_index_revisions SET generation=generation+1 WHERE book_id=OLD.book_id AND OLD.book_id<>NEW.book_id; END;
CREATE TRIGGER public_book_index_word_insert AFTER INSERT ON user_book_word_bundles WHEN 1 BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_word_delete AFTER DELETE ON user_book_word_bundles WHEN 1 AND EXISTS(SELECT 1 FROM user_books WHERE id=OLD.book_id) BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(OLD.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_word_update AFTER UPDATE ON user_book_word_bundles WHEN (1 OR 1) AND (NEW.book_id IS NOT OLD.book_id OR NEW.object_key IS NOT OLD.object_key OR NEW.sha256 IS NOT OLD.sha256 OR NEW.manifest_json IS NOT OLD.manifest_json) BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; UPDATE public_book_index_revisions SET generation=generation+1 WHERE book_id=OLD.book_id AND OLD.book_id<>NEW.book_id; END;
CREATE TRIGGER public_book_index_metadata_insert AFTER INSERT ON user_book_metadata WHEN 1 BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_metadata_delete AFTER DELETE ON user_book_metadata WHEN 1 AND EXISTS(SELECT 1 FROM user_books WHERE id=OLD.book_id) BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(OLD.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER public_book_index_metadata_update AFTER UPDATE ON user_book_metadata WHEN (1 OR 1) AND (NEW.book_id IS NOT OLD.book_id OR json_extract(NEW.metadata_json,'$.parts') IS NOT json_extract(OLD.metadata_json,'$.parts') OR json_extract(NEW.metadata_json,'$.tags') IS NOT json_extract(OLD.metadata_json,'$.tags') OR json_extract(NEW.metadata_json,'$.authors') IS NOT json_extract(OLD.metadata_json,'$.authors')) BEGIN INSERT INTO public_book_index_revisions(book_id,generation) VALUES(NEW.book_id,1) ON CONFLICT(book_id) DO UPDATE SET generation=generation+1; UPDATE public_book_index_revisions SET generation=generation+1 WHERE book_id=OLD.book_id AND OLD.book_id<>NEW.book_id; END;
CREATE TRIGGER public_book_index_override_insert AFTER INSERT ON central_book_overrides  BEGIN UPDATE public_book_index_revisions SET generation=generation+1 WHERE NEW.book_id IN (book_id,'central-submission:'||book_id,'account-book:'||book_id); END;
CREATE TRIGGER public_book_index_override_update AFTER UPDATE ON central_book_overrides WHEN (NEW.title IS NOT OLD.title OR NEW.author IS NOT OLD.author OR NEW.visibility IS NOT OLD.visibility OR NEW.logically_deleted_at IS NOT OLD.logically_deleted_at) BEGIN UPDATE public_book_index_revisions SET generation=generation+1 WHERE NEW.book_id IN (book_id,'central-submission:'||book_id,'account-book:'||book_id); END;
CREATE TRIGGER public_book_index_override_delete AFTER DELETE ON central_book_overrides  BEGIN UPDATE public_book_index_revisions SET generation=generation+1 WHERE OLD.book_id IN (book_id,'central-submission:'||book_id,'account-book:'||book_id); END;
-- Backfill does not parse or publish anything. Existing private books are cancellation records only.
CREATE TRIGGER public_book_index_bok_pointer_insert AFTER INSERT ON bok_release_pointer BEGIN
 UPDATE public_book_index_revisions SET generation=generation+1 WHERE EXISTS(SELECT 1 FROM bok_verified_releases v WHERE v.release_id=NEW.release_id AND v.book_id IN (public_book_index_revisions.book_id,'central-submission:'||public_book_index_revisions.book_id,'account-book:'||public_book_index_revisions.book_id)); END;
CREATE TRIGGER public_book_index_bok_pointer_update AFTER UPDATE OF release_id ON bok_release_pointer WHEN NEW.release_id IS NOT OLD.release_id BEGIN
 UPDATE public_book_index_revisions SET generation=generation+1 WHERE EXISTS(SELECT 1 FROM bok_verified_releases v WHERE v.release_id IN (NEW.release_id,OLD.release_id) AND v.book_id IN (public_book_index_revisions.book_id,'central-submission:'||public_book_index_revisions.book_id,'account-book:'||public_book_index_revisions.book_id)); END;
CREATE TRIGGER public_book_index_bok_pointer_delete AFTER DELETE ON bok_release_pointer BEGIN
 UPDATE public_book_index_revisions SET generation=generation+1 WHERE EXISTS(SELECT 1 FROM bok_verified_releases v WHERE v.release_id=OLD.release_id AND v.book_id IN (public_book_index_revisions.book_id,'central-submission:'||public_book_index_revisions.book_id,'account-book:'||public_book_index_revisions.book_id)); END;
INSERT INTO public_book_index_revisions(book_id,generation) SELECT id,1 FROM user_books;
