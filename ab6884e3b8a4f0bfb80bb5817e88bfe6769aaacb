# ADR-0012: Shared DOCX intake validation and quarantine

- Status: Accepted
- Date: 2026-08-08

## Decision

A shared validator runs locally before upload and again on staged bytes. Before
decompression it parses the ZIP central directory with bounds checks and rejects
unsafe paths, encryption, excessive entries or expanded size, and compression
ratios. Only after those limits pass does it inspect required OOXML parts and
content types. Macros, ActiveX, disallowed OLE embeddings, external relationships,
and signatures are quarantined with stable reason codes; structurally invalid or
bomb-shaped archives are rejected. Images and fonts remain allowed, and embeddings,
external relationships, and signatures are controlled by explicit bounded policy.

Quarantine records are immutable intake evidence and do not delete or rewrite the
DOCX. Pending/rejected entries cannot finalize, enqueue builds, or publish. An
explicit admin-neutral resolution contract changes pending to allowed/rejected by
record-version CAS; retry after `allowed` may continue. Resolution and quarantine
audit contains metadata and reason codes only.

The operational contract is service-to-service only. `quarantine:read` permits
bounded list/detail access, while the independent `quarantine:resolve` scope
permits acquiring a short lease and resolving with an operation id, expected
record version, bounded reason, and allow/reject decision. A repeated operation id
returns its original result; a stale version or lease conflicts. User OIDC tokens
do not authorize these routes. The Node command is dry-run unless `--confirm` is
explicit and reads the service token from its configured secret source, never an
argument.

## Consequences

- ZIP bombs are rejected from central-directory metadata before extraction.
- Local and server decisions use the same code and reason vocabulary.
- No automatic sanitization silently changes a user's source document.
- Admin UI and deployment remain outside scope.
