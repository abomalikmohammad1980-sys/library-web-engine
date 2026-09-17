# Field-separated search: explicit release wiring

Status: implemented and locally tested, **not activated on production**.

## Release gate

`globalThis.__KHIZANA_SEARCH_FIELDS__` must be injected by a reviewed deployment,
with `complete: true`, `manifestUrl`, SHA-256 pins `manifestSha256`,
`sourceIndexSha256`, `packedManifestSha256`, `packedReleaseId`, `expectedBooks`,
and `expectedSegments`. No local-storage toggle or inferred artifact path is used.
Absence preserves the existing default and local-only structural-search path.
Malformed configuration fails closed. No production configuration was added.

The V2 consumer verifies the exact packed release identity, full coverage and
counts, then loads checksum-verified per-book boundaries before filtering
postings. The search screen exposes field selection only with a valid explicit
configuration (or the existing preview option).

## Integration and pagination

Global/central body-only or footnote-only searches now call the explicit
`searchSeparatedV2` adapter. They never fall back to unsplit text. Local Word/
text structural matches remain available and are merged by author chronology
before slicing the requested page. Central reads collect the prefix needed
for the requested merged page, in batches no larger than 500. Queries with
exclusions consume the scoped stream before reporting filtered counts.

`totalDocuments` is separate from repeated word occurrences. Page jumps use
document totals, while the result summary retains occurrence counts.
The default UI page size remains 100. A 1300-paragraph regression proves all
13 pages reachable with no duplicates or dropped rows, including a local/
central merge boundary test.

## Verification

- App TypeScript check passed.
- 58 focused tests across 15 files passed, plus the added full-stream exclusion
  regression (59 total; field consumers, configuration,
  global/local integration, metadata gates, heading integration and UI contracts).
- 13 proof/receipt/resource-policy/partition tests passed.
- Provider timeout/cancellation tests passed separately (4 tests).
- Existing partial real artifact loader validated 130 books without declaring
  full coverage.
- Added opt-in full-artifact validation in `search_field_overlay.real.test.ts`:
  set `KHIZANA_FULL_FIELD_OVERLAY` to the complete candidate directory. It
  verifies every book via the actual consumer and rejects a missing/partial
  candidate. **Executed successfully at 2026-09-17 12:52:** both real-artifact
  tests passed; all 8,594 complete-corpus books were loaded and verified by the
  actual consumer in 10.875 seconds (local validation, not query latency).

### Full proof artifact

- Directory: `.artifacts/field-overlay-full-proof-1789638689620`.
- Manifest SHA-256: `a81347caaabbdb907b29fe2b4f8309be801c47d41cd051cc99c438e043eb1613`.
- Source index SHA-256: `a88f1f13ac8f8fd62162b1fa631fd7652874408ac639ab7976984eb034b73381`.
- `coverageComplete=true`, `activated=false`.
- 860/860 segments; 8,594 books; 7,626,594 documents; 1,589,552,709 positions.
- Both continuation summaries finish with `remaining_windows_verified`.
- Per-book payloads total 183,625,845 bytes; largest payload 2,896,203 bytes.
- The corpus contains 8,595 files including its manifest; publish to suitable
  immutable data storage rather than exceeding the main Pages file budget.

### Upload execution identity

`node tools/field-overlay-upload-cli.mjs --plan` only prints a verified local
summary. It creates no state files, even on failure, and reads no credentials.
Every `--execute` invocation must run as the same Windows user, outside the
sandbox identity, to preserve atomic journal replacement permissions.
Execution state is `.artifacts/field-overlay-transfer-<manifest SHA>`.
The earlier sandbox-owned `.artifacts/field-overlay-upload-<manifest SHA>`
planning directory is preserved and is not used or deleted. No broad ACL change
is required. No remote upload occurred during the original local-plan failure.

## Remaining release work

1. Publish the immutable overlay assets and inject the exact reviewed pins.
2. Verify body/foot separation, mixed pagination and cancellation against the
   deployed candidate before updating any production pointer.

This change does not assert improved latency or live activation. Full-corpus
proof and local consumer verification are complete for the 8594-book Shamelah release; missing local
structural sources remain explicit incomplete coverage, never false zeroes.

## Bounded recovery for source 148870 / segment 846

The first monolithic preparation hit its existing 600-second limit while
normalizing the 30125-page, 93.8 MB source book. The failure receipt was retained.
`tools/field-source-chunks.mjs` derives at most 1000 pages per isolated process,
using the unchanged frozen normalizer and whole-offset derivation. Completed
chunks are bound to original source SHA, generator SHA, boundary SHA, page
coverage and individual payload hashes. Cache references are included in the
outer prepared receipt, so subsequent posting verification rechecks them.

The resumed segment prepared 40107 documents / 10614601 positions in 426
seconds with peak RSS 1.23 GB, then verified all 512 posting files in two bounded
phases. No timeout or RSS limit was increased. A 1002-page regression verifies
whole-book parity, title mapping, fallback sequence indices and tamper rejection.
This is recovery evidence for that segment, not a full-library completion claim.
