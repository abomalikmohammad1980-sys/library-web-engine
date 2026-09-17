import type { SourceFileSnapshot, SourceFingerprint } from "./contracts.js";
import { normalizeLogicalPath } from "./events.js";

export type ManagedSourceState = "linked" | "missing" | "needs-review";

export interface ManagedSourceMapping {
  mappingId: string;
  bookId: string;
  logicalPath: string;
  fileIdentity?: string;
  lastPublishedRevisionId: string | null;
  lastFingerprint: SourceFingerprint | null;
  lastObservedSnapshot: SourceFileSnapshot | null;
  state: ManagedSourceState;
  recordVersion: number;
}

export interface ObservedManagedSource {
  logicalPath: string;
  snapshot: SourceFileSnapshot;
}

export type ReconciliationAction =
  | { kind: "unchanged"; mappingId: string; logicalPath: string }
  | { kind: "schedule-stability"; mappingId: string; logicalPath: string; reason: "snapshot-changed" | "mapping-recovered" | "startup-verification" | "content-scrub" }
  | { kind: "source-moved"; mappingId: string; fromLogicalPath: string; toLogicalPath: string }
  | { kind: "source-missing"; mappingId: string; logicalPath: string }
  | { kind: "source-discovered"; logicalPath: string }
  | { kind: "ambiguous-identity"; fileIdentity: string; logicalPaths: string[] };

export interface ReconciliationResult {
  actions: ReconciliationAction[];
  nextMappings: ManagedSourceMapping[];
}

export interface ReconciliationOptions {
  /**
   * Hash mapped sources even when size/mtime/identity appear unchanged. This is
   * intended for startup after an observation gap, where clock skew or an
   * in-place rewrite can preserve all cheap metadata.
   */
  verifyUnchanged?: boolean;
  /**
   * Bounded subset of otherwise unchanged mappings to hash during a runtime
   * scrub. The scheduler rotates this subset; reconciliation remains pure.
   */
  verifyMappingIds?: readonly string[];
}

/**
 * Pure reconciliation over adapter-provided directory observations. It never
 * enumerates a directory or reads bytes. File identity wins over path; path is
 * the conservative fallback when the platform provides no durable identity.
 */
export function reconcileManagedSources(
  mappings: readonly ManagedSourceMapping[],
  observedSources: readonly ObservedManagedSource[],
  options: ReconciliationOptions = {},
): ReconciliationResult {
  assertUniqueMappings(mappings);
  const observed = observedSources.map(normalizeObserved);
  assertUniqueObservedPaths(observed);

  const ambiguousIdentities = duplicateIdentities(observed);
  const observedByIdentity = new Map<string, ObservedManagedSource>();
  const observedByPath = new Map(observed.map((entry) => [entry.logicalPath, entry]));
  for (const entry of observed) {
    const identity = entry.snapshot.fileIdentity;
    if (identity !== undefined && !ambiguousIdentities.has(identity)) {
      observedByIdentity.set(identity, entry);
    }
  }

  const consumed = new Set<string>();
  const verifyMappingIds = new Set(options.verifyMappingIds ?? []);
  const actions: ReconciliationAction[] = [];
  const nextMappings: ManagedSourceMapping[] = [];

  for (const identity of [...ambiguousIdentities].sort()) {
    actions.push({
      kind: "ambiguous-identity",
      fileIdentity: identity,
      logicalPaths: observed
        .filter((entry) => entry.snapshot.fileIdentity === identity)
        .map((entry) => entry.logicalPath)
        .sort(),
    });
  }

  for (const mapping of mappings) {
    const normalizedMapping = normalizeMapping(mapping);
    let match: ObservedManagedSource | undefined;
    const identity = normalizedMapping.fileIdentity;
    if (identity !== undefined && !ambiguousIdentities.has(identity)) {
      match = observedByIdentity.get(identity);
    }
    match ??= observedByPath.get(normalizedMapping.logicalPath);

    if (match === undefined || consumed.has(match.logicalPath)) {
      actions.push({
        kind: "source-missing",
        mappingId: normalizedMapping.mappingId,
        logicalPath: normalizedMapping.logicalPath,
      });
      nextMappings.push(normalizedMapping.state === "missing"
        ? normalizedMapping
        : incrementMapping(normalizedMapping, { state: "missing" }));
      continue;
    }

    consumed.add(match.logicalPath);
    const moved = normalizedMapping.logicalPath !== match.logicalPath;
    const recovered = normalizedMapping.state === "missing";
    const snapshotChanged = !sameSnapshot(normalizedMapping.lastObservedSnapshot, match.snapshot);
    if (moved) {
      actions.push({
        kind: "source-moved",
        mappingId: normalizedMapping.mappingId,
        fromLogicalPath: normalizedMapping.logicalPath,
        toLogicalPath: match.logicalPath,
      });
    }
    const scrubSelected = verifyMappingIds.has(normalizedMapping.mappingId);
    if (snapshotChanged || recovered || options.verifyUnchanged === true || scrubSelected) {
      actions.push({
        kind: "schedule-stability",
        mappingId: normalizedMapping.mappingId,
        logicalPath: match.logicalPath,
        reason: recovered ? "mapping-recovered" : snapshotChanged ? "snapshot-changed"
          : options.verifyUnchanged === true ? "startup-verification" : "content-scrub",
      });
    } else if (!moved) {
      actions.push({
        kind: "unchanged",
        mappingId: normalizedMapping.mappingId,
        logicalPath: match.logicalPath,
      });
      nextMappings.push(normalizedMapping);
      continue;
    }

    const verificationOnly = (options.verifyUnchanged === true || scrubSelected)
      && !moved && !snapshotChanged && !recovered;
    nextMappings.push(verificationOnly ? normalizedMapping : incrementMapping(normalizedMapping, {
      logicalPath: match.logicalPath,
      ...(match.snapshot.fileIdentity === undefined ? {} : { fileIdentity: match.snapshot.fileIdentity }),
      lastObservedSnapshot: match.snapshot,
      state: "linked",
    }));
  }

  for (const entry of observed) {
    if (consumed.has(entry.logicalPath)) continue;
    actions.push({ kind: "source-discovered", logicalPath: entry.logicalPath });
  }

  return { actions, nextMappings };
}

