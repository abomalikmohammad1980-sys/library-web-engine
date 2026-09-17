# Attached SEO specification: stage A progress

Baseline is published batch34 (214d9565), not old unshipped batch35.

Implemented and locally tested:
- A2: labelled Arabic book descriptions <=155 characters at word boundaries.
  Complete8,594-book catalog regression passes, compared with2,158 old grammar
  defects and479 overlength descriptions on the frozen published source.
- A3: unknown application paths return real404/noindex using404.html; known
  private routes remain200/noindex. Asset/API delegation is unchanged.
- A4: 301 legacy books/reader/people/author paths, preserving reader query.
  Missing canonical destination still returns404.
- A6: short static H1 separate from search-result title, exactlyone heading.

Validation:19 Vitest tests in5 files passed; app TypeScript passed;2 real
HTMLRewriter integration suites passed including public/private routes, legacy
redirects, missing IDs, sitemap totals, and pending/public upload compatibility.
No production deployment of these new edits.

In progress, not complete:
- A1 internal versioned cache helper; outward cache headers must not permit
  withdrawn/private books to remain public. Fresh visibility check beforecachehit.
- A5 bounded listing helper tested, requires full integration and R2 artifacts
  (current Pages19996 assetcount prevents adding512listing files there).
- Full stageA preview/performance30URL test and A5 categories/SPA/sitemap.
- StageB queue/extraction/OCR/differential search and acceptance. New attachment
  asks PDF OCR, unlike earlier bookmarks-only requirement; do not claim current
  PDF adapter alreadyimplementsOCR or provisionpaidOCRwithoutauthorization.

Local batch36 is partial-stage validation only. Preview requested branch remains
seo-indexing-preview once stageA acceptance is complete; production needsapproval.
