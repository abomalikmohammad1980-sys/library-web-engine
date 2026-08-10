import { normalizeSha256Hex } from "./fingerprint.js";

export interface EstimatedPaginationConsentIntent {
  schemaVersion: 1;
  intentId: string;
  operationId: string;
  principalId: string;
  deviceId: string;
  bookId: string;
  sourceRevisionId: string;
  sourceFingerprint: string;
  expectedConsentVersion: number;
  consentedAt: string;
  scope: "private-estimated-preview";
}

export interface StoredEstimatedPaginationConsent extends EstimatedPaginationConsentIntent {
  consentVersion: number;
  recordedAt: string;
}
export const estimatedPaginationConsentIntentSchema={type:"object",additionalProperties:false,required:["schemaVersion","intentId","operationId","principalId","deviceId","bookId","sourceRevisionId","sourceFingerprint","expectedConsentVersion","consentedAt","scope"],properties:{schemaVersion:{const:1},intentId:{type:"string",minLength:1},operationId:{type:"string",minLength:1},principalId:{type:"string",minLength:1},deviceId:{type:"string",minLength:1},bookId:{type:"string",minLength:1},sourceRevisionId:{type:"string",minLength:1},sourceFingerprint:{type:"string",pattern:"^[a-fA-F0-9]{64}$"},expectedConsentVersion:{type:"integer",minimum:0},consentedAt:{type:"string",format:"date-time"},scope:{const:"private-estimated-preview"}}}as const;

export type EstimatedPaginationConsentDecision =
  | { kind: "record"; next: StoredEstimatedPaginationConsent }
  | { kind: "replay"; current: StoredEstimatedPaginationConsent }
  | { kind: "conflict"; currentVersion: number }
  | { kind: "stale-source" };

export function decideEstimatedPaginationConsent(input: {
  intent: EstimatedPaginationConsentIntent;
  current: StoredEstimatedPaginationConsent | null;
  currentSourceFingerprint: string;
  authenticatedPrincipalId: string;
  authenticatedDeviceId: string;
  now: string;
}): EstimatedPaginationConsentDecision {
  validateIntent(input.intent);
  if (input.intent.principalId !== input.authenticatedPrincipalId || input.intent.deviceId !== input.authenticatedDeviceId) throw new Error("estimated_pagination_consent_forbidden");
  if (normalizeSha256Hex(input.currentSourceFingerprint) !== input.intent.sourceFingerprint) return { kind: "stale-source" };
  if (input.current?.operationId === input.intent.operationId) {
    if (!sameIntent(input.current, input.intent)) throw new Error("estimated_pagination_operation_reuse");
    return { kind: "replay", current: input.current };
  }
  const version = input.current?.consentVersion ?? 0;
  if (version !== input.intent.expectedConsentVersion) return { kind: "conflict", currentVersion: version };
  return { kind: "record", next: { ...input.intent, consentVersion: version + 1, recordedAt: validDate(input.now, "recordedAt") } };
}

export interface PublicDocxPublicationApproval {
  approvalId: string; operationId: string; principalId: string; bookId: string; sourceRevisionId: string;
  sourceFingerprint: string; authoritativeWordPageMapFingerprint: string; approvedAt: string; scope: "public-publish";
}
export const publicDocxPublicationApprovalSchema={type:"object",additionalProperties:false,required:["approvalId","operationId","principalId","bookId","sourceRevisionId","sourceFingerprint","authoritativeWordPageMapFingerprint","approvedAt","scope"],properties:{approvalId:{type:"string",minLength:1},operationId:{type:"string",minLength:1},principalId:{type:"string",minLength:1},bookId:{type:"string",minLength:1},sourceRevisionId:{type:"string",minLength:1},sourceFingerprint:{type:"string",pattern:"^[a-fA-F0-9]{64}$"},authoritativeWordPageMapFingerprint:{type:"string",pattern:"^[a-fA-F0-9]{64}$"},approvedAt:{type:"string",format:"date-time"},scope:{const:"public-publish"}}}as const;

export function validatePublicDocxPublicationApproval(input: PublicDocxPublicationApproval, expected: { principalId: string; bookId: string; sourceRevisionId: string; sourceFingerprint: string }): void {
  for (const value of [input.approvalId,input.operationId,input.principalId,input.bookId,input.sourceRevisionId]) if (!value.trim()) throw new Error("public_docx_approval_invalid");
  const source = normalizeSha256Hex(input.sourceFingerprint), map = normalizeSha256Hex(input.authoritativeWordPageMapFingerprint);
  if (source !== map || source !== normalizeSha256Hex(expected.sourceFingerprint) || input.principalId !== expected.principalId || input.bookId !== expected.bookId || input.sourceRevisionId !== expected.sourceRevisionId || input.scope !== "public-publish") throw new Error("public_docx_approval_mismatch");
  validDate(input.approvedAt,"approvedAt");
}

function validateIntent(intent: EstimatedPaginationConsentIntent): void {
  if (intent.schemaVersion !== 1 || intent.scope !== "private-estimated-preview" || !Number.isSafeInteger(intent.expectedConsentVersion) || intent.expectedConsentVersion < 0) throw new Error("estimated_pagination_consent_invalid");
  for (const value of [intent.intentId,intent.operationId,intent.principalId,intent.deviceId,intent.bookId,intent.sourceRevisionId]) if (!value.trim()) throw new Error("estimated_pagination_consent_invalid");
  normalizeSha256Hex(intent.sourceFingerprint);
  validDate(intent.consentedAt,"consentedAt");
}
function sameIntent(current: StoredEstimatedPaginationConsent,intent: EstimatedPaginationConsentIntent): boolean { return current.intentId===intent.intentId&&current.principalId===intent.principalId&&current.deviceId===intent.deviceId&&current.bookId===intent.bookId&&current.sourceRevisionId===intent.sourceRevisionId&&current.sourceFingerprint===intent.sourceFingerprint&&current.scope===intent.scope }
function validDate(value:string,field:string):string { const time=Date.parse(value);if(!Number.isFinite(time))throw new Error(`estimated_pagination_${field}_invalid`);return new Date(time).toISOString() }
