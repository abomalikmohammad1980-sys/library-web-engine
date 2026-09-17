# SEO batch37 preview — measured, target not achieved

Preview45c07822-d1f5-487b-bfa6-9df5f9635773 successfully deployed:
https://seo-indexing-preview.khezana.pages.dev
Immutable https://45c07822.khezana.pages.dev
Source b70e92721a5e8bcb52ddceb0fe65c372ba66732f pushed to neworigin.
Production remains214d9565-f244-41d5-af51-e86309c463ce (batch34).

## Verified

- All515 immutable SEO objects freshreadback verified,15,637,665bytes.
- Frozenclientbuild andFunctions compilation passed;19999assets.
- 60focused tests andtypecheck passed (not wholeprojectgreen).
- 18remoteHTTP checks passed: book/author/Quran/listpage2/categories200;
  invalidbook/path/category/page404; legacy301 preservingposition;
  private settings200/noindex; sitemapindex/categories200. Everypreviewnoindex.
- Browser-only in-app check:40categorylinks, actualcategory100bookpage,
  nextpage100differentbooklinks, browserback restorespage1. No desktopcontrol.
- No offline/PWA acceptance claimed for this new categoryscreen.

## Remote schema issue found and resolved

Initialbook503 was caused by the older minimal isolated D1 schema lacking
central_book_overrides.category and revision. Added the samecolumns as0007/8
ONLY to isolated9133fe99-c4e1-4a1e-84f3-127735883279. Empty author_overrides
readmodel was also added there; see tools/seo-preview-*-schema.sql.
This is not production migration or editorial writeworkflow acceptance.

## Performance (30 reproducibly sampled book/author URLs)

| Measurement | Observed p95 TTFB | Target | Result |
|---|---:|---:|---|
| Firstrequest | 2941.34ms | <800ms | Notmet |
| Repeatedrequest | 1451.93ms | <300ms | Notmet |

Clientobserved networkTTFB, not guaranteedcoldcache. Rawmeasurements:
`.artifacts/batch37/preview-performance.json`. LocalrealCacheAPI test proves
warmrequest skipsHTMLrender and withdrawal invalidates, but this does not
establish targetlatency. StageA1 therefore remainsOPEN.

## Next work

Reduce sequential freshvisibility queries and repeated immutable R2reads without
weakening withdrawalchecks. Currentrelatedlists mayrequire up to4D1statements
each, twice percachecheck; batchthese and reuse only immutabledata within the
request, never cachedvisibility. Re-measure on a newpreview.
Also open: actualcoldcacheproof, dynamicnewuploadlisting merge/relatedtitles,
StageB lifecycle/OCR/fullacceptance. No productionapprovalrequested yet.
