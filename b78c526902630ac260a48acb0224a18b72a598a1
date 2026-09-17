import { promises as fsPromises } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type {
  ManagedSourcePlatformAdapter,
  ObservedManagedSource,
  RawSourceWatchEvent,
  SourceFileSnapshot,
} from "@library/source-sync";
import { normalizeLogicalPath } from "@library/source-sync";

export interface NodeFileStat {
  sizeBytes: number;
  modifiedAtMs: number;
  fileIdentity?: string;
  isFile: boolean;
}

export interface NodeManagedSourceIo {
  listRelativeFiles(rootPath: string): Promise<string[]>;
  stat(absolutePath: string): Promise<NodeFileStat | null>;
  read(absolutePath: string): Promise<Uint8Array>;
  watchRecursive(
    rootPath: string,
    onChange: () => void,
    onError: (error: Error) => void,
    pollIntervalMs: number,
  ): () => void;
}

export interface NodeManagedSourceAdapterOptions {
  debounceMs?: number;
  pollIntervalMs?: number;
  include?: (logicalPath: string) => boolean;
  io?: NodeManagedSourceIo;
  onError?: (error: Error) => void;
  now?: () => number;
}

export class NodeManagedSourceAdapter implements ManagedSourcePlatformAdapter {
  readonly capabilities = {
    recursiveEnumeration: true,
    nativeWatch: false,
    durableFileIdentity: true,
    backgroundExecution: true,
  } as const;

  readonly rootPath: string;
  readonly #debounceMs: number;
  readonly #pollIntervalMs: number;
  readonly #include: (logicalPath: string) => boolean;
  readonly #io: NodeManagedSourceIo;
  readonly #onError: (error: Error) => void;
  readonly #now: () => number;

