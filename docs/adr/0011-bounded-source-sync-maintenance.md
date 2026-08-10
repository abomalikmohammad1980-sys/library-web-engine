# ADR-0011: Bounded, checkpointed source-sync maintenance

- Status: Accepted
- Date: 2026-08-08

## Context

Expired reservations and worker leases must recover without unbounded scans.
Staging objects can outlive failed requests, but deleting an active upload or any
immutable revision/artifact would be destructive.

## Decision

The Cloudflare Worker exposes a scheduled handler with explicit batch-size and
staging-grace bindings. Each run processes bounded ordered sets: it releases
expired quota reservations with guarded state changes, requeues expired
`in-flight` build jobs with record-version CAS, and pages R2 using a persisted
cursor. R2 cleanup is structurally restricted to `staging/source/`, requires an
object age beyond grace, and checks that no live unfinalized upload references the
key. Immutable `sources/` and `artifacts/` prefixes never enter deletion logic.

Each run persists metadata-only counters and timestamps. `/health` exposes the
latest counters. Cursor updates use record-version CAS, so overlapping schedules
remain idempotent. Desktop outbox leases remain owned and recovered by the local
durable outbox worker; Cloudflare maintenance only recovers server build leases.

## Consequences

- Every invocation has bounded D1 and R2 work.
- Retry and overlapping cron invocations cannot double-release usage or steal a renewed lease.
- Manual mutation endpoints are omitted; operators can observe counters without widening administrative authority.
- Cron configuration and deployment remain external gates.
