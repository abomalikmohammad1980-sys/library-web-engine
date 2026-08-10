import type { ManagedSourceMapping } from "./mapping.js";
import type { SourceSyncOperation } from "./outbox.js";
import type { AtomicPublicationDecision, BookBuildManifest } from "./publication.js";

/**
 * Persistence port only. Implementations may use IndexedDB, SQLite, or another
 * durable store, but must provide an atomic transaction and CAS semantics.
 */
export interface SourceSyncPersistence {
  transaction<T>(work: (transaction: SourceSyncTransaction) => Promise<T>): Promise<T>;
}

export interface SourceSyncTransaction {
  getMapping(mappingId: string): Promise<ManagedSourceMapping | null>;
  getMappingByLogicalPath(logicalPath: string): Promise<ManagedSourceMapping | null>;
  listMappings(): Promise<ManagedSourceMapping[]>;
  compareAndSwapMapping(
    expectedRecordVersion: number | null,
    next: ManagedSourceMapping,
  ): Promise<boolean>;

  getOutboxOperation(operationId: string): Promise<SourceSyncOperation | null>;
  listRunnableOutbox(nowMs: number, limit: number): Promise<SourceSyncOperation[]>;
  compareAndSwapOutbox(
    expectedRecordVersion: number | null,
    next: SourceSyncOperation,
  ): Promise<boolean>;

  getBuildManifest(buildId: string): Promise<BookBuildManifest | null>;
  putBuildManifest(manifest: BookBuildManifest): Promise<void>;
  commitAtomicPublication(decision: Extract<AtomicPublicationDecision, { kind: "publish" }>): Promise<boolean>;
}

export interface ManagedSourcePlatformAdapter {
  readonly capabilities: {
    recursiveEnumeration: boolean;
    nativeWatch: boolean;
    durableFileIdentity: boolean;
    backgroundExecution: boolean;
  };
  enumerate(): Promise<import("./mapping.js").ObservedManagedSource[]>;
  sample(logicalPath: string): Promise<import("./contracts.js").SourceFileSnapshot | null>;
  readBytes(logicalPath: string): Promise<Uint8Array>;
  subscribe?(sink: (event: import("./events.js").RawSourceWatchEvent) => void): Promise<() => void>;
}
