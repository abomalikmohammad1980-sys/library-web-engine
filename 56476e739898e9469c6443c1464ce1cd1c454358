import { promises as fsPromises } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  BookBuildManifest,
  ManagedSourceMapping,
  SourceSyncOperation,
  SourceSyncPersistence,
  SourceSyncTransaction,
} from "@library/source-sync";
import type { AtomicPublicationDecision } from "@library/source-sync";

interface PersistedState {
  schemaVersion: 1;
  mappings: Record<string, ManagedSourceMapping>;
  outbox: Record<string, SourceSyncOperation>;
  builds: Record<string, BookBuildManifest>;
  activeBuildByBook: Record<string, string>;
}

const EMPTY_STATE: PersistedState = {
  schemaVersion: 1,
  mappings: {},
  outbox: {},
  builds: {},
  activeBuildByBook: {},
};

const transactionTailsByPath = new Map<string, Promise<void>>();
export interface JsonSourceSyncPersistenceOptions {
  lockTimeoutMs?: number;
  lockRetryMs?: number;
  now?: () => number;
  pidIsAlive?: (pid: number) => boolean;
}

/**
 * Small durable desktop store. Transactions are serialized in-process and
 * committed by writing a sibling temporary file then atomically renaming it.
 * It is intentionally local-only: remote ownership/version authority remains
 * behind the server API rather than being simulated here.
 */
export class JsonSourceSyncPersistence implements SourceSyncPersistence {
  readonly filePath: string;
  readonly #options: Required<JsonSourceSyncPersistenceOptions>;

  constructor(filePath: string, options: JsonSourceSyncPersistenceOptions = {}) {
    if (filePath.trim() === "") throw new Error("Persistence path cannot be empty");
    this.filePath = resolve(filePath);
    this.#options = {
      lockTimeoutMs: options.lockTimeoutMs ?? 5_000,
      lockRetryMs: options.lockRetryMs ?? 10,
      now: options.now ?? Date.now,
      pidIsAlive: options.pidIsAlive ?? isProcessAlive,
    };
    if (this.#options.lockTimeoutMs < 0 || this.#options.lockRetryMs < 1) throw new Error("Invalid persistence lock timing");
  }

