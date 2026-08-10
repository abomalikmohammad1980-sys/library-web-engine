import { decideSourceRevision, sha256Fingerprint, type BookSourceRevision } from "@library/source-sync";
import type {
  AuthenticatedPrincipal, DocxInspectionPort, ImmutableSourceObjectStore, PrepareSourceUploadCommand,
  SourceRevisionAuthorityStore, StagedSourceUpload, StagingUploadGrantIssuer, DeviceAuthorizationStore,
} from "./contracts.js";
import { SourceRevisionAuthorityError } from "./contracts.js";

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export class SourceRevisionAuthority {
  constructor(
    private readonly store: SourceRevisionAuthorityStore,
    private readonly objects: ImmutableSourceObjectStore,
    private readonly grants: StagingUploadGrantIssuer,
    private readonly inspection: DocxInspectionPort,
    private readonly ids: { uploadId(): string; revisionId(): string },
    private readonly now: () => Date = () => new Date(), private readonly devices?: DeviceAuthorizationStore,
  ) {}

  async prepare(principal: AuthenticatedPrincipal, command: PrepareSourceUploadCommand) {
    requirePrincipal(principal); validateCommand(command); await this.requireDevice(principal,command.deviceId);
    const decision = await this.store.transaction(async (tx) => {
      if (!await tx.isBookOwner(command.bookId, principal.userId)) throw new SourceRevisionAuthorityError("book_not_found", 404);
      const existing = await tx.getRevisionByOperation(command.bookId, command.operationId);
      if (existing !== null) {
        await tx.reconcileCompletedUpload?.(command.bookId, command.operationId, existing.revisionId);
        return { kind: "complete" as const, revision: existing };
      }
      const interrupted = await tx.getUploadByOperation?.(command.bookId, command.operationId) ?? null;
      if (interrupted !== null) {
        if (interrupted.ownerId !== principal.userId || !sameUploadCommand(interrupted, command)) {
          throw new SourceRevisionAuthorityError("operation_in_progress", 409);
        }
        if (Date.parse(interrupted.expiresAt) < this.now().getTime()) {
          await tx.releaseUsage?.(interrupted.uploadId);
          throw new SourceRevisionAuthorityError("upload_expired", 410);
        }
        return { kind: "upload" as const, upload: interrupted };
      }
      const sameContent = await tx.getRevisionByFingerprint(command.bookId, command.fingerprint);
      if (sameContent !== null) return { kind: "complete" as const, revision: sameContent };
      const uploadId = this.ids.uploadId();
      const expiresAt = new Date(this.now().getTime() + 15 * 60_000).toISOString();
      const upload: StagedSourceUpload = {
        uploadId, operationId: command.operationId, ownerId: principal.userId, bookId: command.bookId,
        objectKey: `staging/source/${uploadId}`, expectedFingerprint: command.fingerprint,
        baseRevisionId: command.baseRevisionId, sourceName: command.sourceName, deviceId: command.deviceId, expiresAt,
      };
      await tx.releaseExpiredUsage?.();const reserved=await tx.reserveUsage?.({userId:principal.userId,bookId:command.bookId,operationId:command.operationId,uploadId,byteLength:command.fingerprint.byteLength,expiresAt});if(reserved==="quota_exceeded")throw new SourceRevisionAuthorityError("quota_exceeded",429);if(reserved==="replay")throw new SourceRevisionAuthorityError("operation_in_progress",409);
      if (!await tx.createUpload(upload)) throw new SourceRevisionAuthorityError("operation_in_progress", 409);
      return { kind: "upload" as const, upload };
    });
    if (decision.kind === "complete") return decision;
    const grant = await this.grants.issue({ uploadId: decision.upload.uploadId, objectKey: decision.upload.objectKey,
      byteLength: command.fingerprint.byteLength, contentType: DOCX_TYPE, expiresAt: decision.upload.expiresAt });
    return { kind: "upload" as const, uploadId: decision.upload.uploadId, uploadUrl: grant.uploadUrl, expiresAt: decision.upload.expiresAt };
  }

  async finalize(principal: AuthenticatedPrincipal, uploadId: string, command: PrepareSourceUploadCommand) {
    requirePrincipal(principal); validateCommand(command); await this.requireDevice(principal,command.deviceId);
    const upload = await this.store.transaction(async (tx) => {
      if (!await tx.isBookOwner(command.bookId, principal.userId)) throw new SourceRevisionAuthorityError("book_not_found", 404);
      const replay = await tx.getRevisionByOperation(command.bookId, command.operationId);
      if (replay !== null) {
        await tx.reconcileCompletedUpload?.(command.bookId, command.operationId, replay.revisionId);
        return { replay };
      }
      const found = await tx.getUpload(uploadId);
      if (found === null || found.ownerId !== principal.userId || found.bookId !== command.bookId || found.operationId !== command.operationId) {
        throw new SourceRevisionAuthorityError("upload_not_found", 404);
      }
      if (!sameUploadCommand(found, command)) throw new SourceRevisionAuthorityError("upload_request_mismatch", 409);
      if (Date.parse(found.expiresAt) < this.now().getTime()){await tx.releaseUsage?.(uploadId);throw new SourceRevisionAuthorityError("upload_expired", 410)}
      return { upload: found };
    });
    if ("replay" in upload) return { kind: upload.replay.status === "conflicted" ? "conflicted" as const : "accepted" as const, revision: upload.replay,
      ...(upload.replay.status === "conflicted" ? { activeRevisionId: await this.active(command.bookId) ?? "" } : {}) };
    const staged = upload.upload;
    const priorDecision=await this.store.transaction(tx=>tx.quarantineDecision?.(uploadId)??Promise.resolve(null));if(priorDecision==="rejected"){await this.release(uploadId);throw new SourceRevisionAuthorityError("docx_rejected",422)}if(priorDecision==="pending")throw new SourceRevisionAuthorityError("docx_quarantined",422);
    const metadata = await this.objects.stat(staged.objectKey);
    if (metadata === null || metadata.byteLength !== command.fingerprint.byteLength){await this.release(uploadId);throw new SourceRevisionAuthorityError("staging_size_mismatch", 422)}
    const bytes = await this.objects.read(staged.objectKey);
    const actual = await sha256Fingerprint(bytes);
    if (actual.hex !== command.fingerprint.hex || actual.byteLength !== command.fingerprint.byteLength){await this.release(uploadId);throw new SourceRevisionAuthorityError("staging_fingerprint_mismatch", 422)}
    const inspection = priorDecision==="allowed"?{kind:"accepted"as const}:await this.inspection.inspect(bytes);
    if(inspection.kind!=="accepted"){await this.store.transaction(tx=>tx.recordQuarantine?.({uploadId,ownerId:principal.userId,bookId:command.bookId,operationId:command.operationId,deviceId:command.deviceId,reason:inspection.reason})??Promise.resolve());throw new SourceRevisionAuthorityError(inspection.kind==="rejected"?"docx_rejected":"docx_quarantined",422,inspection.reason)}
    const immutableKey = `sources/${command.bookId}/sha256/${actual.hex}.docx`;
    await this.objects.promoteIfAbsent(staged.objectKey, immutableKey);
    const result = await this.store.transaction(async (tx) => {
      if (!await tx.isBookOwner(command.bookId, principal.userId)) throw new SourceRevisionAuthorityError("book_not_found", 404);
      const replay = await tx.getRevisionByOperation(command.bookId, command.operationId);
      if (replay !== null) return replay;
      const activeRevisionId = await tx.getActiveRevisionId(command.bookId);
      const existingByFingerprint = await tx.getRevisionByFingerprint(command.bookId, command.fingerprint) ?? undefined;
      const decision = decideSourceRevision({
        bookId: command.bookId,
        operationId: command.operationId,
        baseRevisionId: command.baseRevisionId,
        activeRevisionId,
        fingerprint: command.fingerprint,
        ...(existingByFingerprint === undefined ? {} : { existingByFingerprint }),
      });
      const status = decision.kind === "create-conflicted-revision" ? "conflicted" : "uploaded";
      const revision: BookSourceRevision = { revisionId: this.ids.revisionId(), bookId: command.bookId,
        operationId: command.operationId, baseRevisionId: command.baseRevisionId, fingerprint: command.fingerprint,
        sourceName: command.sourceName, createdAt: this.now().toISOString(), createdByDeviceId: command.deviceId, status };
      if (!await tx.createRevision(revision, immutableKey)) throw new SourceRevisionAuthorityError("revision_commit_conflict", 409);
      await tx.enqueueBuildForRevision?.(revision);
      if (!await tx.markUploadFinalized(uploadId, revision.revisionId)) throw new SourceRevisionAuthorityError("upload_finalize_conflict", 409);
      await tx.commitUsage?.(uploadId);
      return revision;
    });
    await this.objects.delete(staged.objectKey).catch(() => undefined);
    return result.status === "conflicted" ? { kind: "conflicted" as const, revision: result, activeRevisionId: await this.active(command.bookId) ?? "" }
      : { kind: "accepted" as const, revision: result };
  }

  private active(bookId: string) { return this.store.transaction((tx) => tx.getActiveRevisionId(bookId)); }
  private release(uploadId:string){return this.store.transaction(async tx=>{await tx.releaseUsage?.(uploadId)})}
  private async requireDevice(principal:AuthenticatedPrincipal,deviceId:string){if(this.devices&&!await this.devices.isActiveDevice(principal.userId,deviceId))throw new SourceRevisionAuthorityError("device_not_active",409)}
}

function requirePrincipal(principal: AuthenticatedPrincipal) { if (principal.userId.trim() === "") throw new SourceRevisionAuthorityError("unauthenticated", 401); }
function validateCommand(command: PrepareSourceUploadCommand) {
  if (command.operationId.trim() === "" || command.bookId.trim() === "" || command.deviceId.trim() === "" || command.sourceName.trim() === "") throw new SourceRevisionAuthorityError("invalid_request", 400);
  if (command.fingerprint.algorithm !== "sha256" || !/^[0-9a-f]{64}$/.test(command.fingerprint.hex) || !Number.isSafeInteger(command.fingerprint.byteLength) || command.fingerprint.byteLength < 0) throw new SourceRevisionAuthorityError("invalid_fingerprint", 400);
}
function sameUploadCommand(upload: StagedSourceUpload, command: PrepareSourceUploadCommand): boolean {
  return upload.baseRevisionId === command.baseRevisionId
    && upload.sourceName === command.sourceName
    && upload.deviceId === command.deviceId
    && upload.expectedFingerprint.algorithm === command.fingerprint.algorithm
    && upload.expectedFingerprint.hex === command.fingerprint.hex
    && upload.expectedFingerprint.byteLength === command.fingerprint.byteLength;
}
