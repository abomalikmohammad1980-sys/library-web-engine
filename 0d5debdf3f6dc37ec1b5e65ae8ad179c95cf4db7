export type SourceSyncOperationKind =
  | "source-revision.upload"
  | "source-revision.adopt"
  | "source-revision.resolve-conflict";

export type OutboxOperationState =
  | "pending"
  | "in-flight"
  | "retryable"
  | "succeeded"
  | "conflicted"
  | "blocked"
  | "dead-letter";

export interface SourceSyncOperation<TPayload = unknown> {
  operationId: string;
  kind: SourceSyncOperationKind;
  bookId: string;
  payloadDigest: string;
  payload: TPayload;
  state: OutboxOperationState;
  attempt: number;
  createdAtMs: number;
  nextAttemptAtMs: number;
  leaseId: string | null;
  leaseUntilMs: number | null;
  lastErrorCode: string | null;
  recordVersion: number;
}

export type EnqueueDecision =
  | { kind: "enqueue" }
  | { kind: "replay"; operation: SourceSyncOperation };

export interface ClaimOptions {
  nowMs: number;
  leaseId: string;
  leaseDurationMs: number;
  limit: number;
}

export interface ClaimedOutboxBatch {
  claimed: SourceSyncOperation[];
  unchanged: SourceSyncOperation[];
}

export function decideOutboxEnqueue(
  candidate: SourceSyncOperation,
  existing: SourceSyncOperation | undefined,
): EnqueueDecision {
  validateOperation(candidate);
  if (existing === undefined) return { kind: "enqueue" };
  validateOperation(existing);
  if (existing.operationId !== candidate.operationId) {
    throw new Error("Existing outbox lookup must use the candidate operationId");
  }
  if (existing.bookId !== candidate.bookId
    || existing.kind !== candidate.kind
    || existing.payloadDigest !== candidate.payloadDigest) {
    throw new Error("An operationId cannot be reused for different source-sync work");
  }
  return { kind: "replay", operation: existing };
}

/**
 * Pure leasing decision. A persistence adapter must commit each returned
 * record with compare-and-swap on recordVersion to make the claim atomic.
 */
export function claimOutboxOperations(
  operations: readonly SourceSyncOperation[],
  options: ClaimOptions,
): ClaimedOutboxBatch {
  validateClaimOptions(options);
  assertUniqueOperationIds(operations);
  const runnable = operations
    .filter((operation) => isRunnable(operation, options.nowMs))
    .sort(compareRunnable);
  // A noisy book must not consume every bounded batch while other books wait.
  // Preserve FIFO within each book, then take one per book per round.
  const queues = new Map<string, SourceSyncOperation[]>();
  for (const operation of runnable) {
    const queue = queues.get(operation.bookId) ?? [];
    queue.push(operation); queues.set(operation.bookId, queue);
  }
  const candidates: SourceSyncOperation[] = [];
  while (candidates.length < options.limit) {
    let progressed = false;
    for (const queue of queues.values()) {
      const next = queue.shift(); if (next === undefined) continue;
      candidates.push(next); progressed = true;
      if (candidates.length === options.limit) break;
    }
    if (!progressed) break;
  }
  const selected = new Set(candidates.map((operation) => operation.operationId));
  const claimed: SourceSyncOperation[] = [];
  const unchanged: SourceSyncOperation[] = [];
  for (const operation of operations) {
    validateOperation(operation);
    if (!selected.has(operation.operationId)) {
      unchanged.push(operation);
      continue;
    }
    claimed.push({
      ...operation,
      state: "in-flight",
      attempt: operation.attempt + 1,
      leaseId: options.leaseId,
      leaseUntilMs: options.nowMs + options.leaseDurationMs,
      lastErrorCode: null,
      recordVersion: operation.recordVersion + 1,
    });
  }
  return { claimed, unchanged };
}

export function completeOutboxOperation(
  operation: SourceSyncOperation,
  leaseId: string,
): SourceSyncOperation {
  assertOwnedLease(operation, leaseId);
  return transitionFromLease(operation, "succeeded", 0, null);
}