  transaction<T>(work: (transaction: SourceSyncTransaction) => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      const release = await this.#acquireProcessLock();
      try {
        const state = await this.#read();
        const working = structuredClone(state);
        const result = await work(new JsonTransaction(working));
        await this.#commit(working);
        return result;
      } finally {
        await release();
      }
    };
    const tail = transactionTailsByPath.get(this.filePath) ?? Promise.resolve();
    const result = tail.then(execute, execute);
    const nextTail = result.then(() => undefined, () => undefined);
    transactionTailsByPath.set(this.filePath, nextTail);
    void nextTail.finally(() => {
      if (transactionTailsByPath.get(this.filePath) === nextTail) transactionTailsByPath.delete(this.filePath);
    });
    return result;
  }

  async #acquireProcessLock(): Promise<() => Promise<void>> {
    const lockPath = `${this.filePath}.lock`, deadline = this.#options.now() + this.#options.lockTimeoutMs;
    await fsPromises.mkdir(dirname(lockPath), { recursive: true });
    for (;;) {
      try {
        const handle = await fsPromises.open(lockPath, "wx");
        try {
          await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAtMs: this.#options.now() })}\n`);
          await handle.sync();
        } catch (error) {
          await handle.close().catch(() => undefined);
          await fsPromises.rm(lockPath, { force: true }).catch(() => undefined);
          throw error;
        }
        return async () => { await handle.close(); await fsPromises.rm(lockPath, { force: true }); };
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        let owner: { pid: number };
        try { owner = await readLockOwner(lockPath); }
        catch (lockError) {
          if (this.#options.now() >= deadline) throw lockError;
          await new Promise(resolveDelay => setTimeout(resolveDelay, this.#options.lockRetryMs));
          continue;
        }
        if (!this.#options.pidIsAlive(owner.pid)) {
          const stalePath = `${lockPath}.stale-${process.pid}-${randomUUID()}`;
          try { await fsPromises.rename(lockPath, stalePath); }
          catch (renameError) { if (isMissing(renameError)) continue; throw renameError; }
          await fsPromises.rm(stalePath, { force: true });
          continue;
        }
        if (this.#options.now() >= deadline) throw new Error(`Timed out waiting for source-sync state lock: ${lockPath}`);
        await new Promise(resolveDelay => setTimeout(resolveDelay, this.#options.lockRetryMs));
      }
    }
  }

  async #read(): Promise<PersistedState> {
    try {
      const parsed = JSON.parse(await fsPromises.readFile(this.filePath, "utf8")) as unknown;
      return parseState(parsed);
    } catch (error) {
      if (isMissing(error)) return structuredClone(EMPTY_STATE);
      throw error;
    }
  }

  async #commit(state: PersistedState): Promise<void> {
    const parent = dirname(this.filePath);
    await fsPromises.mkdir(parent, { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    try {
      const handle = await fsPromises.open(temporary, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(state)}\n`, { encoding: "utf8" });
        await handle.sync();
      } finally { await handle.close(); }
      await fsPromises.rename(temporary, this.filePath);
    } catch (error) {
      await fsPromises.rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}

class JsonTransaction implements SourceSyncTransaction {
  constructor(private readonly state: PersistedState) {}

  async getMapping(mappingId: string): Promise<ManagedSourceMapping | null> {
    return cloneOrNull(this.state.mappings[mappingId]);
  }
  async getMappingByLogicalPath(logicalPath: string): Promise<ManagedSourceMapping | null> {
    return cloneOrNull(Object.values(this.state.mappings).find((item) => item.logicalPath === logicalPath));
  }
  async listMappings(): Promise<ManagedSourceMapping[]> {
    return structuredClone(Object.values(this.state.mappings));
  }
  async compareAndSwapMapping(expected: number | null, next: ManagedSourceMapping): Promise<boolean> {
    const current = this.state.mappings[next.mappingId];
    if (!versionMatches(current?.recordVersion, expected)) return false;
    this.state.mappings[next.mappingId] = structuredClone(next);
    return true;
  }
  async getOutboxOperation(operationId: string): Promise<SourceSyncOperation | null> {
    return cloneOrNull(this.state.outbox[operationId]);
  }
  async listRunnableOutbox(nowMs: number, limit: number): Promise<SourceSyncOperation[]> {
    const runnable = Object.values(this.state.outbox)
      .filter((item) => ((item.state === "pending" || item.state === "retryable") && item.nextAttemptAtMs <= nowMs)
        || (item.state === "in-flight" && item.leaseUntilMs !== null && item.leaseUntilMs <= nowMs))
      .sort((a, b) => a.nextAttemptAtMs - b.nextAttemptAtMs
        || a.createdAtMs - b.createdAtMs || a.operationId.localeCompare(b.operationId));
    // The persistence boundary must be fair itself. If it returned the first
    // `limit` rows globally, a hot book could hide every other book before the
    // pure leasing policy ever got a chance to round-robin them.
    const perBook = new Map<string, SourceSyncOperation[]>();
    for (const operation of runnable) {
      const queue = perBook.get(operation.bookId) ?? [];
      queue.push(operation);
      perBook.set(operation.bookId, queue);
    }
    const selected: SourceSyncOperation[] = [];
    while (selected.length < limit) {
      let progressed = false;
      for (const queue of perBook.values()) {
        const operation = queue.shift();
        if (operation === undefined) continue;
        selected.push(operation);
        progressed = true;
        if (selected.length === limit) break;
      }
      if (!progressed) break;
    }
    return structuredClone(selected);
  }
  async compareAndSwapOutbox(expected: number | null, next: SourceSyncOperation): Promise<boolean> {
    const current = this.state.outbox[next.operationId];
    if (!versionMatches(current?.recordVersion, expected)) return false;
    this.state.outbox[next.operationId] = structuredClone(next);
    return true;
  }
  async getBuildManifest(buildId: string): Promise<BookBuildManifest | null> {
    return cloneOrNull(this.state.builds[buildId]);
  }
  async putBuildManifest(manifest: BookBuildManifest): Promise<void> {
    this.state.builds[manifest.buildId] = structuredClone(manifest);
  }
  async commitAtomicPublication(
    decision: Extract<AtomicPublicationDecision, { kind: "publish" }>,
  ): Promise<boolean> {
    const manifest = this.state.builds[decision.nextActiveBuildId];
    if (manifest === undefined || manifest.sourceRevisionId !== decision.nextActiveSourceRevisionId) return false;
    const current = this.state.activeBuildByBook[manifest.bookId] ?? null;
    if (current !== decision.expectedActiveBuildId) return false;
    this.state.activeBuildByBook[manifest.bookId] = decision.nextActiveBuildId;
    return true;
  }
}

function versionMatches(current: number | undefined, expected: number | null): boolean {
  return expected === null ? current === undefined : current === expected;
}

function cloneOrNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : structuredClone(value);
}

function parseState(value: unknown): PersistedState {
  if (typeof value !== "object" || value === null || (value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new Error("Unsupported or corrupt source-sync persistence schema");
  }
  const state = value as Partial<PersistedState>;
  if (!state.mappings || !state.outbox || !state.builds || !state.activeBuildByBook) {
    throw new Error("Incomplete source-sync persistence state");
  }
  return state as PersistedState;
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

async function readLockOwner(path: string): Promise<{ pid: number }> {
  let value: unknown;
  try { value = JSON.parse(await fsPromises.readFile(path, "utf8")); }
  catch { throw new Error(`Corrupt source-sync state lock: ${path}`); }
  const pid = typeof value === "object" && value !== null ? (value as { pid?: unknown }).pid : undefined;
  if (!Number.isSafeInteger(pid) || (pid as number) < 1) throw new Error(`Corrupt source-sync state lock: ${path}`);
  return { pid: pid as number };
}

function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return hasCode(error, "EPERM"); }
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}
