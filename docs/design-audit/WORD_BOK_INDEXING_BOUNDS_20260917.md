# Public Word/BOK ingestion: bounded audit

## Implemented

Removed the additional 1 MiB compressed DOCX restriction from the extraction
worker; DOCX now shares the executor's 20 MiB source ceiling. No archive gate was
relaxed. Existing protections remain: 16 MiB per XML part, 64 MiB total XML,
256 MiB inflated archive, 4096 entries, expansion-ratio checks, entity/external
resource rejection, isolated worker memory limits and 30-second deadline.
Reader-map/source equality, duplicate-anchor rejection, 100,000-row bound and
16 MiB extracted-result ceiling remain unchanged.

Verification: `node --test tools/public-book-word-size.test.mjs` (2 passed),
`node --test tools/public-book-index-executor.test.mjs` (16 passed, 0 skipped).
The new test accepts a real DOCX archive above 2 MiB, retaining text, heading and
reader anchors. Negative cases cover oversized XML, ZIP expansion, entities and
oversized input. The executor suite includes three real BOK MIME variants.

## Coverage limits, not completed promises

- Word requires an integrity-bound reader map. Unsupported non-empty excluded
  structures (including tables/fields) fail rather than claim full coverage.
- Legacy DOC/RTF need a separately isolated conversion adapter.
- Multipart uploads currently return `multipart_adapter_required`.
- Source/result/row/time limits still exclude sufficiently large books; raising
  one compressed-size threshold does not establish support for every book.
- Uploaded raw Jet BOK uses the existing reader `parseBok` adapter and the same
  ingestion source bound. The browser parser's 200 MiB ceiling does not imply
  that the ingestion service accepts 200 MiB.
- Editorial corrections to converted/library BOK use a different durable
  publication-job/reviewed immutable-release pipeline. Its API reports
  `automaticPublication:false`; the owning agent confirms queued jobs still
  await trusted operator artifact build/verification/activation. No automatic
  builder/activation consumer was established by this change.

## Next bounded acceptance work

1. Exercise a source-bound DOCX plus verified map through isolated cloud ingestion.
2. Add explicit per-format unsupported/oversized diagnostics without false ready.
3. Design resumable large/multipart extraction with bounded pages and preserved
   anchors before increasing shared limits; separately cover excluded Word
   structures with the reader's semantics.
4. Close editorial BOK's reviewed-builder consumer and activation evidence as a
   separate task; do not equate it with uploaded raw BOK indexing.

No deployment, remote mutation or commit performed in this audit.
