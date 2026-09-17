# Isolated ingestion cloud run — 17 September 2026

This is an isolated acceptance receipt, not production acceptance.

- Pages project: `khizana-bok-acceptance-20260917`.
- Deployment: `47d54d56.khizana-bok-acceptance-20260917.pages.dev`.
- D1: `9133fe99-c4e1-4a1e-84f3-127735883279`.
- R2: `khizana-ingestion-acceptance-20260917` (created separately).
- Applied missing migrations0027,0033,0035 only to isolated D1.
- Synthetic fixture: `00000000-codex-ingestion-acceptance`,48-byte text.
- Dedicated test secret generated in process memory, piped into isolated Pages;
  never printed, committed, or saved in a local credential file.
- No production migration or ingestion activation performed.

## First actual execution

Claim succeeded, but ready assertion failed. Read-only D1 diagnosis:

| Signal | Value |
|---|---|
| search rows |4|
| staging next_row |0|
| search receipt |absent|
| job checkpoint |0|
| job state |queued|
| attempts |1|

The rows were written but progress was rejected: local SQLite change-count
assumptions do not establish real D1 behavior with FTS/epoch triggers.
Search agent owns row-returning verification; ingestion agent owns activation
and lifecycle change guards. Rerun required after regression tests and rebuild.

## Execution notes

Run D1 commands from `alpha-publish` with the explicit account ID. Artifact-cwd
attempts returned7403; read-only account listing and queries from alpha succeeded.
Pages rejects a custom `--config` path: deploy from the actual artifact directory.
The rejected attempt did not deploy code. No broad OAuth credential moved into
GitHub Actions; its production runner remains disabled pending acceptance.

## Successful rerun

Deployment `a958f496.khizana-bok-acceptance-20260917.pages.dev` passed:
`claimed=1`, `ready=1`, `failed=0`, `searchHits=2`. Source retrieval, real bounded
text extraction, immutable artifact verification, D1 FTS activation and public
search were exercised end-to-end. This is one synthetic text fixture, not cloud
acceptance of every format or large/multipart books.

After the D1 trigger-count repair, the combined local server/extraction/SEO
suite passed68 tests,0 failures,0 skips.

## Restricted Actions setup

Dedicated `PUBLIC_BOOK_INDEX_RUNNER_TOKEN` configured in the NEW GitHub
repository and khezana Pages via memory/stdin only. No broad account token,
database credential or R2 credential transferred to GitHub. Verified repository
variables `PUBLIC_BOOK_INGESTION_ENABLED=false` and
`PUBLIC_BOOK_INGESTION_ACCEPTED=false`. Workflow activation is still pending
the combined live deployment; configuring the secret does not publish code.
