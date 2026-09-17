# ADR-0009: User-owned device registry gates source mutations

- Status: Accepted
- Date: 2026-08-08

## Context

Source revisions record a caller-supplied device id, but an unregistered string is
not a security identity and a revoked installation must not keep uploading or
rolling publication backward. Device administration must remain account-scoped
and independent of any UI or identity provider.

## Decision

D1 stores accounts by authenticated OIDC principal `sub` and devices by the
composite key `(principal_sub, device_id)`, including label, platform, creation,
last-seen, and revocation timestamps. User-authenticated endpoints register,
list, and revoke devices. Registration is idempotent for an active device;
revocation is terminal and another principal receives a not-found response.

Upload prepare/finalize and rollback require the supplied device id to be active
and owned by the authenticated principal. Failure is a conflict and happens
before issuing upload grants or changing publication. Migration 0004 backfills
device ids already present in trusted upload/revision rows as `legacy` devices,
so existing installations retain access without a period where arbitrary new ids
are accepted.

## Consequences

- Revocation immediately blocks later source mutations from that device id.
- Device ids are scoped to accounts and are not global bearer credentials.
- Re-enrolling a revoked id is forbidden; clients must create a new device id.
- UI and deployment remain outside this milestone.
