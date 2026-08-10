import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { validateBokIntake, validatePdfIntake } from "../packages/source-sync/dist/index.js";

const [sourceRoot, stagingRoot] = process.argv.slice(2);
if (!sourceRoot || !stagingRoot) throw new Error("usage: validate-publish-staging <source> <staging>");
const pdfPolicy = { maxBytes: 1_000_000_000, maxObjects: 2_000_000, maxDeclaredStreamBytes: 1_000_000_000 };
const bokPolicy = { maxBytes: 1_000_000_000, maxEntries: 100_000, maxExpandedBytes: 2_000_000_000, maxCompressionRatio: 1_000, maxDatabaseBytes: 1_000_000_000 };
const inspect = async (root, name) => {
  const bytes = new Uint8Array(await readFile(join(root, name)));
  const extension = extname(name).toLowerCase();
  const verdict = extension === ".pdf" ? validatePdfIntake(bytes, pdfPolicy) : validateBokIntake(bytes, bokPolicy);
  return { name, verdict };
};
const stagingNames = (await readdir(stagingRoot)).filter((name) => /\.(pdf)$/i.test(name)).sort();
const bokNames = (await readdir(sourceRoot)).filter((name) => /\.bok$/i.test(name)).sort();
const report = {
  schemaVersion: 1,
  staging: await Promise.all(stagingNames.map((name) => inspect(stagingRoot, name))),
  originalBok: await Promise.all(bokNames.map((name) => inspect(sourceRoot, name))),
};
await writeFile(join(stagingRoot, "intake-validation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report));
