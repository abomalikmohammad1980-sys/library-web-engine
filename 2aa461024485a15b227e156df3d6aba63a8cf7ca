import { describe, expect, it, vi } from "vitest";
import { redactSchedulerNotice, redactWorkerDetail, safeErrorCode } from "./log-redaction.js";
import { SourceSyncDaemon } from "./source-sync-daemon.js";
import type { SourceSyncScheduler } from "./source-sync-scheduler.js";

const secrets = { token: "seeded-user-token-Z9x", signedUrl: "https://objects.example/private.docx?X-Amz-Signature=seeded-signature", path: "C:\\Users\\private\\Arabic Secret Book.docx", hash: "a".repeat(64), content: "سِرّ محتوى الوثيقة seeded-docx-content" };
function expectClean(value: unknown) { const serialized = JSON.stringify(value); for (const secret of Object.values(secrets)) expect(serialized).not.toContain(secret); }

describe("source-sync operational log privacy", () => {
  it("allowlists scheduler metadata, worker counters, and stable error codes", () => {
    expectClean(redactSchedulerNotice({ kind: "quarantined", mappingId: "mapping-1", logicalPath: secrets.path, reason: secrets.content }));
    expect(redactWorkerDetail({ claimed: 2, ok: true, uploadUrl: secrets.signedUrl, fingerprint: secrets.hash, bytes: secrets.content })).toEqual({ claimed: 2, ok: true });
    expect(safeErrorCode(Object.assign(new Error(secrets.content), { code: "retryable_transport" }))).toBe("retryable_transport");
    expect(safeErrorCode(new Error(secrets.token))).toBe("operation_failed");
  });
  it("keeps daemon structured events and health clean when a worker throws secrets", async () => {
    const scheduler = { start: async () => {}, reconcileNow: async () => {}, stop: vi.fn(), idle: async () => {} } as unknown as SourceSyncScheduler;
    const events: unknown[] = [], failure = new Error(Object.values(secrets).join(" "));
    const daemon = new SourceSyncDaemon({ managedRoot: secrets.path, stateFile: `${secrets.path}.state`, reconcileIntervalMs: 100, outboxIntervalMs: 100, buildIntervalMs: 100 }, { runOnce: async () => { throw failure; } }, { runOnce: async () => ({ built: 0, url: secrets.signedUrl }) }, event => events.push(event), scheduler, () => 10);
    await daemon.start(); await vi.waitFor(() => expect(daemon.health().lastError.outbox).toBe("worker_failed")); await daemon.stop();
    expectClean(events); expectClean(daemon.health());
  });
});
