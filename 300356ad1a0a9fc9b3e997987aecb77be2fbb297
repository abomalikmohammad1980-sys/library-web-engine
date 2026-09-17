import {
  claimOutboxOperations,
  completeOutboxOperation,
  conflictOutboxOperation,
  deterministicRetryDelayMs,
  retryOutboxOperation,
  blockOutboxOperation,
  sha256Fingerprint,
  type SourceSyncOperation,
  type SourceSyncPersistence,
  type SourceRevisionUploadPayload,
} from "@library/source-sync";
import { SourceSyncApiError, type SourceRevisionRemoteApi, type SourceRevisionUploadRequest } from "./source-sync-api-client.js";

export interface OutboxSourceReader {
  readBytes(logicalPath: string): Promise<Uint8Array>;
}

export interface SourceSyncOutboxWorkerOptions {
  leaseDurationMs: number;
  batchSize: number;
  retryBaseMs: number;
  retryMaxMs: number;
  deviceId: string;
  now?: () => number;
  createLeaseId?: () => string;
}

export interface SourceSyncOutboxRunResult {
  claimed: number;
  succeeded: number;
  conflicted: number;
  retried: number;
  blocked: number;
}

/** One bounded drain pass. Claim and every terminal transition use CAS; network
 * I/O occurs outside the local transaction so a slow upload cannot block saves. */
export class SourceSyncOutboxWorker {
  readonly #now: () => number;
  readonly #createLeaseId: () => string;
  constructor(
    private readonly persistence: SourceSyncPersistence,
    private readonly reader: OutboxSourceReader,
    private readonly api: SourceRevisionRemoteApi,
    private readonly options: SourceSyncOutboxWorkerOptions,
  ) {
    this.#now = options.now ?? Date.now;
    this.#createLeaseId = options.createLeaseId ?? (() => crypto.randomUUID());
    if (options.deviceId.trim() === "") throw new Error("deviceId cannot be empty");
  }

  async runOnce(): Promise<SourceSyncOutboxRunResult> {
    const leaseId = this.#createLeaseId();
    const nowMs = this.#now();
    const claimed = await this.persistence.transaction(async (tx) => {
      const runnable = await tx.listRunnableOutbox(nowMs, this.options.batchSize);
      const decision = claimOutboxOperations(runnable, {
        nowMs, leaseId, leaseDurationMs: this.options.leaseDurationMs, limit: this.options.batchSize,
      });
      const committed: SourceSyncOperation[] = [];
      for (const next of decision.claimed) {
        if (await tx.compareAndSwapOutbox(next.recordVersion - 1, next)) committed.push(next);
      }
      return committed;
    });
    const result: SourceSyncOutboxRunResult = { claimed: claimed.length, succeeded: 0, conflicted: 0, retried: 0, blocked: 0 };
    for (const operation of claimed) await this.#execute(operation, leaseId, result);
    return result;
  }

  async #execute(operation: SourceSyncOperation, leaseId: string, result: SourceSyncOutboxRunResult): Promise<void> {
    if (operation.kind !== "source-revision.upload") {
      await this.#transition(operation, blockOutboxOperation(operation, leaseId, "unsupported_operation_kind"));
      result.blocked += 1;
      return;
    }
    try {
      const payload = operation.payload as SourceRevisionUploadPayload;
      const bytes = await this.reader.readBytes(payload.logicalPath);
      const actual = await sha256Fingerprint(bytes);
      if (actual.hex !== payload.fingerprint.hex || actual.byteLength !== payload.fingerprint.byteLength) {
        throw new SourceSyncApiError("Source changed after queueing", "source_changed", true);
      }
      const request: SourceRevisionUploadRequest = {
        operationId: operation.operationId,
        bookId: operation.bookId,
        baseRevisionId: payload.baseRevisionId,
        fingerprint: payload.fingerprint,
        sourceName: payload.logicalPath.split("/").at(-1) ?? payload.logicalPath,
        deviceId: this.options.deviceId,
      };
      const plan = await this.api.prepareUpload(request);
      if (plan.kind === "upload") {
        await this.api.uploadBytes(plan, bytes);
        const finalized = await this.api.finalizeUpload(plan.uploadId, request);
        if (finalized.kind === "conflicted") {
          await this.#transition(operation, conflictOutboxOperation(operation, leaseId));
          result.conflicted += 1;
          return;
        }
      }
      await this.#transition(operation, completeOutboxOperation(operation, leaseId));
      result.succeeded += 1;
    } catch (error) {
      const classified = classifyError(error);
      if (!classified.retryable) {
        await this.#transition(operation, blockOutboxOperation(operation, leaseId, classified.code));
        result.blocked += 1;
        return;
      }
      const normalDelay = deterministicRetryDelayMs(operation.attempt, {
        baseMs: this.options.retryBaseMs, maxMs: this.options.retryMaxMs,
      });
      const delay = error instanceof SourceSyncApiError && error.retryAfterMs !== null
        ? Math.min(this.options.retryMaxMs, Math.max(normalDelay, error.retryAfterMs)) : normalDelay;
      await this.#transition(operation, retryOutboxOperation(operation, leaseId, this.#now(), classified.code, delay));
      result.retried += 1;
    }
  }

  async #transition(previous: SourceSyncOperation, next: SourceSyncOperation): Promise<void> {
    const committed = await this.persistence.transaction((tx) =>
      tx.compareAndSwapOutbox(previous.recordVersion, next));
    if (!committed) throw new Error(`Lost outbox lease for ${previous.operationId}`);
  }
}

function classifyError(error: unknown): { code: string; retryable: boolean } {
  if (error instanceof SourceSyncApiError) return error;
  return { code: "source_sync_transport_error", retryable: true };
}
