-- Isolated Stage B outbox foundation; NOT applied to production.
-- No FK on history/events: hard deletion must preserve a removal tombstone.
-- No source key, account identity, content or private-only book is recorded.
CREATE TABLE public_book_event_state(
 book_id TEXT PRIMARY KEY,
 content_version INTEGER NOT NULL CHECK(content_version>0),
 index_generation INTEGER NOT NULL CHECK(index_generation>0),
 visibility TEXT NOT NULL CHECK(visibility IN ('public','removed')),
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE public_book_index_outbox(
 event_id INTEGER PRIMARY KEY AUTOINCREMENT,
 book_id TEXT NOT NULL,
 content_version INTEGER NOT NULL CHECK(content_version>0),
 action TEXT NOT NULL CHECK(action IN ('upsert','remove')),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','delivered','superseded','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 retry_at INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 error_code TEXT,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 delivered_at INTEGER,
 UNIQUE(book_id,content_version)
);
CREATE INDEX public_book_outbox_due ON public_book_index_outbox(state,retry_at,lease_until,event_id);
CREATE TRIGGER public_book_event_insert AFTER INSERT ON public_book_event_state BEGIN
 INSERT INTO public_book_index_outbox(book_id,content_version,action) VALUES(NEW.book_id,NEW.content_version,CASE NEW.visibility WHEN 'public' THEN 'upsert' ELSE 'remove' END);
END;
CREATE TRIGGER public_book_event_update AFTER UPDATE OF content_version ON public_book_event_state BEGIN
 INSERT INTO public_book_index_outbox(book_id,content_version,action) VALUES(NEW.book_id,NEW.content_version,CASE NEW.visibility WHEN 'public' THEN 'upsert' ELSE 'remove' END);
END;
CREATE TRIGGER public_book_outbox_job_insert AFTER INSERT ON public_book_index_jobs BEGIN INSERT INTO public_book_event_state(book_id,content_version,index_generation,visibility) SELECT NEW.book_id,1,NEW.generation,CASE WHEN EXISTS(SELECT 1 FROM user_books b WHERE b.id=NEW.book_id AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL))) THEN 'public' ELSE 'removed' END WHERE EXISTS(SELECT 1 FROM user_books b WHERE b.id=NEW.book_id AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL))) OR EXISTS(SELECT 1 FROM public_book_event_state WHERE book_id=NEW.book_id) ON CONFLICT(book_id) DO UPDATE SET content_version=content_version+1,index_generation=excluded.index_generation,visibility=excluded.visibility,updated_at=unixepoch(); END;
CREATE TRIGGER public_book_outbox_job_revision AFTER UPDATE OF generation ON public_book_index_jobs WHEN NEW.generation<>OLD.generation BEGIN INSERT INTO public_book_event_state(book_id,content_version,index_generation,visibility) SELECT NEW.book_id,1,NEW.generation,CASE WHEN EXISTS(SELECT 1 FROM user_books b WHERE b.id=NEW.book_id AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL))) THEN 'public' ELSE 'removed' END WHERE EXISTS(SELECT 1 FROM user_books b WHERE b.id=NEW.book_id AND b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL))) OR EXISTS(SELECT 1 FROM public_book_event_state WHERE book_id=NEW.book_id) ON CONFLICT(book_id) DO UPDATE SET content_version=content_version+1,index_generation=excluded.index_generation,visibility=excluded.visibility,updated_at=unixepoch(); END;
CREATE TRIGGER public_book_outbox_hard_delete BEFORE DELETE ON user_books BEGIN
 UPDATE public_book_event_state SET content_version=content_version+1,visibility='removed',updated_at=unixepoch() WHERE book_id=OLD.id;
END;
-- Backfill only current public rows, not books that were always private.
INSERT INTO public_book_event_state(book_id,content_version,index_generation,visibility)
 SELECT j.book_id,1,j.generation,'public' FROM public_book_index_jobs j JOIN user_books b ON b.id=j.book_id
 WHERE b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL));

