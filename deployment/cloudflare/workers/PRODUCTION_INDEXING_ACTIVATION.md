# Production indexing: prepared, disabled, not deployed

Production D1 identity is copied from both `alpha-publish/wrangler.toml` and the published batch34 `deploy/wrangler.toml`: `khezana-visitors`, `aeb2bf7d-bfc5-4ec1-9ef5-a81371efe800`. No resource identifiers were guessed. Production Worker/Queue **names are proposed deployment targets**, not a claim that these resources exist.

Separate files:

- `book-index-actions/wrangler.production.jsonc` → private coordinator `khizana-book-index-actions-production`, fixed production workflow entrypoint.
- `book-index-jobs/wrangler.production.jsonc` → private jobs worker `khizana-book-index-jobs-production`, queues `book-index-jobs` / `book-index-jobs-dlq`, service binding to production coordinator.
- `.github/workflows/public-book-ingestion-production.yml` → manual dispatch only, fixed repository/main and `https://khzanah.com`, separate gates and secret from preview.

All Worker gates are false in committed configuration. Workflow requires both previously unset `BOOK_INDEX_PRODUCTION_ACTIONS_ENABLED=true` and `PUBLIC_BOOK_PRODUCTION_INGESTION_ACCEPTED=true`. Missing variables leave it disabled. No preview workflow/token changes are needed.

## Least privileges / secret separation

- GitHub runner gets only `PUBLIC_BOOK_INDEX_PRODUCTION_RUNNER_TOKEN`, a NEW dedicated production gateway secret; never reuse the preview gateway token.
- The existing gateway expects its environment key `PUBLIC_BOOK_INDEX_RUNNER_TOKEN`; install the new production value under that name in production Pages only, and under `PUBLIC_BOOK_INDEX_PRODUCTION_RUNNER_TOKEN` in GitHub. Values are not stored here.
- Production coordinator gets a separately installed fine-grained `GITHUB_ACTIONS_TOKEN`: Actions write scoped to the single new repository. Do not export general CLI OAuth, D1 edit keys, or R2 credentials into Actions.
- GitHub workflow token has contents read only, checkout credentials not persisted, no PR/schedule secret execution, no interpolated shell inputs, and a single book/version per run.
- Neither Worker requires an R2 binding. The existing authenticated Pages gateway alone reads claimed current-public sources through its server-side binding.
- Workers have no public route, workers.dev or preview URL. Cross-service calls use bindings.

## Required reviewed sequence (not executed by preparation)

1. Complete isolated acceptance and explicit production release authorization. Audit the actual production schema; do not infer missing migrations from the isolated subset. Record a D1 Time Travel restore point (FTS can prevent normal SQL export).
2. Confirm/create the two production queues and deploy both production workers disabled using their explicit `--config .../wrangler.production.jsonc` paths. Never deploy the preview config against production.
3. Commit/push the reviewed production workflow, install separately scoped secrets, keep production workflow gates false.
4. Apply only verified-missing migrations as one reviewed release plan. Publish the reviewed Pages build with production `BOOK_INDEX_WAKE` service binding to `khizana-book-index-jobs-production`. Preserve existing production bindings; do not replace Pages config with the stripped acceptance harness.
5. Require `PUBLIC_BOOK_TARGETED_ONLY=true` on the production gateway; never let the legacy global ingestion workflow share the production credential. Enable schema-dependent ingestion/search/events flags only after schema and reader acceptance.
6. Enable production workflow gates, then coordinator, then Queue delivery. Keep IndexNow disabled until its key route/privacy acceptance is complete. Check exact book/version receipts and public consumers before broad backlog processing.
7. Rollback first disables Queue and Actions gates; do not turn off live visibility/withdrawal checks or restore an old public index blindly. Preserve outbox state for safe resume.

No production migration, deployment, resource creation, secret read, or credential installation is performed by these files/tests. They are configuration preparation, not release acceptance.
