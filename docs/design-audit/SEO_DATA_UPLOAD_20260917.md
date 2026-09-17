# SEO Stage A immutable transfer tool

Prepared and locally tested only. No remote upload, activation, deployment, or commit performed by this task.

Source: `.artifacts/seo-data-stage-a-20260917-v1`. Descriptor SHA-256: `3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c`. Target existing bucket: `khzanah-library`. Total: 515 immutable objects including descriptor, 15,637,665 bytes. Descriptor is uploaded last to `seo/descriptors/<sha>.json`; this does not alter a live pointer.

Dry run (default): `node tools/seo-data-upload.mjs`. This checks every file size/SHA, descriptor pin, identity pack membership, aggregate listing release hash, and realpath containment. It writes no state and reads no credentials.

Explicit execution, run by the same Windows user on every invocation:

```
node tools/seo-data-upload.mjs --execute --max-objects 515 --max-bytes 20000000 --max-seconds 1800
node tools/seo-data-upload.mjs --execute --max-objects 515 --max-bytes 20000000 --max-seconds 1800 --fresh-verify true
```

The first command is resumable using `.artifacts/seo-data-transfer-<descriptor-sha>/journal.json`; partial bounded runs can use smaller limits. A request must allow the largest object (9,451,856 bytes). Transfer receipts remain `complete:false` until a separate full fresh readback verifies every object. Fresh verification never repairs missing objects or trusts a previous receipt. On any error rerun transfer, then fresh verification. Existing different bytes are never overwritten. Writes use conditional `If-None-Match:*`, including race readback on 412. Every transferred object is read back and checksummed. Local files are rechecked even on resumed jobs.

Credentials use the existing reviewed `parseR2Config` helper, reading only the configured local rclone `[r2]` entry during explicit execution. Errors use the existing redacted `safeFailure`; no credential value, response body, or raw SDK error is logged. The new transport accepts only the exact planned SEO keys, uses request/run timeouts, bounded bodies, and the fixed approved bucket. It has no delete/list capability. Failure stops safely; subsequent invocations resume.

Validation: 5/5 tests passed in `tools/seo-data-upload.test.mjs` covering actual full local package, default dry run, bounded resume, fresh readback, corrupt/missing remote objects, non-overwrite, local revalidation, and abort. No real S3 network operation has been tested in this task; remote verification remains required before candidate activation.
