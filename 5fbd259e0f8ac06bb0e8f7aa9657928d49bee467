import type { SourceFingerprint } from "./contracts.js";

export const SOURCE_FORMATS = ["docx", "pdf", "bok", "epub", "text"] as const;
export type SourceFormat = typeof SOURCE_FORMATS[number];
export type ImmutableEditionRole = "authoritative" | "alternate" | "derived";

export interface SourceFormatCapability {
  mediaTypes: readonly string[];
  container: "opc-zip" | "pdf" | "database-or-archive" | "epub-zip" | "plain-text";
  canBeInitialAuthority: boolean;
  canBeLiveWordAuthority: boolean;
  supportsStructuredText: boolean;
  requiresSandboxedParser: boolean;
}

export const SOURCE_FORMAT_CAPABILITIES: Readonly<Record<SourceFormat, SourceFormatCapability>> = {
  docx: { mediaTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], container: "opc-zip", canBeInitialAuthority: true, canBeLiveWordAuthority: true, supportsStructuredText: true, requiresSandboxedParser: true },
  pdf: { mediaTypes: ["application/pdf"], container: "pdf", canBeInitialAuthority: true, canBeLiveWordAuthority: false, supportsStructuredText: false, requiresSandboxedParser: true },
  bok: { mediaTypes: ["application/x-shamela-bok", "application/octet-stream"], container: "database-or-archive", canBeInitialAuthority: true, canBeLiveWordAuthority: false, supportsStructuredText: true, requiresSandboxedParser: true },
  epub: { mediaTypes: ["application/epub+zip"], container: "epub-zip", canBeInitialAuthority: true, canBeLiveWordAuthority: false, supportsStructuredText: true, requiresSandboxedParser: true },
  text: { mediaTypes: ["text/plain"], container: "plain-text", canBeInitialAuthority: true, canBeLiveWordAuthority: false, supportsStructuredText: true, requiresSandboxedParser: false },
};

export interface LogicalWork {
  workId: string;
  title: string;
  authority: WorkSourceAuthority | null;
  recordVersion: number;
}

export type WorkSourceAuthority =
  | { kind: "word-live"; editionId: string; format: "docx" }
  | { kind: "immutable-edition"; editionId: string; format: Exclude<SourceFormat, "docx"> };

/** Bytes are immutable for every format. A Word save creates a new edition/revision. */
export interface ImmutableSourceEdition {
  editionId: string;
  operationId: string;
  workId: string;
  format: SourceFormat;
  role: ImmutableEditionRole;
  objectKey: string;
  fingerprint: SourceFingerprint;
  mediaType: string;
  sourceName: string;
  createdAt: string;
  createdByDeviceId: string;
}

export type EditionAttachmentIntent = "attach-alternate" | "establish-authority" | "advance-authority";

export function validateImmutableSourceEdition(edition: ImmutableSourceEdition): ImmutableSourceEdition {
  for (const [name, value] of Object.entries({ editionId: edition.editionId, operationId: edition.operationId, workId: edition.workId, objectKey: edition.objectKey, mediaType: edition.mediaType, sourceName: edition.sourceName, createdAt: edition.createdAt, createdByDeviceId: edition.createdByDeviceId })) {
    if (typeof value !== "string" || value.trim() === "") throw new Error(`${name}_required`);
  }
  if (!SOURCE_FORMATS.includes(edition.format)) throw new Error("source_format_unsupported");
  if (!/^[a-f0-9]{64}$/.test(edition.fingerprint.hex) || !Number.isSafeInteger(edition.fingerprint.byteLength) || edition.fingerprint.byteLength < 0) throw new Error("source_fingerprint_invalid");
  if (!SOURCE_FORMAT_CAPABILITIES[edition.format].mediaTypes.includes(edition.mediaType)) throw new Error("source_media_type_mismatch");
  if (!edition.objectKey.includes(edition.fingerprint.hex)) throw new Error("immutable_object_key_must_include_fingerprint");
  return edition;
}

export function attachSourceEdition(
  work: LogicalWork,
  edition: ImmutableSourceEdition,
  intent: EditionAttachmentIntent,
  expectedRecordVersion: number,
): LogicalWork {
  validateWork(work); validateImmutableSourceEdition(edition);
  if (work.workId !== edition.workId) throw new Error("edition_work_mismatch");
  if (work.recordVersion !== expectedRecordVersion) throw new Error("work_version_conflict");
  if (intent === "attach-alternate") {
    if (edition.role !== "alternate" && edition.role !== "derived") throw new Error("alternate_role_required");
    return work;
  }
  if (edition.role !== "authoritative") throw new Error("authoritative_role_required");
  if (intent === "establish-authority") {
    if (work.authority !== null) throw new Error("work_authority_already_established");
    return { ...work, authority: authorityFor(edition), recordVersion: work.recordVersion + 1 };
  }
  if (work.authority === null) throw new Error("work_authority_missing");
  if (work.authority.kind === "word-live" && edition.format !== "docx") throw new Error("word_authority_format_change_forbidden");
  if (work.authority.kind === "immutable-edition" && edition.format !== work.authority.format) throw new Error("authority_format_migration_requires_explicit_workflow");
  return { ...work, authority: authorityFor(edition), recordVersion: work.recordVersion + 1 };
}

function authorityFor(edition: ImmutableSourceEdition): WorkSourceAuthority {
  return edition.format === "docx"
    ? { kind: "word-live", editionId: edition.editionId, format: "docx" }
    : { kind: "immutable-edition", editionId: edition.editionId, format: edition.format };
}

function validateWork(work: LogicalWork): void {
  if (!work.workId.trim() || !work.title.trim()) throw new Error("logical_work_identity_required");
  if (!Number.isSafeInteger(work.recordVersion) || work.recordVersion < 0) throw new Error("work_record_version_invalid");
  if (work.authority?.kind === "word-live" && work.authority.format !== "docx") throw new Error("word_authority_must_be_docx");
}

export interface SourceFormatSecurityLimits {
  maxBytes: number;
  maxEntries?: number;
  maxExpandedBytes?: number;
  maxCompressionRatio?: number;
  maxTextCodePoints?: number;
  allowEmbeddedFiles: boolean;
  allowExternalReferences: boolean;
  allowActiveContent: boolean;
}

export function validateSourceFormatSecurityLimits(format: SourceFormat, limits: SourceFormatSecurityLimits): void {
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1) throw new Error("format_max_bytes_invalid");
  if (limits.allowActiveContent || limits.allowExternalReferences) throw new Error("unsafe_source_capability_forbidden");
  if (format !== "docx" && limits.allowEmbeddedFiles) throw new Error("embedded_source_files_forbidden");
  if ((format === "docx" || format === "epub" || format === "bok")
    && (![limits.maxEntries, limits.maxExpandedBytes, limits.maxCompressionRatio].every(value => typeof value === "number" && Number.isFinite(value) && value > 0))) throw new Error("archive_limits_required");
  if (format === "text" && (!Number.isSafeInteger(limits.maxTextCodePoints) || limits.maxTextCodePoints! < 1)) throw new Error("text_codepoint_limit_required");
}
