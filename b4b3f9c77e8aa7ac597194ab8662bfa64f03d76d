# ADR-0007: Worker-signed HMAC endpoint for R2 staging uploads

- Status: Accepted
- Date: 2026-08-08

## Context

The desktop outbox must upload DOCX bytes without receiving R2/S3 credentials.
The repository targets an R2 Worker binding, while generating S3 presigned URLs
would require separate S3 API credentials and signing machinery. Sending the
normal account bearer token to object storage would also widen credential scope.

## Decision

The authority issues a 15-minute upload URL targeting the source-sync Worker.
The URL carries upload id, exact byte length, expiry, and an HMAC-SHA256 signature
over those values plus the canonical staging key. The PUT endpoint:

1. verifies signature and expiry before reading the body;
2. requires the declared exact content length;
3. derives the staging key server-side;
4. writes via the R2 binding with `If-None-Match: *` semantics;
5. never receives or needs the user's bearer token.

Finalize still rechecks R2 size, computes SHA-256 over the stored bytes, runs DOCX
inspection, and promotes with conditional no-overwrite semantics. The URL is a
capability and must therefore be short-lived and excluded from logs.

## Consequences

- No R2/S3 credential is exposed to clients and no extra signing secret leaves the Worker.
- Upload traffic traverses the Worker endpoint; platform request/body limits must be included in deployment capacity tests.
- `SOURCE_UPLOAD_SIGNING_KEY` is an encrypted binding rotated operationally.
- Deployment, secret creation, D1/R2 provisioning, and staging load tests remain external gates.
