# Remaining sweep — incomplete, not a release receipt

Full Vitest report `.artifacts/remaining-suite-20260918.json`: 4748 total, 4563 passed, 101 failed, 84 pending. No claim of a green full suite. Do not confuse failed source-string expectations with confirmed runtime faults.

Resolved and rerun:
- Normalized paragraph-cache tests used an obsolete raw-source fingerprint, invalidating their supposedly reusable cache. Updated fixtures to the real revision-aware fingerprint; both quota/stalled optional-write checks pass without reparsing Word.
- Complete-library catalog tests omitted visibility-override exports added to the real module. Restored the mock contract; all3 pass, retaining strict incomplete-catalog rejection and identity-switch isolation.
- Source-edition assets now read verified published packs when loose local JSON is absent. 29 tests pass; SHA-256 and byte length checked before parsing, no missing-fixture skip. Count reflects17 non-shuoun editions plus installed shuoun editions. Default fallback is the frozen batch55 asset tree; KHIZANA_TAFSIR_ASSET_ROOT can specify an explicit verified fixture root.
- Resource registry had a stale pack checksum and falsely marked the already-published fi-zilal pack absent. Independently verified all798 surah payloads across7 books against the deployed batch55 manifest. Updated registry checksum, mapping and installed status, preserving source texts. Four manifest/registry tests pass. This metadata change must be explicitly included in the next deployment, not dropped by client-only staging.

Author lookup harness now supplies the actual display-name projection dependency and preserves the original-name alias; all6 checks pass. Combined targeted run:56 tests passed. App TypeScript check passed. Other failures remain to triage. Next full run, frozen-candidate build, preview/live checks and deployment are not yet completed. Existing production remains batch55.

Unshipped implementation work also includes original BOK central upload (e6ad9c5), exact Mathoor label (d0f7983), three-column compact Quran mode selector, and immutable packed archive reuse/streaming transaction staging. The latter passed a two-book reader/search cycle only and does not close full-library BOK cloud acceptance.
