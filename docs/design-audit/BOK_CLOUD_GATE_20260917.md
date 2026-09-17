# BOK isolated cloud acceptance and atomic pointer

## Scope and resources

User explicitly approved a separate project/database without a paid upgrade.

- Pages: `khizana-bok-acceptance-20260917` (branch `isolated`).
- D1: `khizana-bok-acceptance-20260917`, ID `9133fe99-c4e1-4a1e-84f3-127735883279`.
- Neither the production D1 nor R2 is bound. No production test data, source edits, subscription changes or public activation.
- Synthetic account uses the actual hashed access-session/device tables, editorial capability and one-hour expiry. `ACCOUNT_TEST_MODE` is absent. The session was explicitly revoked after endpoint acceptance; the real endpoint returned 403 afterward.
- Private session fixture and seed SQL are local artifacts only; **never commit** them. No credentials occur in reports.

## Evidence

`.artifacts/bok-cloud-acceptance-20260917/receipt.json` records nine successful real HTTPS checks: absent session denied, cross-site write denied, authorized save, authenticated preflight, stale write 409, atomic synthetic pointer update, stale CAS refusal, unified reader/search descriptor, changed-draft preflight refusal.

`revocation-receipt.json` records revoked session 403. Three additional local SQLite tests in `tools/bok-activation-pointer.test.mjs` cover all authority predicates, edits immediately before activation, immutable releases, stale generations and audit-failure rollback. Existing five handler tests still pass.

`reader-search-receipt.json` also passed with **19 real HTTPS requests**. The actual `ShamelaSearchV2Client` and `materializeShamelaPackBook` consume the two-book packed fixture from Cloudflare: old word present before correction, new word present afterward and matching reader text, old word absent afterward, untouched second book remains searchable. The actual annotation revalidator preserves bookmarks/notes and the surviving unique quote; the removed quote is retained with review-required marking. This is executable consumer acceptance, not manual browser rendering or full-library coverage.

Direct Pages asset serving initially ignored Range and the strict client correctly rejected it. The isolated Worker supplies a **2 KiB-capped fixture-only range adapter** for the 682-byte synthetic archives; the client was not weakened. This therefore verifies cloud delivery through that adapter, not production R2/Pages range behavior. Latest isolated deployment: `https://e2b6ef35.khizana-bok-acceptance-20260917.pages.dev`.

## Atomicity implemented, not yet wired to production

`_bok-release-pointer.js` is an internal primitive, not a public HTTP endpoint. Migration 0032 introduces immutable verified-release descriptors and ONE global library pointer. Both reader and search hashes belong to that descriptor. CAS checks expected generation and prior release, so two prepared jobs cannot silently overwrite one another.

The pointer INSERT/UPDATE statement itself checks current session expiry, device status, account block, effective editorial capability and every reviewed page's revision/base hash/exact text. The check and write share the database serialization point. Audit insertion is in the same D1 batch; failure rolls back the pointer. A revocation or edit committed before this statement denies activation; changes committed after it do not retroactively invalidate an already authorized publication. The older network preflight alone is not treated as authority.

The trusted artifact pipeline must register a descriptor only after verifying immutable reader/search artifacts, inventory hashes, full coverage and a bound cloud acceptance receipt. There is deliberately **no registration HTTP endpoint** and no user-provided `verified: true` shortcut. Synthetic descriptors seeded into the isolated test DB are test fixtures, not production evidence.

## Subsequent locally gated integration

- `tools/register-bok-verified-release.mjs` prepares operator-only SQL after streaming verification of every immutable transaction payload, the complete packed inventory, eight archive projects, unique full catalog count (at least 8594 books), exact candidate/reader text and a full-library cloud receipt bound to both candidate and transaction hashes. It performs **zero remote writes** and rejects the existing two-book receipt. There is no public artifact-registration endpoint.
- GET `/api/library/bok-release` resolves the one descriptor, returns `null` while disabled, and refuses arbitrary artifact URLs. Public roots must be `/library/bok-releases/<release SHA>`.
- `app/src/bok_active_release.ts` pins one immutable descriptor for the document lifetime; errors fail closed. Both `ensureShamelaBookReady` and `ShamelaSearchV2Client` now consume it when the explicit client flag `__BOK_RELEASES_ENABLED__` is true. Reader manifest and packed search manifest SHA are verified against this same descriptor. Normal disabled operation adds zero requests.
- Reader overlays corrected entries only after central visibility checks, reuses existing metadata and invokes the existing annotation-safe hydration. Neither original source nor account annotations are bypassed.
- CAS rollback to a verified older descriptor also increments the generation and is audited; stale generation cannot overwrite it. Local pointer tests exercise this rollback.

