-- Derived, generation-fenced FTS. Ready extraction alone is not search coverage.
CREATE TABLE public_book_search_receipts(book_id TEXT PRIMARY KEY, generation INTEGER NOT NULL, manifest_sha256 TEXT NOT NULL, row_count INTEGER NOT NULL);
CREATE TABLE public_book_search_staging(book_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,manifest_sha256 TEXT NOT NULL,next_row INTEGER NOT NULL);
CREATE TABLE public_book_search_rows(
 row_id INTEGER PRIMARY KEY, book_id TEXT NOT NULL, generation INTEGER NOT NULL,
 field TEXT NOT NULL CHECK(field IN ('body','heading','card')), ordinal INTEGER NOT NULL,
 text TEXT NOT NULL, normalized TEXT NOT NULL, anchor_json TEXT NOT NULL,
 UNIQUE(book_id,generation,field,ordinal)
);
CREATE INDEX public_book_search_identity ON public_book_search_rows(book_id,generation);
CREATE VIRTUAL TABLE public_book_search_fts USING fts5(normalized,content='public_book_search_rows',content_rowid='row_id',tokenize='unicode61');
CREATE TRIGGER public_book_search_insert AFTER INSERT ON public_book_search_rows BEGIN
 INSERT INTO public_book_search_fts(rowid,normalized) VALUES(NEW.row_id,NEW.normalized); END;
CREATE TRIGGER public_book_search_delete AFTER DELETE ON public_book_search_rows BEGIN
 INSERT INTO public_book_search_fts(public_book_search_fts,rowid,normalized) VALUES('delete',OLD.row_id,OLD.normalized); END;
CREATE TRIGGER public_book_search_update AFTER UPDATE ON public_book_search_rows BEGIN
 INSERT INTO public_book_search_fts(public_book_search_fts,rowid,normalized) VALUES('delete',OLD.row_id,OLD.normalized);
 INSERT INTO public_book_search_fts(rowid,normalized) VALUES(NEW.row_id,NEW.normalized); END;
CREATE TABLE public_book_search_epoch(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL);
INSERT INTO public_book_search_epoch VALUES(1,1);
CREATE TRIGGER public_book_search_epoch_insert AFTER INSERT ON public_book_index_jobs BEGIN UPDATE public_book_search_epoch SET version=version+1 WHERE id=1; END;
CREATE TRIGGER public_book_search_epoch_delete AFTER DELETE ON public_book_index_jobs BEGIN
 UPDATE public_book_search_epoch SET version=version+1 WHERE id=1;
 DELETE FROM public_book_search_rows WHERE book_id=OLD.book_id;
 DELETE FROM public_book_search_staging WHERE book_id=OLD.book_id;
 DELETE FROM public_book_search_receipts WHERE book_id=OLD.book_id; END;
CREATE TRIGGER public_book_search_epoch_update AFTER UPDATE OF generation,state,manifest_sha256 ON public_book_index_jobs
 WHEN NEW.generation IS NOT OLD.generation OR NEW.state IS NOT OLD.state OR NEW.manifest_sha256 IS NOT OLD.manifest_sha256
 BEGIN UPDATE public_book_search_epoch SET version=version+1 WHERE id=1; END;