  constructor(rootPath: string, options: NodeManagedSourceAdapterOptions = {}) {
    if (rootPath.trim() === "") throw new Error("Managed source root cannot be empty");
    this.rootPath = resolve(rootPath);
    this.#debounceMs = options.debounceMs ?? 200;
    this.#pollIntervalMs = options.pollIntervalMs ?? 500;
    if (!Number.isFinite(this.#debounceMs) || this.#debounceMs < 0) {
      throw new Error("debounceMs must be non-negative");
    }
    if (!Number.isFinite(this.#pollIntervalMs) || this.#pollIntervalMs <= 0) {
      throw new Error("pollIntervalMs must be positive");
    }
    this.#include = options.include ?? ((logicalPath) => /\.docx$/iu.test(logicalPath));
    this.#io = options.io ?? nodeManagedSourceIo;
    this.#onError = options.onError ?? (() => undefined);
    this.#now = options.now ?? Date.now;
  }

  async enumerate(): Promise<ObservedManagedSource[]> {
    const paths = await this.#io.listRelativeFiles(this.rootPath);
    const out: ObservedManagedSource[] = [];
    for (const rawPath of paths) {
      const logicalPath = normalizeLogicalPath(rawPath);
      if (!this.#include(logicalPath)) continue;
      const snapshot = await this.sample(logicalPath);
      if (snapshot !== null) out.push({ logicalPath, snapshot });
    }
    return out.sort((a, b) => a.logicalPath.localeCompare(b.logicalPath));
  }

  async sample(logicalPath: string): Promise<SourceFileSnapshot | null> {
    const normalized = normalizeLogicalPath(logicalPath);
    if (!this.#include(normalized)) return null;
    const stat = await this.#io.stat(this.#absolutePath(normalized));
    if (stat === null || !stat.isFile) return null;
    const base = {
      logicalPath: normalized,
      sizeBytes: stat.sizeBytes,
      modifiedAtMs: stat.modifiedAtMs,
    };
    return stat.fileIdentity === undefined ? base : { ...base, fileIdentity: stat.fileIdentity };
  }

  async readBytes(logicalPath: string): Promise<Uint8Array> {
    const normalized = normalizeLogicalPath(logicalPath);
    if (!this.#include(normalized)) throw new Error("Managed source type is not allowed");
    return this.#io.read(this.#absolutePath(normalized));
  }

  async subscribe(sink: (event: RawSourceWatchEvent) => void): Promise<() => void> {
    let previous = indexObserved(await this.enumerate());
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let running = false;
    let rerun = false;

    const flush = async (): Promise<void> => {
      if (closed) return;
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      try {
        do {
          rerun = false;
          const current = indexObserved(await this.enumerate());
          for (const event of diffObserved(previous, current, this.#now())) sink(event);
          previous = current;
        } while (rerun && !closed);
      } catch (error) {
        this.#onError(asError(error));
      } finally {
        running = false;
      }
    };

    const schedule = (): void => {
      if (closed) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, this.#debounceMs);
    };
    const closeWatch = this.#io.watchRecursive(
      this.rootPath,
      schedule,
      this.#onError,
      this.#pollIntervalMs,
    );
    return () => {
      closed = true;
      if (timer !== null) clearTimeout(timer);
      closeWatch();
    };
  }

  #absolutePath(logicalPath: string): string {
    const normalized = normalizeLogicalPath(logicalPath);
    if (isAbsolute(normalized)) throw new Error("Logical source path must be relative");
    const absolute = resolve(this.rootPath, ...normalized.split("/"));
    const rel = relative(this.rootPath, absolute);
    if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
      throw new Error("Logical source path escapes the managed root");
    }
    return absolute;
  }
}

export function diffObserved(
  previous: ReadonlyMap<string, ObservedManagedSource>,
  current: ReadonlyMap<string, ObservedManagedSource>,
  observedAtMs: number,
): RawSourceWatchEvent[] {
  const events: RawSourceWatchEvent[] = [];
  const removed = new Map([...previous].filter(([path]) => !current.has(path)));
  const added = new Map([...current].filter(([path]) => !previous.has(path)));

  const addedByIdentity = new Map<string, string>();
  for (const [path, entry] of added) {
    const identity = entry.snapshot.fileIdentity;
    if (identity !== undefined && !addedByIdentity.has(identity)) addedByIdentity.set(identity, path);
  }
  for (const [oldPath, entry] of [...removed]) {
    const identity = entry.snapshot.fileIdentity;
    const newPath = identity === undefined ? undefined : addedByIdentity.get(identity);
    if (newPath === undefined) continue;
    events.push(withIdentity({ kind: "renamed", previousPath: oldPath, path: newPath, observedAtMs }, identity));
    removed.delete(oldPath);
    added.delete(newPath);
  }

  for (const [path, before] of previous) {
    const after = current.get(path);
    if (after === undefined || sameSnapshot(before.snapshot, after.snapshot)) continue;
    const beforeIdentity = before.snapshot.fileIdentity;
    const afterIdentity = after.snapshot.fileIdentity;
    events.push(withIdentity({
      kind: beforeIdentity !== undefined && afterIdentity !== undefined && beforeIdentity !== afterIdentity
        ? "replaced"
        : "modified",
      path,
      observedAtMs,
    }, afterIdentity));
  }
  for (const [path, entry] of removed) {
    events.push({ kind: "deleted", path, observedAtMs });
  }
  for (const [path, entry] of added) {
    events.push(withIdentity({ kind: "created", path, observedAtMs }, entry.snapshot.fileIdentity));
  }
  return events.sort(compareEvents);
}

function indexObserved(entries: readonly ObservedManagedSource[]): Map<string, ObservedManagedSource> {
  return new Map(entries.map((entry) => [entry.logicalPath, entry]));
}

function sameSnapshot(a: SourceFileSnapshot, b: SourceFileSnapshot): boolean {
  return a.sizeBytes === b.sizeBytes
    && a.modifiedAtMs === b.modifiedAtMs
    && a.fileIdentity === b.fileIdentity;
}

function withIdentity<T extends object>(value: T, identity: string | undefined): T & { fileIdentity?: string } {
  return identity === undefined ? value : { ...value, fileIdentity: identity };
}

function compareEvents(a: RawSourceWatchEvent, b: RawSourceWatchEvent): number {
  return a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind);
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export const nodeManagedSourceIo: NodeManagedSourceIo = {
  async listRelativeFiles(rootPath) {
    const out: string[] = [];
    const visit = async (absoluteDir: string): Promise<void> => {
      const entries = await fsPromises.readdir(absoluteDir, { withFileTypes: true });
      for (const entry of entries) {
        const absolute = resolve(absoluteDir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) await visit(absolute);
        else if (entry.isFile()) out.push(relative(rootPath, absolute).replaceAll(sep, "/"));
      }
    };
    await visit(rootPath);
    return out;
  },
  async stat(absolutePath) {
    try {
      const stat = await fsPromises.stat(absolutePath);
      const identity = `${stat.dev}:${stat.ino}`;
      return {
        sizeBytes: stat.size,
        modifiedAtMs: stat.mtimeMs,
        fileIdentity: identity,
        isFile: stat.isFile(),
      };
    } catch (error) {
      if (isMissingError(error)) return null;
      throw error;
    }
  },
  async read(absolutePath) {
    return fsPromises.readFile(absolutePath);
  },
  watchRecursive(_rootPath, onChange, _onError, pollIntervalMs) {
    const timer = setInterval(onChange, pollIntervalMs);
    timer.unref?.();
    return () => clearInterval(timer);
  },
};

function isMissingError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && ((error as { code?: unknown }).code === "ENOENT" || (error as { code?: unknown }).code === "ENOTDIR");
}
