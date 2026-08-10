import type { BookSourceRevision, SourceRevisionStatus } from "./contracts.js";

export type RevisionStatusDecision =
  | { kind: "transition"; revision: BookSourceRevision }
  | { kind: "already-applied"; revision: BookSourceRevision }
  | { kind: "status-conflict"; currentStatus: SourceRevisionStatus };

const ALLOWED_TRANSITIONS: Readonly<Record<SourceRevisionStatus, readonly SourceRevisionStatus[]>> = {
  detected: ["stabilizing", "rejected", "failed"],
  stabilizing: ["hashed", "rejected", "failed"],
  hashed: ["queued", "quarantined", "rejected", "failed"],
  queued: ["uploaded", "quarantined", "rejected", "failed"],
  uploaded: ["quarantined", "processing", "rejected", "failed"],
  quarantined: ["processing", "rejected", "failed"],
  processing: ["ready", "quarantined", "rejected", "failed"],
  ready: ["published", "conflicted", "failed"],
  published: [],
  conflicted: ["processing", "rejected"],
  rejected: [],
  failed: ["queued", "processing", "rejected"],
};

/**
 * Optimistic state transition. Persistence must compare the stored status (and
 * its own record version) with expectedStatus in one transaction.
 */
export function decideRevisionStatusTransition(input: {
  revision: BookSourceRevision;
  expectedStatus: SourceRevisionStatus;
  nextStatus: SourceRevisionStatus;
}): RevisionStatusDecision {
  if (input.revision.status === input.nextStatus) {
    return { kind: "already-applied", revision: input.revision };
  }
  if (input.revision.status !== input.expectedStatus) {
    return { kind: "status-conflict", currentStatus: input.revision.status };
  }
  if (!ALLOWED_TRANSITIONS[input.expectedStatus].includes(input.nextStatus)) {
    throw new Error(`Invalid source revision transition: ${input.expectedStatus} -> ${input.nextStatus}`);
  }
  return {
    kind: "transition",
    revision: { ...input.revision, status: input.nextStatus },
  };
}
