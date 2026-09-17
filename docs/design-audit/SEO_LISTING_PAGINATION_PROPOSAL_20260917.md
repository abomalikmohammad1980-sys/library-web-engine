# A5 bounded listing proposal — frozen production batch34

New helpers only; no shared middleware/router edits, generated asset writes, upload or deployment.

Dry-run of the actual batch34 public metadata: 8,594 books, 3,174 authors, 40 categories. These create 3,218 logical lists / 3,490 pages, packed into **512 deterministic buckets; largest 39,277 bytes**. Each rendered page contains at most 100 links. Runtime enforces a 200,000-byte cap.

Batch34 already contains **19,996 Pages files**. Therefore do NOT place the 512 listing objects in Pages. The helper supports immutable R2 objects under `seo/listings/<releaseId>/lists-NNN.json`, using the existing approved public library bucket and a reviewed SHA-256 release identifier. This adds no Pages assets and needs no new cloud service. The in-memory builder returns buffers plus release identity; publishing is a separate reviewed action. Default ASSETS mode remains available for tests/smaller environments.

Middleware integration proposal:

1. Determine list key: `/authors` -> `authors`; `/browse` -> `browse`; `/new-books` -> `new-books`; `/authors/<id>` -> `author:<id>`; `/categories` -> `categories`; `/categories/<encoded-name>` -> `category:<decoded-name>`.
2. Parse strict positive `page` (default 1). `readSeoListing(ASSETS,url,list,page,{bucket:PUBLIC_LIBRARY_R2??LIBRARY_R2,releaseId:reviewedReleaseId})` reads exactly one bounded bucket. Missing page means 404, not an empty 200.
3. Before rendering book links, call `visibleSeoListingRows(VISITORS_DB,record.rows)`. It checks all raw/numeric/Shamela aliases in batches of 25 books and vetoes hidden/deleted aliases. A DB failure propagates, never silently exposes stale candidates.
4. Render with `renderSeoListing(record,path,visibleRows)`. Actual links point at reader/author/category routes; labels/attributes are escaped. Previous page 1 has no query. Subsequent pages use `?page=N`. Feed `listingPageUrl(path,page)` into canonical metadata; do not canonicalize every pagination page to page 1.
5. Book related sections: load `author:<authorId>` page1 and `category:<category>` page1; refresh visibility; `relatedSeoRows(rows,currentId)` excludes the current book and returns at most12. Link author and category explicitly. A first page provides enough candidates without per-book duplicated assets.
6. `/categories` and `/categories/<name>` still require actual SPA route support and server policy additions, plus category sitemap integration by the main agent. These helpers alone do not make the route live.

Limitations deliberately explicit:

- This build helper consumes only the reviewed packaged public catalog. Live uploaded books require the separate D1 dynamic listing merge; no account/private data is admitted to this static build.
- The legacy catalog does not record genuine publication time. `new-books` uses real `publishedAt` when supplied; otherwise descending source ID is an explicit deterministic fallback, not a fabricated date. Dynamic public uploads should use actual publication time.
- These listing buckets do not replace the existing large identity shards needed by A1; that remains separate work.
- Privacy filtering may leave fewer than100 visible links on an existing static page; it does not expose hidden titles or fill with unreviewed candidates.

Tests: `node --test tools/seo-listings.test.mjs` — 4 pass: complete251-book pagination, canonical prev/next, current alias visibility, related limit, escaped output, bounded/corrupt reads, release-bound R2 keys. No full new asset set generated.
