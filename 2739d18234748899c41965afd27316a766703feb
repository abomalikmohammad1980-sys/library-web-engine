import type {
  RevisionHistorySnapshot,
  SourceConflictResolution,
  SourceConflictResolutionRequest,
  SourceConflictResolutionResult,
} from "@library/source-sync";
import type { AuthenticatedPrincipal, DeviceAuthorizationStore } from "./contracts.js";
import { SourceRevisionAuthorityError } from "./contracts.js";

export interface StoredConflictResolution extends SourceConflictResolutionResult {
  conflictingRevisionId: string;
}

export interface ConflictResolutionStore {
  isOwner(bookId: string, userId: string): Promise<boolean>;
  snapshot(bookId: string): Promise<RevisionHistorySnapshot>;
  findResolution(bookId: string, operationId: string): Promise<StoredConflictResolution | null>;
  readyBuild(bookId: string, revisionId: string): Promise<string | null>;
  enqueue(bookId: string, revisionId: string): Promise<void>;
  commit(input: SourceConflictResolutionRequest & {
    bookId: string; userId: string; readyBuildId: string | null; activeRevisionId: string | null;
  }): Promise<StoredConflictResolution | null>;
}

export class ConflictResolutionAuthority {
  constructor(private readonly store: ConflictResolutionStore, private readonly devices?: DeviceAuthorizationStore) {}

  async resolve(principal: AuthenticatedPrincipal, bookId: string, input: SourceConflictResolutionRequest): Promise<SourceConflictResolutionResult> {
    validateInput(input);
    if (!await this.store.isOwner(bookId, principal.userId)) throw new SourceRevisionAuthorityError("book_not_found", 404);
    if (this.devices && !await this.devices.isActiveDevice(principal.userId, input.deviceId)) {
      throw new SourceRevisionAuthorityError("device_not_active", 409);
    }
    const prior = await this.store.findResolution(bookId, input.operationId);
    if (prior) {
      if (prior.conflictingRevisionId !== input.conflictingRevisionId || prior.resolution !== input.resolution) {
        throw new SourceRevisionAuthorityError("operation_reused", 409);
      }
      return prior;
    }
    const snapshot = await this.store.snapshot(bookId);
    const revision = snapshot.revisions.find((candidate) => candidate.revisionId === input.conflictingRevisionId);
    if (!revision) throw new SourceRevisionAuthorityError("revision_not_found", 404);
    if (revision.status !== "conflicted") throw new SourceRevisionAuthorityError("revision_not_conflicted", 409);
    if (snapshot.recordVersion !== input.expectedPublicationVersion) throw new SourceRevisionAuthorityError("publication_conflict", 409);
    const readyBuildId = input.resolution === "keepLocal"
      ? await this.store.readyBuild(bookId, input.conflictingRevisionId) : null;
    if (input.resolution === "keepLocal" && readyBuildId === null) {
      await this.store.enqueue(bookId, input.conflictingRevisionId);
    }
    const result = await this.store.commit({ ...input, bookId, userId: principal.userId, readyBuildId, activeRevisionId: snapshot.currentRevisionId });
    if (!result) throw new SourceRevisionAuthorityError("publication_conflict", 409);
    return result;
  }
}

export interface ConflictResolutionAuthenticator { authenticate(request: Request): Promise<AuthenticatedPrincipal> }
export class ConflictResolutionHttpRouter {
  constructor(private readonly authority: ConflictResolutionAuthority, private readonly auth: ConflictResolutionAuthenticator) {}
  async handle(request: Request): Promise<Response> {
    try {
      const match = new URL(request.url).pathname.replace(/\/+$/, "")
        .match(/\/books\/([^/]+)\/source-revisions\/resolve-conflict$/);
      if (request.method !== "POST" || !match?.[1]) return Response.json({ error: { code: "not_found" } }, { status: 404 });
      const body = await request.json() as Partial<SourceConflictResolutionRequest>;
      const principal = await this.auth.authenticate(request);
      return Response.json(await this.authority.resolve(principal, decodeURIComponent(match[1]), body as SourceConflictResolutionRequest));
    } catch (error) {
      return error instanceof SourceRevisionAuthorityError
        ? Response.json({ error: { code: error.code } }, { status: error.status })
        : Response.json({ error: { code: "internal_error" } }, { status: 500 });
    }
  }
}

function validateInput(input: SourceConflictResolutionRequest): void {
  const resolutions = new Set<SourceConflictResolution>(["keepLocal", "keepRemote", "createCopy"]);
  if (!input || typeof input.operationId !== "string" || !input.operationId.trim()
    || typeof input.deviceId !== "string" || !input.deviceId.trim()
    || typeof input.conflictingRevisionId !== "string" || !input.conflictingRevisionId.trim()
    || !Number.isSafeInteger(input.expectedPublicationVersion) || input.expectedPublicationVersion < 0
    || !resolutions.has(input.resolution)) throw new SourceRevisionAuthorityError("invalid_request", 400);
}
