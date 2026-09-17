# @library/source-sync-server — source revision authority

Framework-neutral server authority for authenticated source-revision staging and
finalization. It verifies book ownership from the authenticated principal,
preserves operation idempotency, inspects and fingerprints staged DOCX bytes,
promotes content to an immutable object key, and commits the revision with
optimistic conflict semantics.

Cloudflare bindings implement the durable database/object ports. Deployment,
identity-provider token verification, upload-grant signing, environment creation,
and secrets remain external configuration and are never simulated in this package.
