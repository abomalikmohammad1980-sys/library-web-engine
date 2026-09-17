# Targeted GitHub Actions extractor coordinator — disabled preview

Bootstrap deployed 2026-09-17 as `khizana-book-index-actions-preview`, version `490d78df-cdca-4634-ab74-9054e08d8adb`. No public routes, workers.dev, preview URL, triggers or consumers. `BOOK_INDEX_ACTIONS_ENABLED=false`. Only isolated acceptance D1 is bound. No production change, no migration or credential was applied by this bootstrap. Five coordinator tests and deployment dry-run passed. Secret entry and cloud acceptance remain outstanding.

Fixed repository: `abomalikmohammad1980-sys/library-web-engine`. Fixed workflow: `public-book-ingestion-targeted.yml`, ref `main`. No user-supplied repository, workflow, ref, API URL or shell command.

Queue worker's `EXTRACTOR` service binding must point to this private Worker (no public routes, workers.dev or preview URL). It accepts only POST `https://extractor.internal/internal/public-book-extract` with the exact validated book/version/upsert envelope. Current authoritative public eligibility is checked before dispatch. A disabled gate, missing fine-grained token, private/stale event or invalid body causes no GitHub request.

## Required settings, not configured here

- Isolated preview D1 binding is configured; reviewed0041 migration plus earlier migrations must be verified/applied before enabling. Bootstrap does not imply schema acceptance.
- Worker secret `GITHUB_ACTIONS_TOKEN`: **fine-grained PAT restricted to this repository, Actions(write)**. Prefix screening rejects classic/OAuth tokens; actual permission scope still must be inspected during secure setup. No token is in source or tests. Test tokens are fabricated strings.
- Worker gate `BOOK_INDEX_ACTIONS_ENABLED=true`, only after isolated acceptance.
- GitHub variable `BOOK_INDEX_TARGETED_ACTIONS_ENABLED=true` AND existing `PUBLIC_BOOK_INGESTION_ACCEPTED=true`. Workflow default skip is deliberate. New workflow is manual dispatch only,12-minute maximum, pinned actions, `contents:read`, checkout credentials not persisted.
- Existing dedicated `PUBLIC_BOOK_INDEX_RUNNER_TOKEN` remains the only cloud credential in workflow. Do not copy Cloudflare OAuth, SQL/R2 credentials or coordinator GitHub token into its environment.
- Targeted workflow pins gateway origin to the existing isolated acceptance Pages hostname. Production requires a separately reviewed explicit origin change and user approval. It cannot take origin from dispatch inputs.
- Existing legacy periodic drain must be disabled while targeted Queue scheduling is on. Target gateway requires `PUBLIC_BOOK_TARGETED_ONLY=true`; no untargeted fallback permitted.

## Contract

API version2026-03-10 is pinned. Dispatch200 requires positive safe `workflow_run_id`. Legacy204 is accepted without an ID, deduplicated for30minutes, then considered failed if no verified D1 receipt appeared. Run polling is fixed to the same repository/run ID; response repository identity must match. Completed Actions status alone never reports success: exact ready job+FTS evidence is required. Pending startup/polling has a two-hour deadline and bounded5 dispatch attempts. Body limits are2KiB input,16KiB dispatch response,64KiB run response; requests timeout10seconds and reject redirects.

An ambiguous network failure can dispatch twice (no distributed transaction spans GitHub+D1). Book-specific extraction leases fence duplicate runs. Durable ledger is keyed by book+publication version; old messages cannot claim another book. Source data never travels through workflow inputs.

Latest PDF instruction: **bookmarks only, no PDF body search or OCR execution**. A scanned PDF's verified bookmark receipt is a successful job; admin `ocr_pending` is a future-feature label, not an extraction failure. Coordinator/Queue success checks use base ready+FTS receipt so that future label does not cause repeated retries.

Tests use injected HTTP stubs and actual SQLite migrations; no external dispatch occurs. A real clean-Linux targeted workflow + isolated Queue→coordinator→Actions→gateway→search proof remains required before activation.