export function conflictOutboxOperation(
  operation: SourceSyncOperation,
  leaseId: string,
  errorCode = "source_revision_conflict",
): SourceSyncOperation {
  assertOwnedLease(operation, leaseId);
  return transitionFromLease(operation, "conflicted", 0, errorCode);
}

export function retryOutboxOperation(
  operation: SourceSyncOperation,
  leaseId: string,
  nowMs: number,
  errorCode: string,
  delayMs: number,
): SourceSyncOperation {
  assertOwnedLease(operation, leaseId);
  assertNonNegativeFinite(nowMs, "nowMs");
  assertNonNegativeFinite(delayMs, "delayMs");
  return transitionFromLease(operation, "retryable", nowMs + delayMs, errorCode);
}

export function blockOutboxOperation(
  operation: SourceSyncOperation,
  leaseId: string,
  errorCode: string,
): SourceSyncOperation {
  assertOwnedLease(operation, leaseId);
  return transitionFromLease(operation, "blocked", 0, errorCode);
}

export function deterministicRetryDelayMs(
  attempt: number,
  policy: { baseMs: number; maxMs: number },
): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error("attempt must be at least 1");
  assertNonNegativeFinite(policy.baseMs, "baseMs");
  assertNonNegativeFinite(policy.maxMs, "maxMs");
  return Math.min(policy.maxMs, policy.baseMs * (2 ** Math.min(30, attempt - 1)));
}

function isRunnable(operation: SourceSyncOperation, nowMs: number): boolean {
  if ((operation.state === "pending" || operation.state === "retryable")
    && operation.nextAttemptAtMs <= nowMs) return true;
  return operation.state === "in-flight"
    && operation.leaseUntilMs !== null
    && operation.leaseUntilMs <= nowMs;
}

function compareRunnable(a: SourceSyncOperation, b: SourceSyncOperation): number {
  return a.nextAttemptAtMs - b.nextAttemptAtMs
    || a.createdAtMs - b.createdAtMs
    || a.operationId.localeCompare(b.operationId);
}

function transitionFromLease(
  operation: SourceSyncOperation,
  state: OutboxOperationState,
  nextAttemptAtMs: number,
  lastErrorCode: string | null,
): SourceSyncOperation {
  return {
    ...operation,
    state,
    nextAttemptAtMs,
    leaseId: null,
    leaseUntilMs: null,
    lastErrorCode,
    recordVersion: operation.recordVersion + 1,
  };
}

function assertOwnedLease(operation: SourceSyncOperation, leaseId: string): void {
  validateOperation(operation);
  if (operation.state !== "in-flight" || operation.leaseId !== leaseId) {
    throw new Error("Outbox transition requires the active lease");
  }
}

function validateClaimOptions(options: ClaimOptions): void {
  assertNonNegativeFinite(options.nowMs, "nowMs");
  assertNonNegativeFinite(options.leaseDurationMs, "leaseDurationMs");
  if (options.leaseDurationMs === 0) throw new Error("leaseDurationMs must be positive");
  if (options.leaseId.trim() === "") throw new Error("leaseId cannot be empty");
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) throw new Error("limit must be positive");
}

function validateOperation(operation: SourceSyncOperation): void {
  if (operation.operationId.trim() === "" || operation.bookId.trim() === "") {
    throw new Error("Outbox identifiers cannot be empty");
  }
  if (operation.payloadDigest.trim() === "") throw new Error("payloadDigest cannot be empty");
  if (!Number.isSafeInteger(operation.attempt) || operation.attempt < 0) {
    throw new Error("attempt must be non-negative");
  }
  if (!Number.isSafeInteger(operation.recordVersion) || operation.recordVersion < 0) {
    throw new Error("recordVersion must be non-negative");
  }
  assertNonNegativeFinite(operation.createdAtMs, "createdAtMs");
  assertNonNegativeFinite(operation.nextAttemptAtMs, "nextAttemptAtMs");
}

function assertUniqueOperationIds(operations: readonly SourceSyncOperation[]): void {
  const ids = new Set<string>();
  for (const operation of operations) {
    if (ids.has(operation.operationId)) throw new Error(`Duplicate operationId: ${operation.operationId}`);
    ids.add(operation.operationId);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be non-negative`);
}
