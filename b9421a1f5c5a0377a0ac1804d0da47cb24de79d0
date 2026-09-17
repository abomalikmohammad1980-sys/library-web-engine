import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { QuranCorpusPackManager } from "./quran-corpus-pack-manager.js";

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));

describe("Quran corpus pointer recovery", () => {
  it("uses the last valid pointer when a Windows swap was interrupted", async () => {
    const root = await mkdtemp(join(tmpdir(), "quran-pack-recovery-"));
    roots.push(root);
    const source = join(root, "source");
    const installedRoot = join(root, "installed");
    await mkdir(source);
    const corpus = Buffer.from('{"records":[]}\n');
    const search = Buffer.from('{"records":[]}\n');
    const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    await Promise.all([
      writeFile(join(source, "ayah-text.json"), corpus),
      writeFile(join(source, "search-index.json"), search),
      writeFile(join(source, "manifest.json"), JSON.stringify({ datasetId: "quran-recovery", dataVersion: "1.0.0", checksumSha256: sha(corpus), byteSize: corpus.length, search: { file: "search-index.json", checksumSha256: sha(search), byteSize: search.length } })),
    ]);
    const manager = new QuranCorpusPackManager(installedRoot);
    const installed = await manager.installFrom(source);
    const pointer = join(installedRoot, "quran-recovery.active.json");
    await writeFile(`${pointer}.previous`, await readFile(pointer));
    await rm(pointer);
    expect(await manager.current("quran-recovery")).toEqual(installed);
    expect(await manager.remove("quran-recovery")).toBe(true);
    await expect(readFile(`${pointer}.previous`)).rejects.toThrow();
  });
});
