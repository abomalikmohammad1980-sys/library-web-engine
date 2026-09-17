# Search and automatic preparation — batch 28

## Production update and speed-work stop (2026-09-16)

The earlier pending/rejection notes below are historical. Following renewed user authorization, production deployment succeeded: `c106b186-a84c-42dd-92bb-f42d6f20469b`, https://c106b186.khezana.pages.dev, version `batch-20260916-28`. Live HTTP verification passed; the verified receipt is `.artifacts/batch28/deployment.json` and the production pointer was updated. This includes the previous automatic-indexing repairs as well as request batching.

Post-deployment primary-engine HTTP checks on khzanah.com returned the same 3616 results and identical first 40 IDs in four runs. Without batching: 7417 and 3050 ms, 55 wire requests each. With batching: 4375 and 4368 ms, 51 and 52 wire requests. Request reduction is demonstrated; a consistent latency improvement is not. These are primary-engine timings, not complete browser-render timings. Browser tools stalled, so full live UI acceptance remains unverified. The subsecond target is not achieved.

Per the user's latest instruction, stop further speed tuning and move to remaining functional issues. Started reviewing internal-list multiselect and deletion refresh. `published_grid_selection.ts` already contains selection and mutation notifications; do not report that old issue as newly fixed without reproducing its current failure. No new functional fix is claimed in this checkpoint.

Baseline: production `afa161e6-2f2b-4459-9fef-878e87534efc` (batch 27).

## Included work

- Heading range batching: combine nearby ranges for the same asset and cancellation owner; at most 64 KiB; retain each consumer's SHA proof. Unsupported batching falls back to original requests.
- Concurrent bootstrap/catalog loading and bounded 16-row lookahead.
- Count-only missing-index messages, automatic once-per-query preparation, explicit retry and refresh-results action; no fabricated complete coverage.
- Serial background preparation of locally available imported books, with identity cancellation. Remote whole-corpus indexing is not claimed.
- PDF bookmarks only, no PDF body/OCR extraction; preserve in-memory hydration return when storage fallback occurs.

## Checks before release

- 23 batching/index repair/PDF tests passed; 14 bootstrap/row-order/concurrency/remote-scope tests passed; TypeScript passed.
- Source normalizer hash is unchanged from frozen batch 27. Its pre-existing manifest source-hash test remains open, not silenced by changing the pinned hash.
- Primary-engine HTTP comparison: exact total 3616, identical first 40 IDs, 55 wire requests without batching versus 51–52 with batching. Timings were variable: 5407/3416 ms without and 3382/3406 ms with. This is not a reliable isolated latency claim.
- Clean browser production baseline, query `التوحيد` heading-only: first 40 rows at 10598 ms after instrumentation start; 63 heading-related requests. Full navigation is about 568 ms longer. Not subsecond.
- Frozen build overlays the 12 explicit source files recorded in stage.json, retaining previous data/functions and rollback snapshot.

## Acceptance pending

Preview `https://5064055c.khezana.pages.dev` passed server SEO/reader route checks (11775 sitemap URLs), heading total 4529, 40 rendered rows with identical DOM text SHA `9df8676268221f661a44f9fc7d23bbd8f21a03e45c52b5310ad0a2b73b15f6a7`, pagination 41–80, and body search (36 rendered rows). First cold preview load took 44341 ms, with two supplement asset requests taking about 29 seconds; it is not evidence of a speed acceptance. Production deployment and live measurements remain pending. The under-one-second cold full-library target is not closed.

Second preview heading navigation: 4673 ms, 40 rows, 59 heading-related requests. Preview 503s were catalog overrides/categories/author-names, native account session and visitor services, where preview bindings are intentionally absent; the function and config snapshots are unchanged from production. Do not confuse these preview service errors with heading request failures. Initial production authorization review was rejected based on superseded preview-only instructions; a re-review cites the user's newer explicit production instructions and these checks. No production success is recorded until a successful deployment receipt and live validation.

Production re-review was also rejected: it requires renewed user approval after the observed preview slowdown/503s. Stop here; do not retry indirectly. Production remains batch 27. Combined changes committed locally as `d190b46`; immutable preview remains available for review.