`pinned-reader-search-receipt.json` subsequently passed **21 HTTPS requests** through the new production resolver/pinning code on the isolated cloud fixture. The real GET endpoint supplied a fixed-root descriptor and reader-manifest SHA; actual search consumed that descriptor's packed manifest despite a different legacy global configuration. Latest test deployment: `https://bd4a3e87.khizana-bok-acceptance-20260917.pages.dev`. The separate synthetic descriptor was operator-seeded only in the isolated DB; it is not a production registration or full-library receipt. Five pinning unit tests and nine Node handler/CAS/registration-gate tests pass; app typecheck passes.

Remaining integration/activation gates:

1. Build and upload a real corrected full-library transaction and run the full-library cloud acceptance required by the implemented registration tool. That receipt does not yet exist.
2. Test the newly wired client descriptor path on cloud with the real transaction (the earlier two-book test used the actual consumers directly, not the descriptor hook). Ensure separated-field overlay matches the new packed identity; never reuse a mismatched field overlay.
3. Preserve the current baseline in a verified descriptor and verify full-library unchanged segments and rollback. Two-book fixture coverage is not full-library coverage.
4. Only then enable `BOK_RELEASE_ACTIVATION_ENABLED`; currently absent/disabled in production. Initial internal primitive supports Access-session auth only and fails closed for unsupported auth modes.

## Production draft metadata and operational audit

Read-only D1 audit on 2026-09-17: `bok_text_drafts` exists but contains **0 pages / 0 books**; `bok_text_draft_history` contains **0 entries**. No source text was queried or changed. Release-pointer/verified-release tables are not yet migrated on production.

The admin launch in `screens/admin_books.ts` still requires `import.meta.env.DEV`. `bok_text_editor.ts` provides “تجهيز مرشح النص والبحث”, which rechecks reviewed drafts and **downloads a JSON candidate only**. It does not submit a server build job, upload a complete immutable release or activate a pointer. Therefore BOK is **not operationally complete**, and absence of a user draft is not the only missing item. The tools are prepared for the first genuine reviewed draft; production editorial availability and a trusted operator/build job remain to be connected and accepted. Do not manufacture a correction to a real book merely to pass this gate.

### Subsequent repair of editorial access and durable requests

The above describes the audited baseline, not the new local implementation. The DEV-only launch has now been replaced with `bok_editor_launch.ts`, which requests authenticated server capabilities and retains the existing editorial/session checks. Production can expose the editor after the server editing flag is deliberately enabled; no account is granted permissions by this change.

`admin/bok-publication.js` and migration **0034** now support durable reviewed requests and owner-scoped status retrieval. The request snapshots exact reviewed page text/base hash/revision, checks current native or Access session/device/editor capability and all draft revisions in the INSERT, and deduplicates retrying the same request ID. The UI offers “طلب نشر التصحيحات” only when the server submission flag allows it. Jobs are explicitly `awaiting_operator`, NOT published. A refresh control can retrieve the latest persisted job after reopening the editor.

The deployed isolated endpoint passed capability, 202 creation, idempotent replay, durable GET status and stale-review 409 tests; evidence `jobs-receipt.json`. Three Node job tests cover native sessions and revocation between initial auth and INSERT; three client tests cover server flags, identity changes and truthful queued status. Existing editor tests and app typecheck pass.

**Still missing operationally:** an enabled trusted job runner/schedule to claim these requests, build/upload the complete release and submit the verified descriptor for atomic activation. The queue does not silently do this, and no automatic publication is claimed. `BOK_TEXT_EDITING_ENABLED`, `BOK_PUBLICATION_JOBS_ENABLED` and client/activation flags were not enabled on production.

### Regression classification

The three `shamela_search_environment.test.ts` failures were rerun against the frozen batch33 search implementation using `tools/bok-baseline-search-environment.config.ts`: **same 3 failures / 6 passes**. Evidence `search-baseline-tests.json`. Frozen code already uses the 2000 ms optional-local timeout while the stale source assertion expects 700 ms; ignored-Range cancellation and smallest-anchor-count assertions also fail against frozen code. They are not introduced by BOK pinning. Search owner was notified; this is classification, not dismissal or a claim that those regressions are fixed.

## Cleanup

Session already revoked. Retain isolated project/database while acceptance integration continues. After parent approval, export non-secret receipts, delete **only** the named isolated Pages project and D1 ID above; never use production names. The fixture project has no custom domain, mail, R2, cron or paid service. Rebuild fixture artifacts with a new run directory/session for another authenticated run rather than replaying old seed rows.
