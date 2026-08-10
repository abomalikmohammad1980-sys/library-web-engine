export type RawSourceWatchEventKind =
  | "created"
  | "modified"
  | "deleted"
  | "renamed"
  | "replaced";

export interface RawSourceWatchEvent {
  kind: RawSourceWatchEventKind;
  path: string;
  observedAtMs: number;
  previousPath?: string;
  fileIdentity?: string;
}

export type NormalizedSourceEvent =
  | {
      kind: "upsert" | "replace";
      logicalPath: string;
      observedAtMs: number;
      fileIdentity?: string;
    }
  | {
      kind: "remove";
      logicalPath: string;
      observedAtMs: number;
    }
  | {
      kind: "move";
      logicalPath: string;
      previousLogicalPath: string;
      observedAtMs: number;
      fileIdentity?: string;
    };

/**
 * Normalizes an adapter event into a logical, root-relative event. OS adapters
 * remain responsible for watching and for correlating platform-specific event IDs.
 */
export function normalizeSourceEvent(
  event: RawSourceWatchEvent,
): NormalizedSourceEvent | null {
  assertFiniteTime(event.observedAtMs);
  const logicalPath = normalizeLogicalPath(event.path);
  const previousLogicalPath = event.previousPath === undefined
    ? undefined
    : normalizeLogicalPath(event.previousPath);

  if (event.kind === "renamed") {
    if (previousLogicalPath === undefined) {
      throw new Error("A renamed source event requires previousPath");
    }
    // A temp file becoming the final DOCX is significant even when the old name is ignored.
    if (isIgnoredTemporarySource(logicalPath)) return null;
    return withOptionalIdentity({
      kind: "move" as const,
      logicalPath,
      previousLogicalPath,
      observedAtMs: event.observedAtMs,
    }, event.fileIdentity);
  }

  if (isIgnoredTemporarySource(logicalPath)) return null;
  if (event.kind === "deleted") {
    return { kind: "remove", logicalPath, observedAtMs: event.observedAtMs };
  }
  return withOptionalIdentity({
    kind: event.kind === "replaced" ? "replace" as const : "upsert" as const,
    logicalPath,
    observedAtMs: event.observedAtMs,
  }, event.fileIdentity);
}

export function normalizeLogicalPath(value: string): string {
  const normalized = value.normalize("NFC").replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error("Source paths must be relative to the managed root");
  }
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") throw new Error("Source paths cannot escape the managed root");
    if (part.includes("\0")) throw new Error("Source paths cannot contain NUL");
    parts.push(part);
  }
  if (parts.length === 0) throw new Error("Source path cannot be empty");
  return parts.join("/");
}

export function isIgnoredTemporarySource(logicalPath: string): boolean {
  const name = logicalPath.split("/").at(-1) ?? logicalPath;
  return /^~\$/u.test(name)
    || /(?:\.tmp|\.temp|\.swp|\.part)$/iu.test(name)
    || /^\.~lock\./u.test(name);
}

function withOptionalIdentity<T extends object>(
  value: T,
  fileIdentity: string | undefined,
): T & { fileIdentity?: string } {
  return fileIdentity === undefined ? value : { ...value, fileIdentity };
}

function assertFiniteTime(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("observedAtMs must be a non-negative finite number");
  }
}
