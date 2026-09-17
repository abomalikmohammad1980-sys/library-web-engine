import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import MDBReader from "../app/node_modules/mdb-reader/lib/node/index.js";

const [sourceRoot, outputFile] = process.argv.slice(2);
if (!sourceRoot || !outputFile) throw new Error("usage: inspect-bok-jet <source> <report>");
const SHAMELA_AUXILIARY_TABLES = new Set(["men_b", "men_u", "men_h", "shorts", "shrooh", "com", "abc", "nbound", "oshr", "oshrooh", "avpdf", "spdf"]);
const results = [];
for (const name of (await readdir(sourceRoot)).filter((value) => /\.bok$/i.test(value)).sort()) {
  try {
    const reader = new MDBReader(Buffer.from(await readFile(join(sourceRoot, name))));
    const tables = reader.getTableNames();
    const unexpectedTables = tables.filter((table) => !/^(?:Main|b\d+|t\d+)$/i.test(table) && !SHAMELA_AUXILIARY_TABLES.has(table.toLowerCase()));
    const main = tables.find((table) => /^Main$/i.test(table));
    if (!main) throw new Error("missing_main_table");
    const row = reader.getTable(main).getData({ rowLimit: 1 })[0];
    const bookId = Number(row?.BkId);
    const body = tables.find((table) => table.toLowerCase() === `b${bookId}`.toLowerCase());
    if (!Number.isFinite(bookId) || !body) throw new Error("missing_book_body_table");
    const pageProbe = reader.getTable(body).getData({ rowLimit: 1 });
    results.push({ name, verdict: unexpectedTables.length ? "review" : "allow", tables, unexpectedTables, bookId, bodyTable: body, readablePageProbe: pageProbe.length === 1 });
  } catch (error) {
    results.push({ name, verdict: "fail-closed", reason: error instanceof Error ? error.message : String(error) });
  }
}
const report = { schemaVersion: 1, inspection: "mdb-reader structural table/object inventory", results };
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report));
