-- Classification only. No PDF body indexing or OCR activation.
ALTER TABLE public_book_index_facts ADD COLUMN pdf_kind TEXT CHECK(pdf_kind IN ('text','scanned'));
ALTER TABLE public_book_index_facts ADD COLUMN ocr_pending INTEGER NOT NULL DEFAULT 0 CHECK(ocr_pending IN (0,1));
ALTER TABLE public_book_index_facts ADD COLUMN pdf_source_sha256 TEXT;
ALTER TABLE public_book_index_facts ADD COLUMN pdf_generation INTEGER;
DROP VIEW public_book_state_projection;
CREATE VIEW public_book_state_projection AS SELECT j.book_id,j.book_id AS source_book_id,
 CASE s.visibility WHEN 'public' THEN 'public' ELSE 'private' END AS visibility,
 CASE WHEN s.visibility IS NULL OR s.visibility='removed' OR j.state='cancelled' THEN 'removed'
 WHEN j.state='ready' AND f.pdf_kind='scanned' AND f.ocr_pending=1 AND f.pdf_generation=j.generation AND f.pdf_source_sha256=j.source_sha256 THEN 'ocr_pending'
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
UPDATE public_book_index_facts SET updated_at=updated_at;
