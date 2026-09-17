-- Isolated SEO preview only. Read-only inspection confirmed these two columns
-- were absent in the earlier minimal acceptance schema. Match migrations0007/8.
ALTER TABLE central_book_overrides ADD COLUMN category TEXT;
ALTER TABLE central_book_overrides ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
