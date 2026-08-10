import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { QuranCorpusPackManager } from "./quran-corpus-pack-manager.js";

const roots: string[] = [];
afterEach(() => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))));
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function source(root: string, version: string) {
  const directory = join(root, `source-${version}`);
  await mkdir(directory);
  const corpus = Buffer.from(JSON.stringify({ records: [version] }) + "\n");
  const search = Buffer.from(JSON.stringify({ records: [version] }) + "\n");
  await Promise.all([
    writeFile(join(directory, "ayah-text.json"), corpus),
    writeFile(join(directory, "search-index.json"), search),
    writeFile(join(directory, "manifest.json"), JSON.stringify({ datasetId: "quran-concurrent", dataVersion: version, checksumSha256: hash(corpus), byteSize: corpus.length, search: { file: "search-index.json", checksumSha256: hash(search), byteSize: search.length } })),
  ]);
  return directory;
}

describe("Quran corpus concurrent installation", () => {
  it("serializes competing managers and leaves one complete active pack", async () => {
    const root = await mkdtemp(join(tmpdir(), "quran-pack-concurrent-"));
    roots.push(root);
    const installedRoot = join(root, "installed");
    const [v1, v2] = await Promise.all([source(root, "1.0.0"), source(root, "2.0.0")]);
    const [one, two] = await Promise.all([
      new QuranCorpusPackManager(installedRoot).installFrom(v1),
      new QuranCorpusPackManager(installedRoot).installFrom(v2),
    ]);
    expect(new Set([one.version, two.version])).toEqual(new Set(["1.0.0", "2.0.0"]));
    const current = await new QuranCorpusPackManager(installedRoot).current("quran-concurrent");
    expect(current?.previous).not.toBeNull();
    expect(new Set([current?.version, current?.previous?.version])).toEqual(new Set(["1.0.0", "2.0.0"]));
    expect(await readFile(join(installedRoot, current!.directory, "ayah-text.json"), "utf8")).toContain(current!.version);
  });
});
