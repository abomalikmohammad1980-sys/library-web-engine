import type { SchedulerNotice } from "./source-sync-scheduler.js";

/** Logging boundary: retain operational categories and counters, never source
 * names, paths, fingerprints, URLs, document content, or exception messages. */
export function redactSchedulerNotice(notice: SchedulerNotice): Record<string, unknown> {
  const base: Record<string, unknown> = { kind: notice.kind };
  if ("mappingId" in notice) base.mappingId = notice.mappingId;
  if (notice.kind === "ambiguous-identity") base.candidateCount = notice.logicalPaths.length;
  if (notice.kind === "quarantined") base.reasonCode = safeReasonCode(notice.reason);
  return base;
}

export function redactWorkerDetail(value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return { count: value.length };
  if (typeof value !== "object" || value === null) return undefined;
  const safe: Record<string, number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" || typeof item === "boolean" || item === null) safe[key] = item;
  }
  return safe;
}

export function safeErrorCode(error: unknown, fallback = "operation_failed"): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && /^[a-z][a-z0-9_-]{0,63}$/i.test(code) ? code : fallback;
}

function safeReasonCode(reason: string): string {
  return /^[a-z][a-z0-9_-]{0,63}$/i.test(reason) ? reason : "quarantine_reason_redacted";
}