-- Administration is a projection of existing lifecycle, never a competing job queue.
-- Facts are generation-bound; executors may attest TOC/OCR only after verification.
CREATE TABLE public_book_index_facts(
 book_id TEXT PRIMARY KEY,
 generation INTEGER NOT NULL,
 toc_source TEXT NOT NULL DEFAULT 'none' CHECK(toc_source IN ('native','pdf_bookmarks','none')),
 ocr INTEGER NOT NULL DEFAULT 0 CHECK(ocr IN (0,1)),
 indexed_at INTEGER,
 updated_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TRIGGER public_book_facts_insert AFTER INSERT ON public_book_index_jobs BEGIN
 INSERT INTO public_book_index_facts(book_id,generation) VALUES(NEW.book_id,NEW.generation)
 ON CONFLICT(book_id) DO UPDATE SET generation=excluded.generation,toc_source='none',ocr=0,indexed_at=NULL,updated_at=unixepoch();
END;
CREATE TRIGGER public_book_facts_update AFTER UPDATE ON public_book_index_jobs BEGIN
 INSERT INTO public_book_index_facts(book_id,generation,indexed_at) VALUES(NEW.book_id,NEW.generation,CASE WHEN NEW.state='ready' AND OLD.state<>'ready' THEN unixepoch() ELSE NULL END)
 ON CONFLICT(book_id) DO UPDATE SET generation=excluded.generation,
 toc_source=CASE WHEN generation=excluded.generation THEN toc_source ELSE 'none' END,
 ocr=CASE WHEN generation=excluded.generation THEN ocr ELSE 0 END,
 indexed_at=CASE WHEN generation<>excluded.generation THEN NULL WHEN NEW.state='ready' AND OLD.state<>'ready' THEN unixepoch() ELSE indexed_at END,
 updated_at=unixepoch();
END;
INSERT INTO public_book_index_facts(book_id,generation) SELECT book_id,generation FROM public_book_index_jobs;
CREATE VIEW public_book_state_projection AS SELECT j.book_id,j.book_id AS source_book_id,
 CASE s.visibility WHEN 'public' THEN 'public' ELSE 'private' END AS visibility,
 CASE WHEN s.visibility IS NULL OR s.visibility='removed' OR j.state='cancelled' THEN 'removed'
 WHEN j.state='running' AND j.checkpoint=0 THEN 'extracting'
 WHEN j.state='running' THEN 'indexing' ELSE j.state END AS status,
 COALESCE(s.content_version,j.generation) AS content_version,j.attempts,j.error_code AS last_error,
 MAX(COALESCE(s.updated_at,0),COALESCE(f.updated_at,0)) AS updated_at,
 CASE WHEN j.state='ready' AND s.visibility='public' THEN f.indexed_at ELSE NULL END AS indexed_at,
 COALESCE(f.toc_source,'none') AS toc_source,COALESCE(f.ocr,0) AS ocr
 FROM public_book_index_jobs j LEFT JOIN public_book_event_state s ON s.book_id=j.book_id
 LEFT JOIN public_book_index_facts f ON f.book_id=j.book_id AND f.generation=j.generation
 UNION ALL SELECT s.book_id,s.book_id,'private','removed',s.content_version,0,NULL,s.updated_at,NULL,'none',0
 FROM public_book_event_state s WHERE NOT EXISTS(SELECT 1 FROM public_book_index_jobs j WHERE j.book_id=s.book_id);
-- Read-only materialized projection. Mutations belong to jobs/evidence/history.
CREATE TABLE books_index_state(
 book_id TEXT PRIMARY KEY,source_book_id TEXT NOT NULL,
 visibility TEXT NOT NULL CHECK(visibility IN ('public','private')),
 status TEXT NOT NULL CHECK(status IN ('queued','extracting','indexing','ready','ocr_pending','failed','removed')),
 content_version INTEGER NOT NULL,attempts INTEGER NOT NULL,last_error TEXT,
 updated_at INTEGER NOT NULL,indexed_at INTEGER,
 toc_source TEXT NOT NULL CHECK(toc_source IN ('native','pdf_bookmarks','none')),
 ocr INTEGER NOT NULL CHECK(ocr IN (0,1))
);
INSERT INTO books_index_state SELECT * FROM public_book_state_projection;
CREATE TRIGGER public_book_projection_history_insert AFTER INSERT ON public_book_event_state BEGIN
 INSERT INTO books_index_state SELECT * FROM public_book_state_projection WHERE book_id=NEW.book_id
 ON CONFLICT(book_id) DO UPDATE SET source_book_id=excluded.source_book_id,visibility=excluded.visibility,status=excluded.status,content_version=excluded.content_version,attempts=excluded.attempts,last_error=excluded.last_error,updated_at=excluded.updated_at,indexed_at=excluded.indexed_at,toc_source=excluded.toc_source,ocr=excluded.ocr;
END;
CREATE TRIGGER public_book_projection_history_update AFTER UPDATE ON public_book_event_state BEGIN
 INSERT INTO books_index_state SELECT * FROM public_book_state_projection WHERE book_id=NEW.book_id
 ON CONFLICT(book_id) DO UPDATE SET source_book_id=excluded.source_book_id,visibility=excluded.visibility,status=excluded.status,content_version=excluded.content_version,attempts=excluded.attempts,last_error=excluded.last_error,updated_at=excluded.updated_at,indexed_at=excluded.indexed_at,toc_source=excluded.toc_source,ocr=excluded.ocr;
END;
CREATE TRIGGER public_book_projection_facts_insert AFTER INSERT ON public_book_index_facts BEGIN
 INSERT INTO books_index_state SELECT * FROM public_book_state_projection WHERE book_id=NEW.book_id
 ON CONFLICT(book_id) DO UPDATE SET source_book_id=excluded.source_book_id,visibility=excluded.visibility,status=excluded.status,content_version=excluded.content_version,attempts=excluded.attempts,last_error=excluded.last_error,updated_at=excluded.updated_at,indexed_at=excluded.indexed_at,toc_source=excluded.toc_source,ocr=excluded.ocr;
END;
CREATE TRIGGER public_book_projection_facts_update AFTER UPDATE ON public_book_index_facts BEGIN
 INSERT INTO books_index_state SELECT * FROM public_book_state_projection WHERE book_id=NEW.book_id
 ON CONFLICT(book_id) DO UPDATE SET source_book_id=excluded.source_book_id,visibility=excluded.visibility,status=excluded.status,content_version=excluded.content_version,attempts=excluded.attempts,last_error=excluded.last_error,updated_at=excluded.updated_at,indexed_at=excluded.indexed_at,toc_source=excluded.toc_source,ocr=excluded.ocr;
END;
CREATE TRIGGER public_book_projection_job_delete AFTER DELETE ON public_book_index_jobs BEGIN
 DELETE FROM books_index_state WHERE book_id=OLD.book_id;
 INSERT INTO books_index_state SELECT * FROM public_book_state_projection WHERE book_id=OLD.book_id;
END;
