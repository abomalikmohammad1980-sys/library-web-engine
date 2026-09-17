# Independent edition lookup: 151179

Root cause confirmed against the frozen batch33 assets: `page_meta_model.ts`
defines 8 SEO shards and puts book 151179 in `books-03.json` (573,948 bytes).
The edition handler independently used modulo 64, requesting absent
`books-11.json`. This explains why 21633 worked while 151179 returned 404.

The handler now imports the same `seoShard` function used by the page metadata
API. No source text, publication permissions or relationship records change.
The existing 1 MiB streaming bound is retained.

Seven SQLite handler tests pass, including a new regression for public source
ID 151179 and internal reader ID 410151179, linking an owned PDF, and refusing
the book after its legacy alias is centrally hidden. This is local acceptance;
the fix is not yet deployed. Batch33 remains the live release.

Search continuation was found not running and restarted with its existing
verified receipts, rather than accepting the unfinished window 713–722.
It must finish all windows plus the legacy reproof before coverage is declared
complete. Consumer fixtures: 20 tests passed. BOK authenticated handler:
5 tests passed; this still does not establish cloud activation acceptance.
