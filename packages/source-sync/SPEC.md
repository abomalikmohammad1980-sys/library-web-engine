# @library/source-sync — boundary contract

Pure, platform-neutral primitives for treating a Word source file as an immutable,
versioned source of truth.

## Owns

- Source revision and fingerprint data contracts.
- Normalization of adapter-provided watcher events.
- Deterministic debounce/stability candidate state.
- SHA-256 fingerprints over caller-provided bytes.
- Pure idempotent/optimistic revision decisions.
- Managed source mappings and reconciliation over adapter observations.
- Durable outbox leasing/transitions and persistence ports with CAS semantics.
- Guarded candidate preparation (pre/post snapshot + SHA-256).
- Build/manifest readiness and one atomic publication pointer-swap decision.
- Revision lifecycle and quarantine transition rules.
- DOCX build/publication requires a source-matching authoritative Microsoft Word
  page map. Estimated-preview consent is private, CAS-bound, and never grants
  fidelity or public publication; public publication uses a separate approval.

## Does not own

- Filesystem APIs, timers, browser permissions, Tauri commands, or OS watchers.
- Network, D1/R2, authentication, persistence, conversion, or publication.
- DOCX parsing or any OOXML/rendering behavior.

Platform adapters sample files and feed logical events/snapshots into this package.
Persistence and backend implementations consume its decisions through their own
explicit boundaries.
