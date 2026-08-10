# ADR-0010: Quota reservations and metadata-only audit for source sync

- Status: Accepted
- Date: 2026-08-08

## Context

Checking usage before an upload is vulnerable to concurrent requests and counting
only finalized revisions allows unbounded staging. Replays must not consume quota
twice, while failed or expired uploads must return their capacity.

## Decision

Prepare creates a unique usage reservation keyed by account, book, and operation.
Only the request that obtains that lock executes one conditional account-usage
update enforcing maximum source bytes, account committed plus reserved storage,
book revision count, and requests per configured time window. A failed conditional
update releases the reservation. Finalize converts reserved bytes to committed;
validation failure or expiry releases them. Cleanup uses guarded status changes so
concurrent cleanup cannot subtract twice.

All quota values are positive explicit Worker bindings with no defaults. A
user-authenticated, read-only usage endpoint derives the account solely from the
principal. Audit events cover committed source uploads, rollbacks, and device
revocations and contain only principal, event type, book/device/operation ids,
outcome, and timestamp—never bearer tokens, signed URLs, source names, hashes, or
document content.

## Consequences

- Reserved capacity is visible and bounded before bytes are accepted.
- Operation replay cannot double-count usage.
- Limits can be changed operationally without changing client contracts.
- Deployment and administrative quota mutation are outside this milestone.
