import { createHash, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface WordPageStart { paragraphIndex: number; physicalPage: number; adjustedPage: number }
export interface WordParagraphAudit { paragraphIndex: number; physicalPage: number; adjustedPage: number; text: string }
export interface WordPageAudit { physicalPage: number; adjustedPage: number; firstParagraphIndex: number; lastParagraphIndex: number; firstText: string; lastText: string }
export interface WordParagraphFragment { paragraphIndex:number; physicalPage:number; adjustedPage:number; startOffset:number; endOffset:number; text:string }
export interface AuthoritativeWordPageMap {
  totalPages: number; paragraphCount: number; starts: WordPageStart[];
  pages?: WordPageAudit[]; paragraphs?: WordParagraphAudit[]; fragments?: WordParagraphFragment[];
}
export interface WordMapPartResult { fingerprint: string; bytes: number; map: AuthoritativeWordPageMap }
export interface WordMapResult {
  schemaVersion: 1; authoritative: true; engine: "microsoft-word-com";
  fingerprint: string; parts: WordMapPartResult[];
}

export class WordMapServiceError extends Error {
  constructor(readonly code: "invalid_request" | "unauthorized" | "too_large" | "timeout" | "conversion_failed", readonly status: number) {
    super(code); this.name = "WordMapServiceError";
  }
}

export interface WordMapServiceOptions {
  scriptPath: string;
  timeoutMs?: number; maxPartBytes?: number; maxTotalBytes?: number; maxParts?: number;
  tempRoot?: string; powershellPath?: string;
  runner?: (paths: { input: string; output: string; mapPath: string; pidPath: string; timeoutMs: number }) => Promise<void>;
}

const isDocx = (bytes: Uint8Array): boolean => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
const fingerprint = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function validateMap(value: unknown): AuthoritativeWordPageMap {
  const map = value as Partial<AuthoritativeWordPageMap>;
  if (!Number.isInteger(map.totalPages) || (map.totalPages ?? 0) < 1 || !Number.isInteger(map.paragraphCount)
    || (map.paragraphCount ?? 0) < 1 || !Array.isArray(map.starts) || map.starts.length < 1
    || map.starts.length > (map.totalPages ?? 0)
    || (map.starts.length < (map.totalPages ?? 0) && !Array.isArray(map.pages)))
    throw new WordMapServiceError("conversion_failed", 502);
  let previousParagraph = -1;
  let previousPhysical = 0;
  for (let index = 0; index < map.starts.length; index++) {
    const start = map.starts[index]!;
    if (!Number.isInteger(start.physicalPage) || start.physicalPage <= previousPhysical
      || start.physicalPage > map.totalPages! || !Number.isInteger(start.paragraphIndex)
      || start.paragraphIndex <= previousParagraph || start.paragraphIndex >= map.paragraphCount!
      || !Number.isInteger(start.adjustedPage))
      throw new WordMapServiceError("conversion_failed", 502);
    previousParagraph = start.paragraphIndex;
    previousPhysical = start.physicalPage;
  }
  if (map.pages !== undefined) {
    if (!Array.isArray(map.pages) || map.pages.length !== map.totalPages)
      throw new WordMapServiceError("conversion_failed", 502);
    const startsByPage = new Map(map.starts.map(start => [start.physicalPage, start]));
    for (let index = 0; index < map.pages.length; index++) {
      const page = map.pages[index]!;
      const empty = page.firstParagraphIndex === -1 && page.lastParagraphIndex === -1;
      const start = startsByPage.get(page.physicalPage);
      const fragmentOnPage = map.fragments?.some(fragment => fragment.physicalPage === page.physicalPage) ?? false;
      if (page.physicalPage !== index + 1 || !Number.isInteger(page.adjustedPage)
        || typeof page.firstText !== "string" || typeof page.lastText !== "string"
        || (empty ? start !== undefined || fragmentOnPage : start === undefined && !fragmentOnPage)
        || (!empty && (!Number.isInteger(page.firstParagraphIndex) || !Number.isInteger(page.lastParagraphIndex)
          || page.firstParagraphIndex < 0 || page.lastParagraphIndex < page.firstParagraphIndex
          || page.lastParagraphIndex >= map.paragraphCount! || (start !== undefined && !fragmentOnPage && page.firstParagraphIndex < start.paragraphIndex)))
        || (empty && (page.firstText !== "" || page.lastText !== ""))
        || (start !== undefined && start.adjustedPage !== page.adjustedPage))
        throw new WordMapServiceError("conversion_failed", 502);
    }
  }
  if (map.paragraphs !== undefined) {
    if (!Array.isArray(map.paragraphs) || map.paragraphs.length !== map.paragraphCount)
      throw new WordMapServiceError("conversion_failed", 502);
    for (let index = 0; index < map.paragraphs.length; index++) {
      const paragraph = map.paragraphs[index]!;
      if (paragraph.paragraphIndex !== index || !Number.isInteger(paragraph.physicalPage)
        || paragraph.physicalPage < 1 || paragraph.physicalPage > map.totalPages!
        || !Number.isInteger(paragraph.adjustedPage) || typeof paragraph.text !== "string")
        throw new WordMapServiceError("conversion_failed", 502);
    }
  }
  if (map.fragments !== undefined) {
    if (!Array.isArray(map.fragments)) throw new WordMapServiceError("conversion_failed", 502);
    const previousEnd = new Map<number, number>();
    for (const fragment of map.fragments) {
      const prior = previousEnd.get(fragment.paragraphIndex) ?? 0;
      if (!Number.isInteger(fragment.paragraphIndex) || fragment.paragraphIndex < 0
        || fragment.paragraphIndex >= map.paragraphCount! || !Number.isInteger(fragment.physicalPage)
        || fragment.physicalPage < 1 || fragment.physicalPage > map.totalPages!
        || !Number.isInteger(fragment.adjustedPage) || !Number.isInteger(fragment.startOffset)
        || !Number.isInteger(fragment.endOffset) || fragment.startOffset < 0
        || fragment.endOffset <= fragment.startOffset || fragment.startOffset !== prior
        || typeof fragment.text !== "string") throw new WordMapServiceError("conversion_failed", 502);
      previousEnd.set(fragment.paragraphIndex, fragment.endOffset);
    }
  }
  return map as AuthoritativeWordPageMap;
}

/** نفس بوابة الصرامة لطرف الخدمة وعميل البناء؛ لا يُقبل artifact أضعف عن بعد. */
export function isValidAuthoritativeWordPageMap(value: unknown): value is AuthoritativeWordPageMap {
  try { validateMap(value); return true; } catch { return false; }
}

async function terminateOwnedWord(pidPath: string): Promise<void> {
  const raw = await readFile(pidPath, "utf8").catch(() => "");
  const pid = Number(raw.trim());
  if (!Number.isSafeInteger(pid) || pid <= 0 || process.platform !== "win32") return;
  await new Promise<void>(resolveDone => execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"],
    { windowsHide: true, timeout: 10_000 }, () => resolveDone()));
}

