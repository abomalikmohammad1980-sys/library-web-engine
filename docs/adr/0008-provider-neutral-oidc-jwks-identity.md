# ADR-0008: Provider-neutral OIDC JWT verification at the Worker boundary

- Status: Accepted
- Date: 2026-08-08

## Context

Source-sync user routes need production identity verification without coupling the authority to an identity vendor. Build-service tokens are a separate machine credential and must never authorize user-owned book operations.

## Decision

The Cloudflare adapter verifies bearer JWTs from explicitly configured OIDC bindings: issuer, audience, JWKS URL, and an algorithm allowlist. There are no provider or environment defaults. Only RS256 and ES256 are supported through WebCrypto. The verifier rejects unsigned tokens, symmetric/asymmetric algorithm confusion, unknown key types, invalid signatures, and invalid `iss`, `aud`, `sub`, `exp`, `nbf`, or `iat` claims with bounded clock skew.

JWKS retrieval is injected for testing, has an abort timeout, honors bounded HTTP `max-age`, coalesces concurrent loads, and refreshes once when a signed token presents an unknown `kid`, allowing normal key rotation. Network or JWKS failure fails closed. Signed guest identities remain guests and cannot cross the account-only source authority boundary.

## Consequences

- Identity providers can change without changing source-sync authority code.
- Deployments must explicitly bind all four OIDC values and select RS256 and/or ES256.
- Worker isolates retain the verifier and JWKS cache across requests when the runtime reuses them.
- OIDC discovery is intentionally outside this adapter; the JWKS endpoint is explicit and auditable.
