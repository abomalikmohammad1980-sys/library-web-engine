import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BookBuildManifest, DerivedArtifact, DerivedArtifactKind } from "@library/source-sync";
import { DurableBuildWorker, type ArtifactBuilders, type BuildJob, type BuildJobStore } from "../../source-sync-server/src/index.js";
import { discoverWordCover } from "../../word-cover/src/index.js";
import { createNodeDocumentBuilders } from "./node-derived-builders.js";
import { WordPageMapClient } from "./word-page-map-client.js";
import { createWordPageMapHttpServer, WordPageMapService } from "./word-page-map-service.js";

const kinds: DerivedArtifactKind[] = ["pdf", "search", "toc", "cover"];
function artifact(kind: DerivedArtifactKind): DerivedArtifact { return { artifactId: `build:${kind}`, kind, bookId: "book", sourceRevisionId: "revision", buildId: "build", status: "ready", fingerprint: { algorithm: "sha256", hex: "a".repeat(64), byteLength: 1 }, objectKey: `artifacts/build/${kind}`, engineVersion: "test" }; }
class Store implements BuildJobStore {
  job: BuildJob = { jobId: "reader", buildId: "build", bookId: "book", sourceRevisionId: "revision", kind: "reader", state: "pending", attempt: 0, nextAttemptAtMs: 0, leaseId: null, leaseUntilMs: null, recordVersion: 0, lastError: null };
  artifacts = kinds.map(artifact); active: string | null = "prior";
  async ensureBuildJobs() {} async claim(now: number) { if ((this.job.state === "pending" || this.job.state === "retryable") && this.job.nextAttemptAtMs <= now) { this.job = { ...this.job, state: "in-flight", attempt: this.job.attempt + 1, recordVersion: this.job.recordVersion + 1 }; return [this.job]; } return []; }
  async complete(_job: BuildJob, value: DerivedArtifact) { this.job.state = "succeeded"; this.artifacts.push(value); return true; }
  async retry(_job: BuildJob, next: number, code: string) { this.job.state = "retryable"; this.job.nextAttemptAtMs = next; this.job.lastError = code; return true; }
  async fail(_job: BuildJob, code: string) { this.job.state = "failed"; this.job.lastError = code; return true; }
  async getManifest(): Promise<BookBuildManifest> { return { buildId: "build", bookId: "book", sourceRevisionId: "revision", status: this.artifacts.length === 5 ? "ready" : "processing", artifacts: this.artifacts, createdAt: "now" }; }
  async getActiveBuildId() { return this.active; } async authorizePublicDocxPublication() { return true; } async publish() { this.active = "build"; return true; }
}
function corpus() { const dir = new URL("../../../corpus/books/", import.meta.url); for (const name of readdirSync(dir).filter(name => name.endsWith(".docx"))) { const bytes = new Uint8Array(readFileSync(new URL(name, dir))); if (discoverWordCover(bytes)) return bytes; } throw new Error("cover_corpus_missing"); }

describe("WordPageMap production composition", () => {
  it("binds a DOCX edition into the reader manifest and recovers without replacing the prior publication", async () => {
    const root = await mkdtemp(join(tmpdir(), "word-map-pipeline-")), bytes = corpus(), sourceHash = createHash("sha256").update(bytes).digest("hex"), token = "t".repeat(40); let attempts = 0; let server: Server | undefined;
    try {
      const service = new WordPageMapService({ scriptPath: "unused", tempRoot: root, runner: async ({ mapPath }) => { attempts++; if (attempts === 1) throw new Error("synthetic outage"); await writeFile(mapPath, JSON.stringify({ totalPages: 2, paragraphCount: 10, starts: [{ paragraphIndex: 0, physicalPage: 1, adjustedPage: 1 }, { paragraphIndex: 5, physicalPage: 2, adjustedPage: 2 }] })); } });
      server = createWordPageMapHttpServer({ port: 0, authToken: token, service }); if (!server.listening) await once(server, "listening"); const address = server.address(); if (!address || typeof address === "string") throw new Error("word_map_address_missing");
      const client = new WordPageMapClient({ endpoint: `http://127.0.0.1:${address.port}/v1/word-page-map`, serviceToken: async () => token, timeoutMs: 1_000, maxResponseBytes: 100_000 });
      expect(await client.health()).toBe(true);
      const writes: Array<{ objectKey: string; bytes: Uint8Array }> = [], source = { readRevisionBytes: async () => bytes, readRevisionSource: async () => ({ bytes, editionId: "edition-docx", format: "docx" as const, sha256: sourceHash }) }, sink = { putImmutable: async (value: { objectKey: string; bytes: Uint8Array }) => { writes.push(value); } };
      const reader = createNodeDocumentBuilders(source, sink, "engine", client).reader!, fallback = { build: async () => artifact("pdf") }, builders = { reader, pdf: fallback, search: fallback, toc: fallback, cover: fallback } as ArtifactBuilders, store = new Store(), worker = new DurableBuildWorker(store, builders, { leaseMs: 100, limit: 1, baseRetryMs: 1, maxRetryMs: 10 });
      expect(await worker.runOnce(0, "lease-1")).toMatchObject({ retried: 1, published: 0 }); expect(store.active).toBe("prior"); expect(store.job.lastError).toBe("word_map_http_502");
      expect(await worker.runOnce(1, "lease-2")).toMatchObject({ completed: 1, published: 1 }); expect(store.active).toBe("build");
      const manifest = await store.getManifest(), readerArtifact = manifest.artifacts.find(item => item.kind === "reader")!;
      expect(readerArtifact.sourceEdition).toEqual({ editionId: "edition-docx", format: "docx", sha256: sourceHash }); expect(readerArtifact.wordPageMap).toMatchObject({ authoritative: true, engine: "microsoft-word-com", totalPages: 2 });
      const readerPayload = JSON.parse(new TextDecoder().decode(writes.at(-1)!.bytes)); expect(readerPayload.wordPageMap.totalPages).toBe(2); expect(attempts).toBe(2);
      expect((await readdir(root)).filter(name => name.startsWith("khizana-word-map-"))).toHaveLength(0);
    } finally { if (server) { server.close(); await once(server, "close"); } await rm(root, { recursive: true, force: true }); }
  });
});
