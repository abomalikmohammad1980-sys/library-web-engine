# @library/source-sync-cloudflare

Cloudflare Worker adapters for source-sync. Owns D1/R2 binding integration,
short-lived HMAC staging upload grants, and routing requests into the server
authority. It contains no secrets or deployed resource identifiers.

Deployment remains gated on provisioned D1/R2 resources, an identity verifier,
and a secret `SOURCE_UPLOAD_SIGNING_KEY` binding.

User routes use a provider-neutral OIDC/JWKS verifier when no verifier is injected.
`OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, and `OIDC_ALLOWED_ALGORITHMS`
are mandatory explicit bindings; no identity-provider defaults are embedded.
Build-service HMAC tokens never authenticate user routes.