function normalizeMapping(mapping: ManagedSourceMapping): ManagedSourceMapping {
  if (mapping.mappingId.trim() === "" || mapping.bookId.trim() === "") {
    throw new Error("Managed source mapping identifiers cannot be empty");
  }
  if (!Number.isSafeInteger(mapping.recordVersion) || mapping.recordVersion < 0) {
    throw new Error("Managed source mapping recordVersion must be non-negative");
  }
  return { ...mapping, logicalPath: normalizeLogicalPath(mapping.logicalPath) };
}

function normalizeObserved(source: ObservedManagedSource): ObservedManagedSource {
  const logicalPath = normalizeLogicalPath(source.logicalPath);
  if (normalizeLogicalPath(source.snapshot.logicalPath) !== logicalPath) {
    throw new Error("Observed source path and snapshot path must match");
  }
  return {
    logicalPath,
    snapshot: cloneSnapshot(source.snapshot, logicalPath),
  };
}

function cloneSnapshot(snapshot: SourceFileSnapshot, logicalPath: string): SourceFileSnapshot {
  const base = {
    logicalPath,
    sizeBytes: snapshot.sizeBytes,
    modifiedAtMs: snapshot.modifiedAtMs,
  };
  return snapshot.fileIdentity === undefined ? base : { ...base, fileIdentity: snapshot.fileIdentity };
}

function sameSnapshot(a: SourceFileSnapshot | null, b: SourceFileSnapshot): boolean {
  return a !== null
    && a.sizeBytes === b.sizeBytes
    && a.modifiedAtMs === b.modifiedAtMs
    && a.fileIdentity === b.fileIdentity;
}

function incrementMapping(
  mapping: ManagedSourceMapping,
  patch: Partial<ManagedSourceMapping>,
): ManagedSourceMapping {
  const next = { ...mapping, ...patch, recordVersion: mapping.recordVersion + 1 };
  // exactOptionalPropertyTypes: never persist an explicit undefined identity.
  if (next.fileIdentity === undefined) {
    const { fileIdentity: _ignored, ...withoutIdentity } = next;
    return withoutIdentity;
  }
  return next;
}

function duplicateIdentities(observed: readonly ObservedManagedSource[]): Set<string> {
  const counts = new Map<string, number>();
  for (const entry of observed) {
    const identity = entry.snapshot.fileIdentity;
    if (identity !== undefined) counts.set(identity, (counts.get(identity) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([identity]) => identity));
}

function assertUniqueMappings(mappings: readonly ManagedSourceMapping[]): void {
  const ids = new Set<string>();
  for (const mapping of mappings) {
    if (ids.has(mapping.mappingId)) throw new Error(`Duplicate mappingId: ${mapping.mappingId}`);
    ids.add(mapping.mappingId);
  }
}

function assertUniqueObservedPaths(observed: readonly ObservedManagedSource[]): void {
  const paths = new Set<string>();
  for (const entry of observed) {
    if (paths.has(entry.logicalPath)) throw new Error(`Duplicate observed path: ${entry.logicalPath}`);
    paths.add(entry.logicalPath);
  }
}
