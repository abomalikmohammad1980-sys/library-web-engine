# Extraction runtime closure: local isolated proof

## Result

Ten tests passed in a separate source tree at `D:/alkhizana/.artifacts/ingestion-clean-runtime-20260917`, outside the repository's node_modules ancestry. The Word model was freshly compiled there; no existing dist output was copied. The tree contains only the explicit extraction source closure, package metadata, workflow files and tracked server helper mirrors. It has no repository data, accounts, tokens or artifact fallback directories.

Installed packages were reused via junctions to **declared package dependencies only** (app dependencies, Word model dependencies, pinned jsdom runtime). This is an isolated source/dependency-resolution check on Windows, not a fresh package download or Linux GitHub Actions execution. Initial attempts exposed the local installation's flattened dependencies; the isolated package roots were populated with their declared dependencies rather than falling back to the repository root.

## Actual defect fixed

The new EPUB adapter/test initially imported fflate from the tools/root package, which does not declare it. They now use createRequire at app/package.json, where fflate is declared. App's existing EPUB parser remains unchanged. No new dependency or lockfile modification is needed.

## Workflow closure

Both legacy workflow restore steps and the targeted workflow restore all executor/worker server imports: jobs, Word safety, PDF classification policy, public search helper and event outbox helper. Runtime tests enumerate these imports and check the restore commands. The dedicated runtime installs pinned jsdom with npm ci; the workspace installs with pnpm frozen lockfile and builds only the Word model.

PDF remains bookmarks-only, including when obsolete PDF_TEXT_INDEXING=true is supplied. Tests cover generated text/scanned PDFs, native EPUB2/EPUB3 TOCs, Markdown, UTF8 and Word map anchors. No OCR is run. Targeted runner uses exact book ID/content version with one-job execution and no global fallback.

## Remaining proof

Commit all reviewed files plus the companion event-outbox migration/helper and targeted workflow before invoking Actions. The previous 79-test regression passed locally; isolated runtime/EPUB tests passed 10/10. A fresh Linux Actions run and actual targeted cloud acceptance remain separate gates; this report does not claim either occurred.