export class WordPageMapService {
  private tail: Promise<void> = Promise.resolve();
  private readonly timeoutMs: number; private readonly maxPartBytes: number;
  private readonly maxTotalBytes: number; private readonly maxParts: number;
  constructor(private readonly options: WordMapServiceOptions) {
    this.timeoutMs = options.timeoutMs ?? 5 * 60_000;
    this.maxPartBytes = options.maxPartBytes ?? 150 * 1024 * 1024;
    this.maxTotalBytes = options.maxTotalBytes ?? 300 * 1024 * 1024;
    this.maxParts = options.maxParts ?? 20;
  }

  build(parts: readonly Uint8Array[]): Promise<WordMapResult> {
    const run = () => this.buildNow(parts);
    const queued = this.tail.then(run, run);
    this.tail = queued.then(() => undefined, () => undefined);
    return queued;
  }

  private async buildNow(parts: readonly Uint8Array[]): Promise<WordMapResult> {
    if (!parts.length || parts.length > this.maxParts) throw new WordMapServiceError("invalid_request", 400);
    let total = 0;
    for (const part of parts) {
      total += part.byteLength;
      if (!isDocx(part)) throw new WordMapServiceError("invalid_request", 400);
      if (part.byteLength > this.maxPartBytes || total > this.maxTotalBytes) throw new WordMapServiceError("too_large", 413);
    }
    const root = resolve(this.options.tempRoot ?? tmpdir());
    await mkdir(root, { recursive: true });
    const dir = await mkdtemp(join(root, "khizana-word-map-"));
    try {
      const results: WordMapPartResult[] = [];
      for (let index = 0; index < parts.length; index++) {
        const bytes = parts[index]!;
        const input = join(dir, `part-${index}.docx`), mapPath = join(dir, `part-${index}.json`);
        const pdf = join(dir, `part-${index}.pdf`), pidPath = join(dir, `part-${index}.pid`);
        await writeFile(input, bytes);
        await this.run(input, pdf, mapPath, pidPath);
        const map = validateMap(JSON.parse(await readFile(mapPath, "utf8")));
        results.push({ fingerprint: fingerprint(bytes), bytes: bytes.byteLength, map });
      }
      const aggregate = createHash("sha256");
      for (const result of results) aggregate.update(result.fingerprint, "ascii");
      return { schemaVersion: 1, authoritative: true, engine: "microsoft-word-com",
        fingerprint: aggregate.digest("hex"), parts: results };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private run(input: string, output: string, mapPath: string, pidPath: string): Promise<void> {
    if (this.options.runner) {
      return new Promise<void>((resolveRun, rejectRun) => {
        const timer = setTimeout(() => rejectRun(new WordMapServiceError("timeout", 504)), this.timeoutMs);
        this.options.runner!({ input, output, mapPath, pidPath, timeoutMs: this.timeoutMs })
          .then(() => { clearTimeout(timer); resolveRun(); }, () => {
            clearTimeout(timer); rejectRun(new WordMapServiceError("conversion_failed", 502));
          });
      });
    }
    return new Promise((resolveRun, rejectRun) => {
      execFile(this.options.powershellPath ?? "powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", resolve(this.options.scriptPath), "-InputPath", input, "-OutputPath", output,
        "-PageMapPath", mapPath, "-WordPidPath", pidPath, "-SkipPdf"],
      { windowsHide: true, timeout: this.timeoutMs, maxBuffer: 64 * 1024 }, async error => {
        if (!error) { resolveRun(); return; }
        await terminateOwnedWord(pidPath);
        const timedOut = (error as NodeJS.ErrnoException & { killed?: boolean }).killed === true;
        rejectRun(new WordMapServiceError(timedOut ? "timeout" : "conversion_failed", timedOut ? 504 : 502));
      });
    });
  }
}

export interface WordMapHttpOptions {
  port: number; authToken: string; service: WordPageMapService; host?: string; maxRequestBytes?: number;
}

function authorized(req: IncomingMessage, token: string): boolean {
  const value = req.headers.authorization ?? "";
  const expected = `Bearer ${token}`;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const value of req) {
    const chunk = Buffer.from(value); size += chunk.length;
    if (size > maxBytes) throw new WordMapServiceError("too_large", 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new WordMapServiceError("invalid_request", 400); }
}

function respond(res: ServerResponse, status: number, payload: unknown): void {
  const body = Buffer.from(JSON.stringify(payload)); res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Content-Length", String(body.length));
  res.setHeader("Cache-Control", "no-store"); res.end(body);
}

export function createWordPageMapHttpServer(options: WordMapHttpOptions): Server {
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535 || options.authToken.length < 32)
    throw new WordMapServiceError("invalid_request", 400);
  return createServer(async (req, res) => {
    if ((req.url ?? "").split("?")[0] !== "/v1/word-page-map") { respond(res, 404, { error: "not_found" }); return; }
    if (!authorized(req, options.authToken)) { respond(res, 401, { error: "unauthorized" }); return; }
    if (req.method === "HEAD") { res.statusCode = 204; res.setHeader("Cache-Control", "no-store"); res.end(); return; }
    if (req.method !== "POST") { respond(res, 405, { error: "method_not_allowed" }); return; }
    try {
      const value = await readJson(req, options.maxRequestBytes ?? 410 * 1024 * 1024) as { parts?: unknown[] };
      if (!Array.isArray(value.parts)) throw new WordMapServiceError("invalid_request", 400);
      const parts = value.parts.map(part => {
        if (typeof part !== "string" || !/^[A-Za-z0-9+/_=-]+$/.test(part)) throw new WordMapServiceError("invalid_request", 400);
        return new Uint8Array(Buffer.from(part, "base64"));
      });
      respond(res, 200, await options.service.build(parts));
    } catch (error) {
      const known = error instanceof WordMapServiceError ? error : new WordMapServiceError("conversion_failed", 502);
      respond(res, known.status, { error: known.code });
    }
  }).listen(options.port, options.host ?? "127.0.0.1");
}
