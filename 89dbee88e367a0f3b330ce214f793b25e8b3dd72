import type { BookSourceRevision, SourceFingerprint } from "./contracts.js";

export interface SourceRevisionUploadRequest {
  operationId: string;
  bookId: string;
  baseRevisionId: string | null;
  fingerprint: SourceFingerprint;
  sourceName: string;
  deviceId: string;
}
export type SourceRevisionUploadPlan =
  | { kind: "upload"; uploadId: string; uploadUrl: string; expiresAt: string }
  | { kind: "complete"; revision: BookSourceRevision };
export type SourceRevisionFinalizeResult =
  | { kind: "accepted"; revision: BookSourceRevision }
  | { kind: "conflicted"; revision: BookSourceRevision; activeRevisionId: string };

export interface RevisionHistorySnapshot {
  bookId: string; currentRevisionId: string | null; currentBuildId: string | null;
  desiredRevisionId: string | null; recordVersion: number; revisions: BookSourceRevision[];
}
export interface SourceRevisionRollbackRequest {
  operationId: string; targetRevisionId: string; expectedRecordVersion: number; deviceId: string;
}
export interface SourceRevisionRollbackResult {
  targetRevisionId: string; status: "queued" | "published"; recordVersion: number;
}
export type SourceConflictResolution = "keepLocal" | "keepRemote" | "createCopy";
export interface SourceConflictResolutionRequest {
  operationId: string; deviceId: string; conflictingRevisionId: string;
  expectedPublicationVersion: number; resolution: SourceConflictResolution;
}
export interface SourceConflictResolutionResult {
  operationId: string; resolution: SourceConflictResolution; sourceBookId: string;
  targetBookId: string; targetRevisionId: string; status: "archived" | "queued" | "published";
  recordVersion: number;
}

/** JSON-schema-shaped, client-neutral wire contracts (no runtime dependency). */
export const sourceRevisionRollbackRequestSchema = {
  type: "object", additionalProperties: false,
  required: ["operationId", "targetRevisionId", "expectedRecordVersion", "deviceId"],
  properties: {
    operationId: { type: "string", minLength: 1 }, targetRevisionId: { type: "string", minLength: 1 },
    expectedRecordVersion: { type: "integer", minimum: 0 }, deviceId: { type: "string", minLength: 1 },
  },
} as const;
export const sourceConflictResolutionRequestSchema = {
  type: "object", additionalProperties: false,
  required: ["operationId", "deviceId", "conflictingRevisionId", "expectedPublicationVersion", "resolution"],
  properties: {
    operationId: { type: "string", minLength: 1 }, deviceId: { type: "string", minLength: 1 },
    conflictingRevisionId: { type: "string", minLength: 1 }, expectedPublicationVersion: { type: "integer", minimum: 0 },
    resolution: { enum: ["keepLocal", "keepRemote", "createCopy"] },
  },
} as const;

export interface SyncDevice { deviceId:string; label:string; platform:string; createdAt:string; lastSeenAt:string; revokedAt:string|null }
export interface RegisterSyncDeviceRequest { deviceId:string; label:string; platform:string }
export const registerSyncDeviceRequestSchema={type:"object",additionalProperties:false,required:["deviceId","label","platform"],properties:{deviceId:{type:"string",minLength:1},label:{type:"string",minLength:1,maxLength:120},platform:{type:"string",minLength:1,maxLength:40}}} as const;
export interface SyncAccountUsage { committedBytes:number; reservedBytes:number; maxAccountStorageBytes:number; maxSourceBytes:number; maxBookRevisions:number; windowRequests:number; maxRequestsPerWindow:number; rateWindowSeconds:number; recordVersion:number }
export interface QuarantineRecord{quarantineId:string;uploadId:string;bookId:string;operationId:string;deviceId:string;reasonCode:string;status:"pending"|"allowed"|"rejected";recordVersion:number;createdAt:string;resolutionReason:string|null}
export interface QuarantineResolutionRequest{quarantineId:string;resolutionId:string;leaseId:string;decision:"allow"|"reject";reason:string;expectedRecordVersion:number}
export const quarantineResolutionRequestSchema={type:"object",additionalProperties:false,required:["quarantineId","resolutionId","leaseId","decision","reason","expectedRecordVersion"],properties:{quarantineId:{type:"string",minLength:1},resolutionId:{type:"string",minLength:1},leaseId:{type:"string",minLength:1},decision:{enum:["allow","reject"]},reason:{type:"string",minLength:1,maxLength:500},expectedRecordVersion:{type:"integer",minimum:0}}}as const;
