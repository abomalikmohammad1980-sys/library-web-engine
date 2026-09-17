export type SourceRevisionStatus =
  | "detected"
  | "stabilizing"
  | "hashed"
  | "queued"
  | "uploaded"
  | "quarantined"
  | "processing"
  | "ready"
  | "published"
  | "conflicted"
  | "rejected"
  | "failed";

export interface SourceFingerprint {
  algorithm: "sha256";
  hex: string;
  byteLength: number;
}

export interface BookSourceRevision {
  revisionId: string;
  bookId: string;
  operationId: string;
  baseRevisionId: string | null;
  fingerprint: SourceFingerprint;
  sourceName: string;
  createdAt: string;
  createdByDeviceId: string;
  status: SourceRevisionStatus;
}

export interface SourceFileSnapshot {
  logicalPath: string;
  sizeBytes: number;
  modifiedAtMs: number;
  fileIdentity?: string;
}

export interface StableSourceCandidate {
  logicalPath: string;
  generation: number;
  snapshot: SourceFileSnapshot;
}
