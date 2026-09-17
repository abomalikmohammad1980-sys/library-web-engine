# @library/source-sync-node — desktop managed-folder adapter

Real Node-side adapter for `@library/source-sync`. It owns recursive DOCX
enumeration, stat/read, and periodic reconciliation for a user-authorized managed
root. The first implementation deliberately uses a reliable polling backstop
instead of Node's recursive `fs.watch`, which can abort the Windows process on
some drives. A later Tauri/native watcher can use the same injected boundary
without changing the reconciliation semantics. It emits platform-neutral raw
events consumed by the core package.

It does not own persistence, authentication, upload, conversion, R2/API, or UI.
It never follows symlinks and never accepts an absolute/escaping logical path.
Low-level I/O is injectable; acceptance tests also exercise the default adapter
against a real temporary directory.

## Authoritative Word page maps

Production configuration also requires `wordPageMapEndpoint` and a positive
`maxWordPageMapBytes`. The endpoint is internal HTTPS or loopback and uses the
same build-service token source, never a browser/user token. `remote-check`
performs an authenticated HEAD. Reader builds fail retryably when the service is
unavailable; they do not publish an estimated map or replace the prior complete
manifest. A successful reader artifact records the immutable DOCX edition/hash
and Microsoft Word map fingerprint/page count in the atomic manifest.

## Installable binary

`pnpm build` emits a standalone ESM `dist/cli-main.js` with a Node shebang and a
standalone `dist/index.js`; the package allowlist ships only `dist` and this
specification. `pnpm verify:installability` packs and installs the tarball in a
fresh temporary project, then exercises config/provision/remote cold starts.

## Finite runtime pressure controls

The executable JSON configuration may set these optional limits:

```json
{
  "maxConcurrentPaths": 4,
  "outboxBatchSize": 5,
  "buildBatchSize": 5,
  "shutdownTimeoutMs": 10000,
  "contentScrubEveryReconciliations": 60,
  "contentScrubBatchSize": 4
}
```

- `maxConcurrentPaths` is 1–64 and bounds simultaneous stable reads/hashes.
- `outboxBatchSize` and `buildBatchSize` are 1–1000 and bound one worker pass.
- `shutdownTimeoutMs` is 1–120000 and bounds service stop; durable reconciliation
  recovers watcher hints that were deliberately dropped from memory.
- `contentScrubEveryReconciliations` is 1–1000000. Cheap metadata reconciliation
  runs normally; only each Nth pass schedules a bounded content hash scrub.
- `contentScrubBatchSize` is 1–1000. Selection rotates by mapping id so a large
  library is covered fairly without hashing every book or starving watcher work.

Absent values resolve to the conservative values shown above. Invalid or
unbounded values fail configuration validation before the watcher, network
client, or workers start. These bounds throttle work; they never truncate the
durable outbox, discard a distinct source fingerprint, or overwrite a conflict.
