# Search admission — positional negative filter

Production remains batch41 (`151af741`). No production admission is recorded here.

The phrase `ألا إن سلعة الله` has 16,252 anchor documents. Its other
exact-word postings exceed the existing 16 MiB client threshold. Consequently
the old path hydrates thousands of unrelated snippet buckets.

An optional, release-bound positional Bloom filter can reject impossible anchor
positions. Positive candidates still undergo the existing original-text phrase
verification. It neither supplies results nor claims an exact count itself.
The implementation accepts general word descriptors; the initial derived asset
covers normalized `الا`, not every word or query. Missing descriptors preserve
the existing path. Wrong release/term SHA or corrupt bytes reject the filter.

The complete original posting was SHA-verified by the existing client. All
5,024,557 positions were inserted and checked again: zero false negatives.
Original term bytes: 126,521,681; derived bytes: 10,049,114 in ten SHA-verified
chunks, with a second whole-filter hash. No original archive was overwritten.
Conditional immutable R2 writes were read back and verified (11 objects).

Independent local intersection yielded 345 exact candidate documents; the
filter retained 356, including every exact candidate. The 11 extra candidates
are intentional false positives and are checked against original text.
The actual local client with pinned snippet recovery returned 521 occurrences,
100 results on pages one and two and one final result, complete coverage, in
7,713 ms. This is not an internet performance claim.

34 related tests, three server tests, TypeScript and the batch51 build passed.
Batch51 preview: https://4c062e5e.khezana.pages.dev ; 126 asset SHA checks and
SEO HTTP checks passed. First-page native internet probe returned 100 hits
in 42,229 ms. Full network probes still failed (deadline/connection failures).
Browser acceptance failed with `shamela_search_v2_term_network_timeout`.
Therefore batch51 is NOT approved for production.

The batch wrapper was subsequently corrected to leave term-directory responses
streaming: their idle-progress watchdog must not wait for an entire batch to
finish before observing any bytes. This change is not in frozen batch51.
The near-full-page cohort fix keeps 64 candidates in flight instead of shrinking
to one when 99 of 100 results have been found; its dedicated regression passes.

After preserving streamed term directories, the unmodified current client
completed the native internet full-result probe in 69,701 ms: total 521, first
page 100, 260 requests including 176 transport batches. Batch52 rebuild is for
the subsequent actual-browser gate; this probe alone does not admit production.

Batch52 browser revealed the remaining unit mismatch: the store requested a
progressive occurrence page (100 hits), then grouped it into only 52 paragraphs,
while presenting the candidate count 356 as the pagination boundary. This is
not accepted. Phrase searches now finish the scan before computing the exact
occurrence total and group paragraphs BEFORE pagination. `totalDocuments`
drives page boundaries; `total` remains the occurrence count. Sunnah exhaustive
occurrence paging and the bounded single-word path are unchanged.

Actual local client paragraph audit: 521 occurrences in 258 unique paragraphs,
pages 100/100/58, summed occurrence counts 521, no duplicate/lost paragraphs.
34 tests across 11 affected search/store/table suites pass. Batch53 is the
browser candidate for this correction; not an admission record.

Batch53 actual in-app browser eventually displayed the complete count 521,
paragraph ranges 1–100 / 101–200 / 201–258 and three pages. Next, direct jump
to page three, and Previous back to page two succeeded; DOM row count on page
two was 100. No partial-coverage warning remained. The first cold attempt
logged `search_state_changed` then `search_ui_timeout`; existing automatic
recovery completed without a manual retry. Cold-start speed is NOT closed.
Book 151179 opened with its text, author, 1,350 headings and reader toolbar.

The heading-only browser check found preview HTTP503: the immutable heading
GET handler used isolated LIBRARY_R2 instead of PUBLIC_LIBRARY_R2. Batch54
changes that handler only, using the public binding locally without mutating
env or any account/upload route. A test checks GET binding selection, rejected
POST and unchanged original env. All batch53/batch54 asset SHAs are identical
except sw.js; the only function difference is that read-only heading handler.
Thus paragraph/browser evidence transfers by exact unchanged client/server
bytes; the heading route requires its own fresh browser check before admission.

Evidence: `.artifacts/position-filter-audit.json`,
`.artifacts/position-filter-upload.json`, `release-artifacts/position-filter-9d4f7e33a94719966a2efdbc43a43e60e9b45216c5d953a763571b0a3e5667c4/proof.json`,
`.artifacts/batch51/preview-assets.json`, `.artifacts/batch51/preview-http.json`.
