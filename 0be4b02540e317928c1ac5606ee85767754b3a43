import type { BookSourceRevision, SourceFingerprint, SourceRevisionUploadRequest } from "@library/source-sync";

export interface AuthenticatedPrincipal { userId: string }
export type PrepareSourceUploadCommand = SourceRevisionUploadRequest;
export interface StagedSourceUpload {
  uploadId: string; operationId: string; ownerId: string; bookId: string;
  objectKey: string; expectedFingerprint: SourceFingerprint; baseRevisionId: string | null;
  sourceName: string; deviceId: string; expiresAt: string;
}
export interface SourceRevisionAuthorityStore {
  transaction<T>(work: (tx: SourceRevisionAuthorityTransaction) => Promise<T>): Promise<T>;
}
export interface SourceRevisionAuthorityTransaction {
  isBookOwner(bookId: string, userId: string): Promise<boolean>;
  getRevisionByOperation(bookId: string, operationId: string): Promise<BookSourceRevision | null>;
  getRevisionByFingerprint(bookId: string, fingerprint: SourceFingerprint): Promise<BookSourceRevision | null>;
  getActiveRevisionId(bookId: string): Promise<string | null>;
  getUpload(uploadId: string): Promise<StagedSourceUpload | null>;
  getUploadByOperation?(bookId: string, operationId: string): Promise<StagedSourceUpload | null>;
  createUpload(upload: StagedSourceUpload): Promise<boolean>;
  createRevision(revision: BookSourceRevision, immutableObjectKey: string): Promise<boolean>;
  enqueueBuildForRevision?(revision: BookSourceRevision): Promise<void>;
  markUploadFinalized(uploadId: string, revisionId: string): Promise<boolean>;
  reserveUsage?(input:{userId:string;bookId:string;operationId:string;uploadId:string;byteLength:number;expiresAt:string}):Promise<"reserved"|"replay"|"quota_exceeded">;
  commitUsage?(uploadId:string):Promise<void>;
  releaseUsage?(uploadId:string):Promise<void>;
  releaseExpiredUsage?():Promise<void>;
  recordQuarantine?(input:{uploadId:string;ownerId:string;bookId:string;operationId:string;deviceId:string;reason:string}):Promise<void>;
  quarantineDecision?(uploadId:string):Promise<"allowed"|"rejected"|"pending"|null>;
  /** Repairs a response-drop/partial-finalize replay without creating another revision. */
  reconcileCompletedUpload?(bookId:string, operationId:string, revisionId:string):Promise<void>;
}
export interface DeviceAuthorizationStore { isActiveDevice(userId:string,deviceId:string):Promise<boolean> }
export interface ImmutableSourceObjectStore {
  stat(key: string): Promise<{ byteLength: number } | null>;
  read(key: string): Promise<Uint8Array>;
  promoteIfAbsent(stagingKey: string, immutableKey: string): Promise<"created" | "exists">;
  delete(key: string): Promise<void>;
}
export interface StagingUploadGrantIssuer {
  issue(input: { uploadId: string; objectKey: string; byteLength: number; contentType: string; expiresAt: string }): Promise<{ uploadUrl: string }>;
}
export interface DocxInspectionPort {
  inspect(bytes: Uint8Array): Promise<{ kind: "accepted" } | { kind: "quarantined"|"rejected"; reason: string }>;
}

export class SourceRevisionAuthorityError extends Error {
  constructor(readonly code: string, readonly status: number, message = code) { super(message); this.name = "SourceRevisionAuthorityError"; }
}
