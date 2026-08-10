import { attachSourceEdition, validateImmutableSourceEdition, type EditionAttachmentIntent, type ImmutableSourceEdition, type LogicalWork } from "@library/source-sync";

export interface StoredEditionAttachment {
  operationId: string;
  workId: string;
  editionId: string;
  intent: EditionAttachmentIntent;
  expectedWorkVersion: number;
  result: LogicalWork;
}

export interface SourceEditionPersistence {
  isOwner(workId: string, userId: string): Promise<boolean>;
  isActiveDevice(userId: string, deviceId: string): Promise<boolean>;
  getWork(workId: string): Promise<LogicalWork | null>;
  findAttachment(workId: string, operationId: string): Promise<StoredEditionAttachment | null>;
  commit(input: { userId: string; deviceId: string; edition: ImmutableSourceEdition; intent: EditionAttachmentIntent; expectedWorkVersion: number; nextWork: LogicalWork }): Promise<boolean>;
}

export class SourceEditionAuthority {
  constructor(private readonly store: SourceEditionPersistence) {}
  async attach(principal: { userId: string }, input: { deviceId: string; edition: ImmutableSourceEdition; intent: EditionAttachmentIntent; expectedWorkVersion: number }): Promise<LogicalWork> {
    validateImmutableSourceEdition(input.edition);
    if (!await this.store.isOwner(input.edition.workId, principal.userId)) throw problem(404, "work_not_found");
    if (!await this.store.isActiveDevice(principal.userId, input.deviceId)) throw problem(409, "device_not_active");
    if (input.edition.createdByDeviceId !== input.deviceId) throw problem(409, "edition_device_mismatch");
    const replay = await this.store.findAttachment(input.edition.workId, input.edition.operationId);
    if (replay !== null) {
      if (replay.editionId !== input.edition.editionId || replay.intent !== input.intent || replay.expectedWorkVersion !== input.expectedWorkVersion) throw problem(409, "operation_reuse_conflict");
      return replay.result;
    }
    const work = await this.store.getWork(input.edition.workId);
    if (work === null) throw problem(404, "work_not_found");
    let next: LogicalWork;
    try { next = attachSourceEdition(work, input.edition, input.intent, input.expectedWorkVersion); }
    catch (error) { throw problem(409, error instanceof Error ? error.message : "edition_attachment_conflict"); }
    if (!await this.store.commit({ userId: principal.userId, deviceId: input.deviceId, edition: input.edition, intent: input.intent, expectedWorkVersion: input.expectedWorkVersion, nextWork: next })) throw problem(409, "work_version_conflict");
    return next;
  }
}

function problem(status: number, code: string) { return Object.assign(new Error(code), { status, code }); }
