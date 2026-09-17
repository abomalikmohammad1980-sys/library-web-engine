# Isolated combined ingestion acceptance deployment

Preparation only. Root operator owns secrets, remote schema changes, object upload and deployment. No production bindings, account test mode, paid upgrade or production content. Existing `.artifacts/bok-cloud-acceptance-20260917/dist` is untouched; this deployment uses a separate directory and temporarily replaces only the isolated project's live handler.

Run `node tools/prepare-ingestion-cloud-deployment.mjs` from the repository after ingestion/search edits settle. It bundles the actual protected ingestion gateway, actual public search endpoint and public-upload SEO middleware. All responses are noindex/no-store. Other routes return an isolated-only notice. It writes no secret.

Approved identities:

- Project: `khizana-bok-acceptance-20260917`, branch `isolated`.
- D1: `9133fe99-c4e1-4a1e-84f3-127735883279`.
- R2: `khizana-ingestion-acceptance-20260917`.
- Fixture: `00000000-codex-ingestion-acceptance`; 48-byte `source.txt`.
- Config: `.artifacts/ingestion-cloud-acceptance-20260917/wrangler.jsonc`.
- Flags: `PUBLIC_BOOK_INGESTION_ENABLED=true`, `PUBLIC_BOOK_SEARCH_ENABLED=true`; no BOK activation flag.

Operator commands, from `.artifacts/ingestion-cloud-acceptance-20260917` (with account ID `db956e5187111b69e796e4a8e4c3fe36` selected and a dedicated protected runner secret already installed by root):

```powershell
$wrangler = '../../alpha-publish/node_modules/wrangler/bin/wrangler.js'
node $wrangler d1 execute VISITORS_DB --remote --command "SELECT name FROM sqlite_master WHERE name IN ('user_book_word_bundles','public_book_index_jobs','public_book_search_rows','bok_release_pointer','user_book_assets','user_book_metadata')" --json
```

Apply each following migration **only if its tables are absent**. Stop for a partial schema; do not blindly reapply non-idempotent migrations. Existing isolated BOK/PDF setup already supplied assets/metadata/BOK pointer tables; the extra prerequisite is Word bundles (0027).

```powershell
node $wrangler d1 execute VISITORS_DB --remote --file ./0027_word_book_bundles.sql --yes
node $wrangler d1 execute VISITORS_DB --remote --file ./0033_public_book_index_jobs.sql --yes
node $wrangler d1 execute VISITORS_DB --remote --file ./0035_public_book_search.sql --yes
node $wrangler d1 execute VISITORS_DB --remote --file ./seed.sql --yes
node $wrangler r2 object put khizana-ingestion-acceptance-20260917/ingestion-acceptance/source.txt --remote --file ./source.txt --content-type text/plain
node $wrangler pages deploy ./dist --project-name khizana-bok-acceptance-20260917 --branch isolated
```

Pages deployment must run from this directory so Wrangler discovers this isolated config. Do not pass Pages `--config` (unsupported). Keep the secret out of command arguments, files and logs. Then run `tools/public-book-index-cloud-acceptance.mjs` from repository root with the approved isolated origin and runner gates supplied through the parent process environment. The runner rejects any claimed identity other than the synthetic fixture.

Acceptance must separately verify public search body/card/heading fields as present in fixture, actual `/books/public/00000000-codex-ingestion-acceptance` HTML and private/pending/stale behavior. A plain text fixture with no parser-recognized headings cannot prove populated TOC HTML; local HTMLRewriter tests cover projection, and a heading-bearing isolated fixture is needed for cloud proof of that path.

The original isolated BOK deployment remains recoverable from its preserved artifact directory and previously documented deployment URLs. No remote cleanup is performed by the preparation tool.
