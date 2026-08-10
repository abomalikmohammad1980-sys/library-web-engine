import { createHash, randomUUID } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

interface CorpusManifest {
  datasetId: string;
  dataVersion: string;
  checksumSha256: string;
  byteSize: number;
  search: { file: string; checksumSha256: string; byteSize: number };
}

export interface QuranCorpusPackPointer {
  datasetId: string;
  version: string;
  directory: string;
  checksumSha256: string;
  previous: { version: string; directory: string; checksumSha256: string } | null;
}

export class QuranCorpusPackManager {
  private readonly root: string;

  constructor(root: string) { this.root = resolve(root); }

  async current(datasetId: string) {
    const pointer = this.path(`${safe(datasetId)}.active.json`);
    for (const candidate of [pointer, `${pointer}.previous`]) {
      try {
        const value = JSON.parse(await readFile(candidate, "utf8")) as QuranCorpusPackPointer;
        if (value.datasetId === datasetId && value.directory && /^[a-f0-9]{64}$/.test(value.checksumSha256)) return value;
      } catch { /* a valid backup may still exist after an interrupted pointer swap */ }
    }
    return null;
  }

  async installFrom(sourceDir: string) { return this.withLock(() => this.installFromUnlocked(sourceDir)); }

  private async installFromUnlocked(sourceDir: string) {
    const source = resolve(sourceDir);
    const manifestPath = join(source, "manifest.json");
    await regular(manifestPath);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CorpusManifest;
    validate(manifest);
    const previous = await this.current(manifest.datasetId);
    const corpus = join(source, "ayah-text.json");
    const search = join(source, manifest.search.file);
    await Promise.all([regular(corpus), regular(search)]);
    const [corpusBytes, searchBytes] = await Promise.all([readFile(corpus), readFile(search)]);
    if (corpusBytes.length !== manifest.byteSize || digest(corpusBytes) !== manifest.checksumSha256 || searchBytes.length !== manifest.search.byteSize || digest(searchBytes) !== manifest.search.checksumSha256) throw Error("quran_pack_checksum_mismatch");
    await mkdir(this.root, { recursive: true });
    const name = `${safe(manifest.datasetId)}-${safe(manifest.dataVersion)}-${manifest.checksumSha256.slice(0, 12)}`;
    const target = this.path(name);
    const temp = this.path(`.${name}.${randomUUID()}.tmp`);
    if (previous?.directory === name) return previous;
    try {
      await mkdir(temp);
      await Promise.all([copyFile(manifestPath, join(temp, "manifest.json")), copyFile(corpus, join(temp, "ayah-text.json")), copyFile(search, join(temp, "search-index.json"))]);
      await rename(temp, target).catch(async error => { try { await lstat(target); } catch { throw error; } });
      const value: QuranCorpusPackPointer = { datasetId: manifest.datasetId, version: manifest.dataVersion, directory: basename(target), checksumSha256: manifest.checksumSha256, previous: previous ? { version: previous.version, directory: previous.directory, checksumSha256: previous.checksumSha256 } : null };
      await this.writePointer(manifest.datasetId, value);
      return value;
    } finally { await rm(temp, { recursive: true, force: true }); }
  }

  async rollback(datasetId: string) { return this.withLock(() => this.rollbackUnlocked(datasetId)); }

  private async rollbackUnlocked(datasetId: string) {
    const current = await this.current(datasetId);
    if (!current?.previous) return null;
    const prior = current.previous;
    const directory = this.path(prior.directory);
    const manifestPath = join(directory, "manifest.json");
    const corpusPath = join(directory, "ayah-text.json");
    await Promise.all([regular(manifestPath), regular(corpusPath)]);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as CorpusManifest;
    validate(manifest);
    const searchPath = join(directory, manifest.search.file);
    await regular(searchPath);
    const [corpusBytes, searchBytes] = await Promise.all([readFile(corpusPath), readFile(searchPath)]);
    if (manifest.datasetId !== current.datasetId || manifest.dataVersion !== prior.version || manifest.checksumSha256 !== prior.checksumSha256 || corpusBytes.length !== manifest.byteSize || digest(corpusBytes) !== manifest.checksumSha256 || searchBytes.length !== manifest.search.byteSize || digest(searchBytes) !== manifest.search.checksumSha256) throw Error("quran_pack_rollback_checksum_mismatch");
    const next: QuranCorpusPackPointer = { datasetId: current.datasetId, version: prior.version, directory: prior.directory, checksumSha256: prior.checksumSha256, previous: { version: current.version, directory: current.directory, checksumSha256: current.checksumSha256 } };
    await this.writePointer(datasetId, next);
    return next;
  }

  async remove(datasetId: string) { return this.withLock(() => this.removeUnlocked(datasetId)); }

  private async removeUnlocked(datasetId: string) {
    const current = await this.current(datasetId);
    if (!current) return false;
    await rm(this.path(current.directory), { recursive: true, force: true });
    if (current.previous && current.previous.directory !== current.directory) await rm(this.path(current.previous.directory), { recursive: true, force: true });
    const pointer = this.path(`${safe(datasetId)}.active.json`);
    await Promise.all([rm(pointer, { force: true }), rm(`${pointer}.previous`, { force: true })]);
    return true;
  }

  private async writePointer(datasetId: string, value: QuranCorpusPackPointer) {
    const pointer = this.path(`${safe(datasetId)}.active.json`);
    const backup = `${pointer}.previous`;
    const pending = `${pointer}.${randomUUID()}.tmp`;
    await writeFile(pending, JSON.stringify(value));
    try {
      await rm(backup, { force: true });
      await rename(pointer, backup).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      await rename(pending, pointer);
      await rm(backup, { force: true });
    } catch (error) {
      try { await lstat(pointer); } catch { await rename(backup, pointer).catch(() => undefined); }
      throw error;
    } finally { await rm(pending, { force: true }); }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true });
    const lock = this.path(".quran-pack-manager.lock");
    const deadline = Date.now() + 5_000;
    while (true) {
      try { await mkdir(lock); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const age = await stat(lock).then(item => Date.now() - item.mtimeMs).catch(() => 0);
        if (age > 30_000) { await rm(lock, { recursive: true, force: true }); continue; }
        if (Date.now() >= deadline) throw Error("quran_pack_lock_timeout");
        await delay(25);
      }
    }
    try { return await operation(); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }

  private path(value: string) {
    const path = resolve(this.root, value);
    if (path !== this.root && !path.startsWith(this.root + sep)) throw Error("quran_pack_path_escape");
    return path;
  }
}

function safe(value: string) { if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(value)) throw Error("quran_pack_id_invalid"); return value; }
function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
async function regular(path: string) { const item = await lstat(path); if (!item.isFile() || item.isSymbolicLink()) throw Error("quran_pack_file_unsafe"); }
function validate(m: CorpusManifest) { safe(m.datasetId); safe(m.dataVersion); if (!/^[a-f0-9]{64}$/.test(m.checksumSha256) || !Number.isSafeInteger(m.byteSize) || m.byteSize < 1 || m.search.file !== "search-index.json" || !/^[a-f0-9]{64}$/.test(m.search.checksumSha256) || !Number.isSafeInteger(m.search.byteSize) || m.search.byteSize < 1) throw Error("quran_pack_manifest_invalid"); }
