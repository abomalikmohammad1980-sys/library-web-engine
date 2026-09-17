-- Match live SEO's canonical upload aliases for metadata as well as privacy.
DROP VIEW public_book_index_eligible;
CREATE VIEW public_book_index_eligible AS
 SELECT b.id,r.generation,b.object_key,b.mime_type,b.byte_length,
 COALESCE(NULLIF(c.title,''),b.title) title,COALESCE(NULLIF(c.author,''),b.author) author,
 CASE WHEN c.book_id IS NULL THEN b.category ELSE COALESCE(c.category,'') END category
 FROM user_books b JOIN public_book_index_revisions r ON r.book_id=b.id
 LEFT JOIN central_book_overrides c ON c.book_id=(
  SELECT candidate.book_id FROM central_book_overrides candidate
  WHERE candidate.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id)
  ORDER BY candidate.revision DESC LIMIT 1)
 WHERE b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM central_book_overrides hidden
 WHERE hidden.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id)
 AND (hidden.visibility<>'public' OR hidden.logically_deleted_at IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM bok_release_pointer p JOIN bok_verified_releases v ON v.release_id=p.release_id
 WHERE p.scope='library' AND v.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id));
-- Existing trigger covers title/author/visibility. Category-only edits need the
-- same revision fence, but mixed edits must not produce a second revision.
CREATE TRIGGER public_book_index_override_category_update AFTER UPDATE OF category ON central_book_overrides
 WHEN NEW.category IS NOT OLD.category AND NEW.title IS OLD.title AND NEW.author IS OLD.author
 AND NEW.visibility IS OLD.visibility AND NEW.logically_deleted_at IS OLD.logically_deleted_at
 BEGIN UPDATE public_book_index_revisions SET generation=generation+1
 WHERE NEW.book_id IN (book_id,'central-submission:'||book_id,'account-book:'||book_id); END;
