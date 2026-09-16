# SEO / clean paths — production receipt, 2026-09-16

Published with explicit user approval to https://khzanah.com.

- Version: `batch-20260916-26`
- Deployment: `036ced36-8bb4-4120-9349-c3eedbd899d8`
- Immutable deployment: https://036ced36.khezana.pages.dev
- Baseline / rollback: batch25, `de450476-a33d-413b-a3b0-0d3aabeea7b7`
- Frozen source: `.artifacts/batch26/source-snapshot.json`
- Frozen payload and Functions: `.artifacts/batch26/deploy/`
- Production HTTP evidence: `.artifacts/batch26/production-http.json` (passed).
- Operational receipt: `alpha-publish/ops/batch-20260916-26-deployment.json`.

## Delivered

History API navigation, legacy hash migration, canonical public book/author paths, client metadata and server-rendered public metadata/content, real missing-book 404, private/search noindex, preview noindex, sitemap generation and validated TOC shards. Existing library/API gateways remain enabled; SEO middleware passes them through.

Sitemaps contain 11,775 URLs: 8,594 books, 3,174 authors and seven static pages. TOC extraction covers 4,065,851 headings. Content-addressed compressed TOC packs were uploaded to the existing R2 bucket and read using bounded ranges. Sixteen headings without a valid page retain text without an invented link.

The previous production tafsir payload and other data were retained: 19,843 data/non-code files matched the baseline. No database migration was performed.

## Verification

Production HTTP checks passed for home, features, authors, author 000020 and book 21633: status 200, distinct metadata, production canonical and exactly one H1. Unknown book 999999999 returns 404/noindex. Search/settings are noindex without canonical. Numeric aliases redirect 301. Sitemap counts and public metadata API passed.

Live Chrome verification: `/#/people/000020` became `/authors/000020`, and the complete author screen rendered. Direct `/books/21633` rendered the real book text, TOC and reader controls with the specific book/author title. Preview navigation and browser Back also passed.

Typecheck and frozen production build passed; focused route/position tests: 37 passed; updated route contracts and heading prototype: 34 passed; offline/SW automated tests: 28 passed; latest focused server/live/R2 tests: seven passed.

## Explicitly not closed

- Whole-project tests are not green. The broad app run had 131 failures before focused contract repairs; baseline comparison also reproduced substantial failures. This receipt does not assert full regression acceptance.
- Manual installed-PWA acceptance with the network disconnected remains unperformed.
- New public uploads receive live metadata/sitemap handling, but automatic full Word/BOK TOC ingestion for every future upload remains to be completed. Static catalog TOCs are validated/regenerated during publication.
- Reader metadata can still expose a legacy local author identity (`/authors/local%3Ashamela-author-1292`) rather than the public canonical author link. The server HTML uses `/authors/001292`; this remaining client-link normalization is not claimed fixed.
- GitHub push is blocked by SSH authentication (`Permission denied (publickey)`). Deployment succeeded independently. The working tree contains unrelated changes, so release documentation is committed separately without sweeping them into this release commit.

The SEO/routes production publication is complete; these acceptance and follow-up items remain open.
